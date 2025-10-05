import { ProcessInstance } from './types';

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

			// Debug: show the actual JS code block we're about to execute.
			// Emit debug to stderr (not mocked by tests) so we can inspect during CI/test runs
			try {
				process.stderr.write('--- JS CODE BLOCK ---\n');
				process.stderr.write(jsCodeBlock + '\n');
				process.stderr.write('--- CONTEXT.process BEFORE ---\n' + JSON.stringify(context.process) + '\n');
			} catch (err) {
				// swallow if write not available
			}

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

			try {
				process.stderr.write('--- CONTEXT.process AFTER ---\n' + JSON.stringify(context.process) + '\n');
			} catch (err) {
				// swallow
			}

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
			throw new Error(`Code execution failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	private createEvaluationContext(instance: ProcessInstance, currentActivityId?: string): any {
		const context: any = {
			// Process variables
			process: instance.variables,

			// Complete instance object for full access
			instance: instance,

			// Current activity context
			currentActivity: currentActivityId ? (instance.activities[currentActivityId].data || {}) : {},

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
						return instance.activities[activityId]?.data?.[fieldName];
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
		Object.keys(instance.activities).forEach(activityId => {
			const activity = instance.activities[activityId];
			if (activity.data) {
				context[activityId] = {
					f: activity.data, // Field data
					status: activity.status,
					passFail: activity.passFail
				};
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
				// Replace a:activityId.f:fieldName with activityId.f.fieldName
				part = part.replace(/a:(\w+)\.f:(\w+)/g, '$1.f.$2');

				// Replace a:activityId.property with activityId.property
				part = part.replace(/a:(\w+)\.(\w+)/g, '$1.$2');

				// Replace v:variableName = value with process.variableName = value
				part = part.replace(/v:(\w+)\s*=/g, 'process.$1 =');

				// Replace var:variableName = value with process.variableName = value
				part = part.replace(/var:(\w+)\s*=/g, 'process.$1 =');

				// Replace v:variableName (reading) with process.variableName
				part = part.replace(/v:(\w+)/g, 'process.$1');

				// Replace var:variableName (reading) with process.variableName
				part = part.replace(/var:(\w+)/g, 'process.$1');

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

		console.log('=== SAFE EVAL DEBUG ===');
		console.log('Expression to evaluate:', expression);
		console.log('Param names:', paramNames);
		console.log('Checking instance param:', context.instance ? 'EXISTS' : 'MISSING');
		if (context.instance) {
			console.log('Instance.activities keys:', Object.keys(context.instance.activities || {}));
			if (context.instance.activities?.reviewDocument) {
				console.log('ReviewDocument in instance:', context.instance.activities.reviewDocument);
			}
		}
		console.log('=======================');

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
			console.log('Expression evaluation result:', result);
			return result;
		} catch (error) {
			console.log('Expression evaluation error:', error);
			// If it's not an expression, try as a statement
			try {
				const func = new Function(...paramNames, expression);
				const result = func(...paramValues);
				console.log('Statement evaluation result:', result);
				return result;
			} catch (statementError) {
				console.log('Statement evaluation error:', statementError);
				throw new Error(`Expression evaluation failed: ${expression}`);
			}
		}
	}
}