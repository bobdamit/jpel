import { ProcessInstance } from './types';
import { logger } from './logger';

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

	executeCode(codeLines: string[], instance: ProcessInstance, currentActivityId: string): any {
		try {
			const context = this.createEvaluationContext(instance, currentActivityId);

			// Translate all lines to a single JavaScript code block so declarations
			// (const/let/var) persist across lines. Previously each line was
			// evaluated in its own function which meant local variables were not
			// preserved and assignments like `v:x = a && b;` failed when relying
			// on previously-declared temps.
			const jsCodeBlock = codeLines.map(line => this.translateJPELToJS(line, instance)).join('\n');

			// (debug output removed)

			// Determine properties assigned to `this.xxx` so we can return only
			// those properties (preserves previous behaviour where callers
			// received an object containing just the assigned fields).
			const thisProps = new Set<string>();
			for (const line of codeLines) {
				const m = line.match(/this\.([a-zA-Z0-9_]+)\s*=/);
				if (m) thisProps.add(m[1]);
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
	 * Extracts data from typed activity instances for expression evaluation
	 */
	private getActivityData(activity: any): any {
		if (!activity) return {};
		
		// Return data based on activity type
		if (activity.formData) {
			// HumanActivityInstance
			return activity.formData;
		} else if (activity.responseData) {
			// APIActivityInstance  
			return activity.responseData;
		} else if (activity.computedValues) {
			// ComputeActivityInstance
			return activity.computedValues;
		} else if (activity.sequenceIndex !== undefined) {
			// SequenceActivityInstance
			return { sequenceIndex: activity.sequenceIndex, activities: activity.sequenceActivities };
		} else if (activity.parallelState) {
			// ParallelActivityInstance
			return { parallelState: activity.parallelState, activeActivities: activity.activeActivities, completedActivities: activity.completedActivities };
		} else if (activity.conditionResult !== undefined) {
			// BranchActivityInstance
			return { conditionResult: activity.conditionResult, nextActivity: activity.nextActivity };
		} else if (activity.expressionValue !== undefined) {
			// SwitchActivityInstance
			return { expressionValue: activity.expressionValue, matchedCase: activity.matchedCase, nextActivity: activity.nextActivity };
		}
		
		return {};
	}

	private createEvaluationContext(instance: ProcessInstance, currentActivityId?: string): any {
		const context: any = {
			// Process variables
			process: instance.variables,

			// Complete instance object for full access
			instance: instance,

			// Current activity context
			currentActivity: currentActivityId ? this.getActivityData(instance.activities[currentActivityId]) : {},

			// Helper functions
			Math,
			console: {
				log: (...args: any[]) => {
					// Use process.stdout instead of console for Node.js
					process.stdout.write(`[Process ${instance.instanceId}] ${args.join(' ')}\n`);
				}
			},

			// getValue function for JPEL field/variable access
			getValue: (reference: string) => {
				if (reference.startsWith('a:')) {
					// Activity field reference: a:activityId.f:fieldName
					const activityMatch = reference.match(/^a:(\w+)\.f:(\w+)$/);
					if (activityMatch) {
						const [, activityId, fieldName] = activityMatch;
						const activityData = this.getActivityData(instance.activities[activityId]);
						return activityData?.[fieldName];
					}
				} else if (reference.startsWith('v:')) {
					// Variable reference: v:variableName
					const variableName = reference.substring(2);
					return instance.variables[variableName];
				} else if (reference.startsWith('var:')) {
					// Variable reference: var:variableName
					const variableName = reference.substring(4);
					return instance.variables[variableName];
				}
				return undefined;
			}
		};

		// Add activity data accessors for backward compatibility
		context.activities = {};
		Object.keys(instance.activities).forEach(activityId => {
			const activity = instance.activities[activityId];
			const activityData = this.getActivityData(activity);

			// Ensure the runtime activity instance exposes an f property that maps
			// to the most relevant data (formData/responseData/computedValues)
			// so scripts can access fields via `.f` and also write back.
			if (!(activity as any).f) {
				(activity as any).f = activityData || {};
			}

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

	private translateJPELToJS(expression: string, instance: ProcessInstance): string {
		// Split by quotes to avoid replacing inside string literals
		const parts = expression.split(/(".*?")/);
		const translatedParts = parts.map(part => {
			// Only translate if not inside quotes (even parts are outside quotes)
			if (!part.startsWith('"') && !part.endsWith('"')) {
				// Replace a:activityId.f:fieldName with activities["activityId"].f["fieldName"]
				// Allow word characters and hyphens for both activity IDs and field names
				part = part.replace(/a:([a-zA-Z0-9_-]+)\.f:([a-zA-Z0-9_-]+)/g, (m, activityId, fieldName) => {
					return `activities[${JSON.stringify(activityId)}].f[${JSON.stringify(fieldName)}]`;
				});

				// Replace a:activityId.property with activities["activityId"].property
				part = part.replace(/a:([a-zA-Z0-9_-]+)\.(\w+)/g, (m, activityId, prop) => {
					return `activities[${JSON.stringify(activityId)}].${prop}`;
				});

				// Replace v:variableName = value with process.variableName = value (use bracket if needed)
				part = part.replace(/v:([^\.\s]+)\s*=/g, (m, varName) => {
					if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(varName)) return `process.${varName} =`;
					return `process[${JSON.stringify(varName)}] =`;
				});

				// Replace var:variableName = value with process.variableName = value
				part = part.replace(/var:([^\.\s]+)\s*=/g, (m, varName) => {
					if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(varName)) return `process.${varName} =`;
					return `process[${JSON.stringify(varName)}] =`;
				});

				// Replace v:variableName (reading) with process.variableName (or bracket)
				part = part.replace(/v:([^\.\s]+)/g, (m, varName) => {
					if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(varName)) return `process.${varName}`;
					return `process[${JSON.stringify(varName)}]`;
				});

				// Replace var:variableName (reading) with process.variableName
				part = part.replace(/var:([^\.\s]+)/g, (m, varName) => {
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

	private safeEval(expression: string, context: any): any {
		// Create a function with the context as parameters
		const paramNames = Object.keys(context);
		const paramValues = Object.values(context);

	// Minimal debug via centralized logger
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