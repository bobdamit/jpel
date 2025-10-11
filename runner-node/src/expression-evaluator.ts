import { ActivityInstance, ProcessInstance } from './models/instance-types';
import { ACTIVITY_VAR_PATTERN, ACTIVITY_FIELD_PATTERN, ACTIVITY_PROP_PATTERN, PROCESS_VAR_PATTERN, mapVariablesArray } from './utils/patterns';
import { logger } from './logger';

/**
 * Strongly-typed evaluation context exposed to JPEL/JS execution.
 * Keep this permissive enough to allow dynamically-added activity ids
 * while providing useful intellisense and avoiding blanket `any`.
 */
export interface EvaluationContext {
	process: { [key: string]: any };
	instance: ProcessInstance;
	currentActivity: { [key: string]: any };
	activities: { [activityId: string]: any };
	Math: typeof Math;
	console: { log: (...args: any[]) => void };
	// allow dynamic top-level entries for activity shortcuts (e.g. myAct)
	[key: string]: any;
}


/**
 * Class for Evaluating and processing JPEL expressions
 * @author Bob D and AI
 */
export class ExpressionEvaluator {

	evaluateCondition(condition: string, instance: ProcessInstance): boolean {
		try {
			const context = this.createEvaluationContext(instance);

			// Replace JPEL syntax with JavaScript
			const jsExpression = this.translateJPELToJS(condition, instance);

			// Evaluate the expression
			const result = this.safeEval(jsExpression, context);

			return Boolean(result);
		} catch (error) {
			throw new Error(`Condition evaluation failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}


	/**
	 * Execute the javascript code associated with an activity.  
	 * @param codeLines Lines o' code
	 * @param instance The ProcessInstance
	 * @param currentActivityId The activity ID
	 * @returns 
	 */
	executeCode(codeLines: string[], instance: ProcessInstance, currentActivityId: string): any {
		try {
			const context = this.createEvaluationContext(instance, currentActivityId);

			// Translate all lines to a single JavaScript code block so declarations
			// (const/let/var) persist across lines. 
			const jsCodeBlock = codeLines.map(line => this.translateJPELToJS(line, instance)).join('\n');

			// (debug output removed)

			// Determine properties assigned to `this.xxx` so we can return only
			// those properties (preserves previous behaviour where callers
			// received an object containing just the assigned fields).
			const thisProps = new Set<string>();
			for (const line of codeLines) {
				const m = line.match(/this\.([a-zA-Z0-9_]+)\s*=/);
				if (m) { 
					thisProps.add(m[1]);
				}
			}

			// Execute the entire block. safeEval will try expression first then
			// fall back to statement execution, so this covers most compute scripts.
			const execResult = this.safeEval(jsCodeBlock, context);

			// (debug output removed)

			if (thisProps.size > 0) {
				const out: any = {};
				for (const p of Array.from(thisProps)) {
					out[p] = context.currentActivity[p];
				}
				return out;
			}

			// If the script returned some specific non-undefined result, surface it,
			// otherwise return the mutated currentActivity for compatibility.
			if (execResult !== undefined && execResult !== context.currentActivity) {
				return execResult;
			}

			return context.currentActivity;
		} catch (error) {
			// Log error with context so UI-visible failures also appear in logs
			const msg = error instanceof Error ? error.message : String(error);
			logger.error('Code execution failed', {
				instanceId: instance?.instanceId,
				currentActivityId,
				codePreview: (codeLines || []).join('\n').substring(0, 1000),
				error: msg
			});
			throw new Error(`Code execution failed: ${msg}`);
		}
	}


	/**
	 * Extract a map of variables from an activity.
	 * @param activity The activity to extract variables from
	 * @returns A map of variable names to values
	 */
	// Make this public so other modules (e.g. APIExecutor) can reuse the same
	// variables-array extraction logic and avoid duplication.
	public getActivityVariableState(activity?: ActivityInstance): Record<string, any> {
		if (!activity) return {};

		// Use the consistent variables array approach
		if (activity.variables && Array.isArray(activity.variables)) {
			const data: Record<string, any> = {};
			activity.variables.forEach((variable: any) => {
				data[variable.name] = variable.value;
			});
			return data;
		}
		return {};
	}

	/**
	 * Resolve inline template tokens inside a string by delegating to the pure util.
	 */
	public resolveInlineTemplate(text: string, instance: ProcessInstance): string {
		const { resolveInlineTemplate } = require('./utils/substitution');
		return resolveInlineTemplate(text, instance);
	}

	// Create a typed evaluation context to avoid using a blanket `any`
	private createEvaluationContext(instance: ProcessInstance, currentActivityId?: string): EvaluationContext {
		const context: EvaluationContext = {
			// Process variables
			process: instance.variables,

			// Complete instance object for full access
			instance: instance,

			// Current activity context
			currentActivity: currentActivityId ? this.getActivityVariableState(instance.activities[currentActivityId]) : {},

			// Helper functions
			Math,
			console: {
				log: (...args: any[]) => {
					// Use process.stdout instead of console for Node.js
					process.stdout.write(`[Process ${instance.instanceId}] ${args.join(' ')}\n`);
				}
			}
			,
			// activities map will be populated below
			activities: {}
		};

		// Add activity data accessors
		context.activities = {};
		Object.keys(instance.activities).forEach(activityId => {
			const activity = instance.activities[activityId];
			const activityData = this.getActivityVariableState(activity);

			// Ensure the runtime activity instance exposes a v property that maps
			// to variables for the a:activity.v:variable syntax
			// Always update the v property to ensure it has the latest values
			(activity as any).v = activityData || {};

			// Expose the actual activity instance so assignments (e.g. passFail)
			// mutate the runtime instance and will be persisted when the engine saves.
			context.activities[activityId] = activity as any;

			// Also expose top-level shortcut when the id is a valid JS identifier
			// but avoid exposing if the identifier is a JS reserved word which would
			// make it invalid as a function parameter name when we build the
			// evaluation function.
			const isIdentifier = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(activityId);
			const jsReserved = new Set([
				'break','case','catch','class','const','continue','debugger','default','delete','do','else','export','extends','finally','for','function','if','import','in','instanceof','let','new','return','super','switch','this','throw','try','typeof','var','void','while','with','yield','enum','await','implements','package','protected','static','interface','private','public'
			]);
			if (isIdentifier && !jsReserved.has(activityId)) {
				context[activityId] = context.activities[activityId];
			}
		});

		return context;
	}


	/**
	 * Translate a code expression from jpel into eval-able javascript giving
	 * access to the process variables and current activity variables.
	 * @param expression 
	 * @param instance 
	 * @returns 
	 */
	private translateJPELToJS(expression: string, instance: ProcessInstance): string {
		// Split by quotes to avoid replacing inside string literals
		const parts = expression.split(/(".*?")/);
		const translatedParts = parts.map(part => {
			// Only translate if not inside quotes (even parts are outside quotes)
			if (!part.startsWith('"') && !part.endsWith('"')) {
				// Replace a:activityId.v:variableName with activities["activityId"].v["variableName"]
				// Allow word characters and hyphens for both activity IDs and variable names
				part = part.replace(ACTIVITY_VAR_PATTERN, (m, activityId, variableName) => {
					return `activities[${JSON.stringify(activityId)}].v[${JSON.stringify(variableName)}]`;
				});

				// Reject legacy f: syntax - throw error instead of translating
				if (ACTIVITY_FIELD_PATTERN.test(part)) {
					throw new Error(`Legacy field syntax 'a:activity.f:field' is no longer supported. Use 'a:activity.v:variable' instead.`);
				}

				// Replace a:activityId.property with activities["activityId"].property
				part = part.replace(ACTIVITY_PROP_PATTERN, (m, activityId, prop) => {
					return `activities[${JSON.stringify(activityId)}].${prop}`;
				});

				// Replace v:variableName = value with process.variableName = value (use bracket if needed)
				part = part.replace(/v:([^\s\.=]+)\s*=/g, (m, varName) => {
					if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(varName)) return `process.${varName} =`;
					return `process[${JSON.stringify(varName)}] =`;
				});

				// Replace var:variableName = value with process.variableName = value
				part = part.replace(/var:([^\s\.=]+)\s*=/g, (m, varName) => {
					if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(varName)) return `process.${varName} =`;
					return `process[${JSON.stringify(varName)}] =`;
				});

				// Replace v:variableName (reading) with process.variableName (or bracket)
				part = part.replace(/v:([^\s\.]+)/g, (m, varName) => {
					if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(varName)) return `process.${varName}`;
					return `process[${JSON.stringify(varName)}]`;
				});

				// Replace var:variableName (reading) with process.variableName
				part = part.replace(/var:([^\s\.]+)/g, (m, varName) => {
					if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(varName)) return `process.${varName}`;
					return `process[${JSON.stringify(varName)}]`;
				});

				// Replace this.property with currentActivity.property
				part = part.replace(/this\.(\w+)/g, 'currentActivity.$1');
			}
			return part;
		});

		return translatedParts.join('');
	}

	private safeEval(expression: string, context: EvaluationContext): any {
		// Create a function with the context as parameters
		const paramNames = Object.keys(context);
		const paramValues = Object.values(context);

		logger.debug('Expression to evaluate (truncated):', expression && expression.length > 200 ? expression.substring(0,200) + '...' : expression);

		try {
			// If expression contains multiple lines or semicolons, treat it as a
			// block of statements (so declarations and side-effects persist).
			let result: any;
			if (expression.includes('\n') || expression.includes(';')) {
				const func = new Function(...paramNames, expression);
				result = func(...paramValues);
			} else {
				const func = new Function(...paramNames, `return ${expression}`);
				result = func(...paramValues);
			}
			logger.debug('Expression evaluation result:', result);
			return result;
		} catch (error) {
			logger.error('Expression evaluation error', {
				expression: expression.substring(0, 1000),
				instanceId: context?.instance?.instanceId,
				message: error instanceof Error ? error.message : String(error)
			});
			// If it's not an expression, try as a statement
			try {
				const func = new Function(...paramNames, expression);
				const result = func(...paramValues);
				logger.debug('Statement evaluation result:', result);
				return result;
			} catch (statementError) {
				logger.error('Statement evaluation error', {
					expression: expression.substring(0, 1000),
					instanceId: context?.instance?.instanceId,
					message: statementError instanceof Error ? statementError.message : String(statementError)
				});
				throw new Error(`Expression evaluation failed: ${expression}`);
			}
		}
	}
}