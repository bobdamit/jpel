import { ProcessInstance } from './types';

export class ExpressionEvaluator {
  
  evaluateCondition(condition: string, instance: ProcessInstance): boolean {
    try {
      // Create a safe evaluation context
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
            result[property] = context.this[property];
          }
        }
      }
      
      return Object.keys(result).length > 0 ? result : context.this;
    } catch (error) {
      throw new Error(`Code execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private createEvaluationContext(instance: ProcessInstance, currentActivityId?: string): any {
    const context: any = {
      // Process variables
      process: instance.variables,
      
      // Current activity context
      this: currentActivityId ? (instance.activities[currentActivityId].data || {}) : {},
      
      // Helper functions
      Math,
      console: {
        log: (...args: any[]) => {
          // Use process.stdout instead of console for Node.js
          process.stdout.write(`[Process ${instance.instanceId}] ${args.join(' ')}\n`);
        }
      }
    };

    // Add activity data accessors
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
    
    // Replace process.variable with process.variable
    // (already correct format)
    
    return jsExpression;
  }

  private safeEval(expression: string, context: any): any {
    // Create a function with the context as parameters
    const paramNames = Object.keys(context);
    const paramValues = Object.values(context);
    
    try {
      // Create and execute the function
      const func = new Function(...paramNames, `return ${expression}`);
      return func(...paramValues);
    } catch (error) {
      // If it's not an expression, try as a statement
      try {
        const func = new Function(...paramNames, expression);
        return func(...paramValues);
      } catch (statementError) {
        throw new Error(`Expression evaluation failed: ${expression}`);
      }
    }
  }
}