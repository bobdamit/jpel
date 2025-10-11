import { ProcessDefinition } from './models/process-types';
import { logger } from './logger';
import fs from 'fs';
import path from 'path';
import Ajv from 'ajv';
import type { ValidateFunction } from 'ajv';
import yaml from 'js-yaml';

export interface ValidationResult {
	valid: boolean;
	errors: string[];
	warnings: string[];
}

/**
 * Loads, validates and prepares a Process for instantiation
 * into a process Instance
 * TODO: rename this ProcessLoader ?
 */
export class ProcessNormalizer {

	// cached schema validator
	private validator: ValidateFunction | null = null;
	private ajv: Ajv | null = null;
	private schemaLoadError: string | null = null;

	/**
	 * Load and compile the JSON Schema from design/schema.yaml (cached)
	 */
	private getSchemaValidator(): ValidateFunction | null {
		if (this.validator || this.schemaLoadError) return this.validator;

		try {
			// Prefer a pre-bundled resolved JSON Schema artifact if available. Projects
			// may split the design into a focused process/template schema and a
			// separate runtime/instance schema. To support that without breaking
			// existing repos, prefer a process-only artifact when present:
			// - design/schema-process-resolved.json
			// - design/schema-process.yaml
			// Otherwise fall back to the historical combined files:
			// - design/schema-resolved.json
			// - design/schema.yaml
			const resolvedProcessJson = path.resolve(__dirname, '../../design/schema-process-resolved.json');
			const processYamlPath = path.resolve(__dirname, '../../design/schema-process.yaml');
			const resolvedJsonPath = path.resolve(__dirname, '../../design/schema-resolved.json');
			const combinedYamlPath = path.resolve(__dirname, '../../design/schema.yaml');
			let doc: any = null;

			if (fs.existsSync(resolvedProcessJson)) {
				const file = fs.readFileSync(resolvedProcessJson, 'utf8');
				doc = JSON.parse(file);
			} else if (fs.existsSync(processYamlPath)) {
				const file = fs.readFileSync(processYamlPath, 'utf8');
				doc = yaml.load(file) as any;
			} else if (fs.existsSync(resolvedJsonPath)) {
				const file = fs.readFileSync(resolvedJsonPath, 'utf8');
				doc = JSON.parse(file);
			} else if (fs.existsSync(combinedYamlPath)) {
				const file = fs.readFileSync(combinedYamlPath, 'utf8');
				doc = yaml.load(file) as any;
			} else {
				throw new Error('No schema file found (looked for schema-process-resolved.json/schema-process.yaml/schema-resolved.json/schema.yaml)');
			}

			// Prefer the `process` schema node as the schema root (this matches
			// expected JSON Schema structure). If the YAML also has `components`
			// (like OpenAPI-style components), copy them onto the schema so
			// internal $refs (e.g. #/components/schemas/Variable) resolve.
			const schema = doc && doc.process ? doc.process : doc;
			// If the YAML uses OpenAPI-style components (#/components/schemas/...)
			// convert them into a JSON Schema-compatible place (definitions) and
			// rewrite $ref values so Ajv in strict mode doesn't complain about
			// the unknown 'components' keyword.
			if (doc && doc.components && doc.components.schemas) {
				// Attach as 'definitions' which is recognized by Ajv and JSON Schema
				(schema as any).definitions = doc.components.schemas;

				// Recursively rewrite any $ref strings that point to
				// '#/components/schemas/...' so they point to '#/definitions/...'
				const rewriteRefs = (obj: any) => {
					if (!obj || typeof obj !== 'object') return;
					for (const k of Object.keys(obj)) {
						const v = obj[k];
						if (k === '$ref' && typeof v === 'string' && v.startsWith('#/components/schemas/')) {
							obj[k] = v.replace('#/components/schemas/', '#/definitions/');
						} else if (typeof v === 'object' && v !== null) {
							rewriteRefs(v);
						}
					}
				};

				rewriteRefs(schema);
			}

			// Remove OpenAPI-specific example/examples keywords which are not
			// part of JSON Schema keywords and cause Ajv strict mode to fail.
			const stripExamples = (obj: any) => {
				if (!obj || typeof obj !== 'object') return;
				for (const k of Object.keys(obj)) {
					if (k === 'example' || k === 'examples') {
						delete obj[k];
						continue;
					}
					const v = obj[k];
					if (typeof v === 'object' && v !== null) stripExamples(v);
				}
			};
			stripExamples(schema);

			// Definitions object (if present) is used only for diagnostics below.
			const defs = (schema as any).definitions || {};

			// Diagnostic logging: what did we end up with in definitions?
			try {
				const varEnum = defs.Variable && defs.Variable.properties && defs.Variable.properties.type && defs.Variable.properties.type.enum;
				const actReq = defs.Activity && defs.Activity.required;
				logger.info('ProcessNormalizer: schema diagnostics', { variableTypeEnum: varEnum, activityRequired: actReq });
			} catch (e) {
				// ignore
			}

			// Create Ajv with strict mode enabled to enforce schema correctness.
			// Some schemas may still use permissive constructs; compile errors are
			// captured and will fall back to runtime validation with a warning.
			this.ajv = new Ajv({
				allErrors: true,
				strict: true,
				strictTypes: true,
				strictTuples: true,
				strictRequired: true,
			});
			this.validator = this.ajv.compile(schema);
			return this.validator;
		} catch (err: any) {
			this.schemaLoadError = `Failed to load/compile schema.yaml: ${err && err.message ? err.message : String(err)}`;
			// Log schema load/compile failures at ERROR level so they are visible in CI/diagnostics
			logger.error('ProcessNormalizer: could not load design/schema.yaml for schema validation', { error: this.schemaLoadError });
			return null;
		}
	}

	validate(processDefinition: ProcessDefinition): ValidationResult {
		const errors: string[] = [];
		const warnings: string[] = [];

		// First try schema-based validation if possible
		const validator = this.getSchemaValidator();
		if (validator) {
			const valid = validator(processDefinition);
			if (!valid) {
				const ajvErrors = validator.errors || [];
				for (const e of ajvErrors) {
					// Format AJV error into readable message
					const instancePath = (e.instancePath && e.instancePath.length > 0) ? `${e.instancePath} ` : '';
					const msg = `Schema: ${instancePath}${e.message}`;
					errors.push(msg);
					// Log each schema diagnostic individually at ERROR to aid authors. Use
					// a safe cast to avoid strict typing issues when accessing id.
					try {
						const pid = (processDefinition as any) && (processDefinition as any).id ? (processDefinition as any).id : undefined;
						logger.error('ProcessNormalizer: Schema validation error', { processId: pid, error: msg });
					} catch (logErr) {
						// don't let logging failures break validation flow
					}
				}
				// If schema says invalid, collect schema errors and continue with
				// the runtime validations below. Tests expect runtime-style
				// messages (e.g. 'Missing required field: id') in addition to
				// schema diagnostics, so avoid returning early here.
			}
		} else if (this.schemaLoadError) {
			// If schema failed to load, log the problem at ERROR level (so it shows in logs)
			// but continue with existing runtime validation logic to avoid breaking loads.
			logger.error('ProcessNormalizer: schema validator unavailable', { error: this.schemaLoadError });
			warnings.push(this.schemaLoadError);
		}

		if (!processDefinition) {
			errors.push('Process definition is empty');
			return { valid: false, errors, warnings };
		}

		if (!processDefinition.id) errors.push('Missing required field: id');
		if (!processDefinition.name) errors.push('Missing required field: name');

		if (processDefinition.activities) {
			for (const [key, activity] of Object.entries(processDefinition.activities)) {
				if (!activity.type) {
					errors.push(`Activity '${key}' missing required field: type`);
					continue;
				}

				// check for common mistakes: using 'checkbox' instead of 'boolean' for fields
				if ((activity as any).inputs && Array.isArray((activity as any).inputs)) {
					for (const f of (activity as any).inputs) {
						if (f && f.type === 'checkbox') {
							warnings.push(`Activity '${key}' field '${f.name}' uses deprecated type 'checkbox' (use 'boolean')`);
						}
					}
				}

				// Validate field references in compute activity code
				if (activity.type === 'compute' && (activity as any).code) {
					const codeLines = (activity as any).code as string[];
					for (const line of codeLines) {
						const fieldRefs = this.extractFieldReferences(line);
						for (const ref of fieldRefs) {
							const validationError = this.validateFieldReference(ref, processDefinition);
							if (validationError) {
								errors.push(`Activity '${key}' code: ${validationError}`);
							}
						}
					}
				}
			}
		}

		// Cross-reference checks (start, sequence/parallel lists, branch/switch targets)
		const activityKeys = new Set(Object.keys(processDefinition.activities || {}));

		function extractRef(ref?: string): string | null {
			if (!ref) return null;
			return ref.startsWith('a:') ? ref.substring(2) : ref;
		}

		// start reference
		const startRef = extractRef(processDefinition.start);
		if (!startRef || !activityKeys.has(startRef)) {
			errors.push(`Start activity reference '${processDefinition.start}' does not point to a valid activity`);
		}

		for (const [key, activity] of Object.entries(processDefinition.activities || {})) {
			switch (activity.type) {
				case 'sequence':
				case 'parallel':
					const arr = (activity as any).activities as string[] | undefined;
					if (!arr || !Array.isArray(arr) || arr.length === 0) {
						errors.push(`Activity '${key}' of type '${activity.type}' must have a non-empty 'activities' array`);
					} else {
						for (const r of arr) {
							const id = extractRef(r);
							if (!id || !activityKeys.has(id)) {
								errors.push(`Activity '${key}' references unknown activity '${r}'`);
							}
						}
					}
					break;

				case 'branch':
					const thenRef = extractRef((activity as any).then);
					const elseRef = extractRef((activity as any).else);
					if (!thenRef || !activityKeys.has(thenRef)) {
						errors.push(`Activity '${key}' branch 'then' reference '${(activity as any).then}' is invalid`);
					}
					if (elseRef && !activityKeys.has(elseRef)) {
						errors.push(`Activity '${key}' branch 'else' reference '${(activity as any).else}' is invalid`);
					}
					break;

				case 'switch':
					const cases = (activity as any).cases as { [k: string]: string } | undefined;
					if (!cases || typeof cases !== 'object' || Object.keys(cases).length === 0) {
						errors.push(`Activity '${key}' of type 'switch' must have a non-empty 'cases' object`);
					} else {
						for (const [caseKey, caseRef] of Object.entries(cases || {})) {
							const id = extractRef(caseRef);
							if (!id || !activityKeys.has(id)) {
								errors.push(`Activity '${key}' switch case '${caseKey}' references unknown activity '${caseRef}'`);
							}
						}
					}
					const defaultRef = extractRef((activity as any).default);
					if (defaultRef && !activityKeys.has(defaultRef)) {
						errors.push(`Activity '${key}' switch default reference '${(activity as any).default}' is invalid`);
					}
					break;
			}
		}

		return { valid: errors.length === 0, errors, warnings };
	}

	/**
	 * Extract field/variable references from a line of code
	 * Looks for patterns like a:activityId.v:variableName (new) and a:activityId.f:fieldName (legacy)
	 */
	private extractFieldReferences(codeLine: string): string[] {
		// New syntax: a:activityId.v:variableName
	const { ACTIVITY_VAR_PATTERN, ACTIVITY_FIELD_PATTERN } = require('./utils/patterns');
	const variableRefPattern = ACTIVITY_VAR_PATTERN;
	// Legacy syntax: a:activityId.f:fieldName
	const fieldRefPattern = ACTIVITY_FIELD_PATTERN;
		const references: string[] = [];
		let match;

		// Extract variable references (new syntax)
		while ((match = variableRefPattern.exec(codeLine)) !== null) {
			references.push(`a:${match[1]}.v:${match[2]}`);
		}

		// Extract field references (legacy syntax)
		fieldRefPattern.lastIndex = 0; // Reset regex state
		while ((match = fieldRefPattern.exec(codeLine)) !== null) {
			references.push(`a:${match[1]}.f:${match[2]}`);
		}

		return references;
	}

	/**
	 * Validate a variable reference against the process definition
	 * Returns error message if invalid, null if valid
	 */
	private validateFieldReference(fieldRef: string, processDefinition: ProcessDefinition): string | null {
		// Handle variable syntax: a:activityId.v:variableName
	const variableMatch = fieldRef.match(/^a:([a-zA-Z0-9_-]+)\.v:([a-zA-Z0-9_-]+)$/);
		if (variableMatch) {
			const [, activityId, variableName] = variableMatch;
			return this.validateActivityVariableReference(activityId, variableName, processDefinition, fieldRef);
		}

		return `Invalid reference format: ${fieldRef} (expected a:activityId.v:variableName)`;
	}

	/**
	 * Validate activity variable reference (new syntax)
	 */
	private validateActivityVariableReference(activityId: string, variableName: string, processDefinition: ProcessDefinition, fullRef: string): string | null {
		// Check if activity exists
		const activity = processDefinition.activities?.[activityId];
		if (!activity) {
			return `Variable reference '${fullRef}' references unknown activity '${activityId}'`;
		}

		// For now, we'll allow variable references to any activity type
		// In the future, we could validate against expected variables for each activity type
		// For example, human activities would have variables based on their inputs
		// compute activities would have variables based on their outputs
		
		return null; // Valid reference (permissive validation for now)
	}

	normalize(processDefinition: ProcessDefinition): void {
		if (!processDefinition || !processDefinition.activities) return;

		for (const [activityKey, activity] of Object.entries(processDefinition.activities)) {
			if (!activity.id) {
				activity.id = activityKey;
			} else if (activity.id !== activityKey) {
				logger.error(`ProcessNormalizer: Activity map key '${activityKey}' does not match activity.id '${activity.id}' - using map key`, {
					processId: processDefinition.id
				});
				activity.id = activityKey;
			}

			// Normalize fields: checkbox -> boolean
			if ((activity as any).inputs && Array.isArray((activity as any).inputs)) {
				for (const f of (activity as any).inputs) {
					if (f && f.type === 'checkbox') {
						f.type = 'boolean';
					}
				}
			}
		}
	}
}

export default new ProcessNormalizer();
