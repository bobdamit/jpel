import { ExpressionEvaluator } from '../src/expression-evaluator';
import { createMockProcessInstance, createMockActivityInstance } from './setup';

describe('ExpressionEvaluator', () => {
  let evaluator: ExpressionEvaluator;
  let mockInstance: any;

  beforeEach(() => {
    evaluator = new ExpressionEvaluator();
    mockInstance = createMockProcessInstance({
      variables: {
        userName: 'John Doe',
        age: 30,
        isActive: true,
      },
      activities: {
        getUserName: createMockActivityInstance({
          variables: [{ name: 'userName', value: 'Jane Smith', type: 'text' }],
        }),
        checkAge: createMockActivityInstance({
          variables: [{ name: 'age', value: 25, type: 'number' }],
        }),
        confirmActive: createMockActivityInstance({
          variables: [{ name: 'isActive', value: false, type: 'boolean' }],
        }),
        testActivity: createMockActivityInstance({
          variables: [
            { name: 'name', value: 'Test User', type: 'text' },
            { name: 'email', value: 'test@example.com', type: 'text' }
          ],
        }),
      },
    });
  });

  describe('evaluateCondition', () => {
    it('should evaluate simple boolean expressions', () => {
      const result = evaluator.evaluateCondition('true', mockInstance);
      expect(result).toBe(true);
    });

    it('should evaluate variable references with v: syntax', () => {
      const result = evaluator.evaluateCondition('v:userName === "John Doe"', mockInstance);
      expect(result).toBe(true);
    });

    it('should evaluate variable references with var: syntax', () => {
      const result = evaluator.evaluateCondition('var:age > 25', mockInstance);
      expect(result).toBe(true);
    });

    it('should evaluate activity variable references', () => {
      const result = evaluator.evaluateCondition('a:getUserName.v:userName === "Jane Smith"', mockInstance);
      expect(result).toBe(true);
    });

    it('should evaluate complex expressions', () => {
      const result = evaluator.evaluateCondition('v:age >= 18 && a:confirmActive.v:isActive', mockInstance);
      expect(result).toBe(false); // age >= 18 is true, but isActive is false
    });

    it('should handle direct variable access', () => {
      const result = evaluator.evaluateCondition('v:userName === "John Doe"', mockInstance);
      expect(result).toBe(true);
    });

    it('should throw error for invalid expressions', () => {
      expect(() => {
        evaluator.evaluateCondition('invalid syntax {{{', mockInstance);
      }).toThrow('Condition evaluation failed');
    });
  });

  describe('executeCode', () => {
    it('should execute simple assignments', () => {
      const result = evaluator.executeCode(['v:userName = "Updated Name"'], mockInstance, 'testActivity');
      expect(mockInstance.variables.userName).toBe('Updated Name');
    });

    it('should execute variable assignments with var: syntax', () => {
      const result = evaluator.executeCode(['var:newVariable = "test value"'], mockInstance, 'testActivity');
      expect(mockInstance.variables.newVariable).toBe('test value');
    });

    it('should execute code with direct variable access', () => {
      const result = evaluator.executeCode([
        'v:processedName = a:getUserName.v:userName.toUpperCase()'
      ], mockInstance, 'testActivity');
      expect(mockInstance.variables.processedName).toBe('JANE SMITH');
    });

    it('should handle console.log calls', () => {
      // Import the mock stdout from setup
      const mockStdout = require('./setup').mockStdout || (process.stdout as any);
      mockStdout.write.mockClear();
      
      const result = evaluator.executeCode([
        'console.log("Test message")'
      ], mockInstance, 'testActivity');
      
      expect(mockStdout.write).toHaveBeenCalledWith('[Process test-instance-123] Test message\n');
    });

    it('should execute complex logic', () => {
      const result = evaluator.executeCode([
        'v:isAdult = a:checkAge.v:age >= 18',
        'v:category = v:isAdult ? "adult" : "minor"'
      ], mockInstance, 'testActivity');

      expect(mockInstance.variables.isAdult).toBe(true);
      expect(mockInstance.variables.category).toBe('adult');
    });

    it('should handle this.property assignments for current activity', () => {
      const result = evaluator.executeCode([
        'this.result = "completed"'
      ], mockInstance, 'testActivity');

      expect(result).toEqual({ result: 'completed' });
    });

    it('should throw error for invalid code', () => {
      expect(() => {
        evaluator.executeCode(['invalid syntax {{{'], mockInstance, 'testActivity');
      }).toThrow('Code execution failed');
    });
  });

  describe('JPEL syntax translation', () => {
    it('should translate activity variable references', () => {
      // Test the private translateJPELToJS method indirectly through evaluateCondition
      const result = evaluator.evaluateCondition('a:getUserName.v:userName === "Jane Smith"', mockInstance);
      expect(result).toBe(true);
    });

    it('should translate variable assignments', () => {
      evaluator.executeCode(['v:testVar = "test"'], mockInstance, 'testActivity');
      expect(mockInstance.variables.testVar).toBe('test');
    });

    it('should translate variable reads', () => {
      const result = evaluator.evaluateCondition('v:userName === "John Doe"', mockInstance);
      expect(result).toBe(true);
    });

    it('should translate this.property references', () => {
      const result = evaluator.executeCode(['this.testProp = "value"'], mockInstance, 'testActivity');
      expect(result).toEqual({ testProp: 'value' });
    });
  });

  describe('Direct variable access', () => {
    it('should retrieve activity variable values', () => {
      const result = evaluator.executeCode([
        'v:retrievedValue = a:getUserName.v:userName'
      ], mockInstance, 'testActivity');

      expect(mockInstance.variables.retrievedValue).toBe('Jane Smith');
    });

    it('should retrieve process variable values', () => {
      const result = evaluator.executeCode([
        'v:retrievedValue = v:userName'
      ], mockInstance, 'testActivity');

      expect(mockInstance.variables.retrievedValue).toBe('John Doe');
    });

    it('should handle undefined variables gracefully', () => {
      const result = evaluator.executeCode([
        'v:retrievedValue = a:getUserName.v:nonExistentField'
      ], mockInstance, 'testActivity');

      expect(mockInstance.variables.retrievedValue).toBeUndefined();
    });
  });
});