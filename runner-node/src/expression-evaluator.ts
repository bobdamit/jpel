import { ProcessInstance } from './types';

export class ExpressionEvaluator {

	evaluateCondition(condition: string, instance: ProcessInstance): boolean {
		try {
			// Create a safe evaluation context
			const context = this.createEvaluationContext(instance);

			// Debug logging to see what data is available
			console.log('=== CONDITION EVALUATION DEBUG ===');
			console.log('Condition:', condition);
			console.log('Instance activities:', Object.keys(instance.activities));
			console.log('ReviewDocument activity:', instance.activities.reviewDocument);
			if (instance.activities.reviewDocument) {
				console.log('ReviewDocument data:', instance.activities.reviewDocument.data);
				console.log('ReviewDocument status:', instance.activities.reviewDocument.status);
			}
			console.log('Context keys:', Object.keys(context));
			console.log('===================================');

			// Replace JPEL syntax with JavaScript
			const jsExpression = this.translateJPELToJS(condition, instance);
			console.log('Translated JS expression:', jsExpression);

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

			let result: any = {};

			for (const line of codeLines) {
				const jsCode = this.translateJPELToJS(line, instance);
				const lineResult = this.safeEval(jsCode, context);

				// If the line assigns to 'this', capture it
				if (line.includes('this.')) {
					// Extract assignments to 'this' and update result
					const thisMatch = line.match(/this\.(\w+)\s*=\s*(.+);?$/);
					if (thisMatch) {
						const [, property] = thisMatch;
						result[property] = context.currentActivity[property];
					}
				}
			}

			return Object.keys(result).length > 0 ? result : context.currentActivity;
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
		let jsExpression = expression;

		// Replace a:activityId.f:fieldName with activityId.f.fieldName
		jsExpression = jsExpression.replace(/a:(\w+)\.f:(\w+)/g, '$1.f.$2');

		// Replace a:activityId.property with activityId.property
		jsExpression = jsExpression.replace(/a:(\w+)\.(\w+)/g, '$1.$2');

		// Replace v:variableName = value with process.variableName = value
		jsExpression = jsExpression.replace(/v:(\w+)\s*=/g, 'process.$1 =');

		// Replace var:variableName = value with process.variableName = value
		jsExpression = jsExpression.replace(/var:(\w+)\s*=/g, 'process.$1 =');

		// Replace v:variableName (reading) with process.variableName
		jsExpression = jsExpression.replace(/v:(\w+)/g, 'process.$1');

		// Replace var:variableName (reading) with process.variableName
		jsExpression = jsExpression.replace(/var:(\w+)/g, 'process.$1');

		// Replace this.property with currentActivity.property
		jsExpression = jsExpression.replace(/this\.(\w+)/g, 'currentActivity.$1');

		// Replace process.variable with process.variable
		// (already correct format)

		return jsExpression;
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
			// Create and execute the function
			const func = new Function(...paramNames, `return ${expression}`);
			const result = func(...paramValues);
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