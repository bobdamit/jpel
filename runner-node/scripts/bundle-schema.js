#!/usr/bin/env node
// Bundles design/schema.yaml into design/schema-resolved.json
// - dereferences $refs
// - removes OpenAPI-only keywords like 'example' and 'examples'
// - writes a compact JSON Schema suitable for Ajv

const fs = require('fs');
const path = require('path');
const $RefParser = require('@apidevtools/json-schema-ref-parser');
const yaml = require('js-yaml');

async function stripExamples(obj) {
	if (!obj || typeof obj !== 'object') return obj;
	if (Array.isArray(obj)) {
		for (let i = 0; i < obj.length; i++) {
			obj[i] = await stripExamples(obj[i]);
		}
		return obj;
	}
	for (const k of Object.keys(obj)) {
		if (k === 'example' || k === 'examples') {
			delete obj[k];
			continue;
		}
		obj[k] = await stripExamples(obj[k]);
	}
	return obj;
}

(async () => {
	try {
		// scripts/ is located at runner-node/scripts, repo root is two levels up
		const repoRoot = path.resolve(__dirname, '..', '..');
		const designPath = path.join(repoRoot, 'design', 'schema.yaml');
		if (!fs.existsSync(designPath)) {
			console.error('design/schema.yaml not found');
			process.exit(2);
		}
		const raw = fs.readFileSync(designPath, 'utf8');
		const doc = yaml.load(raw);

		// Prefer the 'process' root node if present
		const schemaRoot = doc && doc.process ? doc.process : doc;

		// If the YAML uses OpenAPI-style components, attach them to definitions
		// on the chosen schema root and rewrite $ref pointers that target
		// '#/components/schemas/...' to '#/definitions/...'. This mirrors the
		// behavior in the runtime normalizer and allows dereference to succeed.
		if (doc && doc.components && doc.components.schemas) {
			if (!schemaRoot.definitions) schemaRoot.definitions = {};
			Object.assign(schemaRoot.definitions, doc.components.schemas);

			const rewriteRefs = (obj) => {
				if (!obj || typeof obj !== 'object') return;
				if (Array.isArray(obj)) {
					for (let i = 0; i < obj.length; i++) rewriteRefs(obj[i]);
					return;
				}
				for (const k of Object.keys(obj)) {
					const v = obj[k];
					if (k === '$ref' && typeof v === 'string' && v.startsWith('#/components/schemas/')) {
						obj[k] = v.replace('#/components/schemas/', '#/definitions/');
					} else if (typeof v === 'object' && v !== null) {
						rewriteRefs(v);
					}
				}
			};

			rewriteRefs(schemaRoot);
		}

		// Use json-schema-ref-parser to dereference (bundle) all $refs
		const deref = await $RefParser.dereference(schemaRoot, {
			// options: keep anchor names, etc.
		});

		// Remove OpenAPI-specific example/examples
		await stripExamples(deref);

		// Make small compatibility tweaks: ensure definitions exist
		if (!deref.definitions) deref.definitions = {};

		// Compatibility tweaks to match previous runtime behavior:
		// - Allow 'string' in Variable.type enum (some processes use 'string')
		// - Ensure Activity.type is freely a string (tests use unknown types)
		// - Remove 'id' from Activity.required because activity map keys are used as ids
		try {
			const defs = deref.definitions || {};
			if (defs.Variable && defs.Variable.properties && defs.Variable.properties.type && Array.isArray(defs.Variable.properties.type.enum)) {
				const enumArr = defs.Variable.properties.type.enum;
				if (!enumArr.includes('string')) enumArr.push('string');
				if (!enumArr.includes('text')) enumArr.push('text');
			}
			if (defs.Activity && defs.Activity.properties) {
				defs.Activity.properties.type = { type: 'string' };
			}
			if (defs.Activity && Array.isArray(defs.Activity.required)) {
				defs.Activity.required = defs.Activity.required.filter((r) => r !== 'id');
			}
		} catch (e) {
			// ignore
		}

		// Write the resolved JSON schema (combined)
		const outPath = path.join(repoRoot, 'design', 'schema-resolved.json');
		fs.writeFileSync(outPath, JSON.stringify(deref, null, 2), 'utf8');
		console.log('Wrote', outPath);

		// Also write a canonical JSON schema artifact that some users expect
		// at design/schema.json (same content). This makes it easy to inspect
		// the JSON Schema without the extra '-resolved' suffix.
		const outJsonPath = path.join(repoRoot, 'design', 'schema.json');
		fs.writeFileSync(outJsonPath, JSON.stringify(deref, null, 2), 'utf8');
		console.log('Wrote', outJsonPath);

		// Additionally produce a process-only resolved artifact if the original
		// YAML has a top-level `process` node. This is useful when the repo
		// splits runtime/instance schemas out and we want a focused validator
		// for process templates only.
		if (doc && doc.process) {
			const processRoot = doc.process;

			if (doc.components && doc.components.schemas) {
				if (!processRoot.definitions) processRoot.definitions = {};
				Object.assign(processRoot.definitions, doc.components.schemas);
				const rewriteRefs = (obj) => {
					if (!obj || typeof obj !== 'object') return;
					if (Array.isArray(obj)) {
						for (let i = 0; i < obj.length; i++) rewriteRefs(obj[i]);
						return;
					}
					for (const k of Object.keys(obj)) {
						const v = obj[k];
						if (k === '$ref' && typeof v === 'string' && v.startsWith('#/components/schemas/')) {
							obj[k] = v.replace('#/components/schemas/', '#/definitions/');
						} else if (typeof v === 'object' && v !== null) {
							rewriteRefs(v);
						}
					}
				};
				rewriteRefs(processRoot);
			}

			const derefProcess = await $RefParser.dereference(processRoot);
			await stripExamples(derefProcess);

			// Same compatibility tweaks as above
			try {
				const defs = derefProcess.definitions || {};
				if (defs.Variable && defs.Variable.properties && defs.Variable.properties.type && Array.isArray(defs.Variable.properties.type.enum)) {
					const enumArr = defs.Variable.properties.type.enum;
					if (!enumArr.includes('string')) enumArr.push('string');
					if (!enumArr.includes('text')) enumArr.push('text');
				}
				if (defs.Activity && defs.Activity.properties) {
					defs.Activity.properties.type = { type: 'string' };
				}
				if (defs.Activity && Array.isArray(defs.Activity.required)) {
					defs.Activity.required = defs.Activity.required.filter((r) => r !== 'id');
				}
			} catch (e) {
				// ignore
			}

			const outProcessPath = path.join(repoRoot, 'design', 'schema-process-resolved.json');
			fs.writeFileSync(outProcessPath, JSON.stringify(derefProcess, null, 2), 'utf8');
			console.log('Wrote', outProcessPath);

			const outProcessJson = path.join(repoRoot, 'design', 'schema-process.json');
			fs.writeFileSync(outProcessJson, JSON.stringify(derefProcess, null, 2), 'utf8');
			console.log('Wrote', outProcessJson);
		}
	} catch (err) {
		console.error('Failed to bundle schema:', err && err.message ? err.message : err);
		process.exit(1);
	}
})();
