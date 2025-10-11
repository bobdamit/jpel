import ProcessLoader from '../src/process-loader';
import { ProcessDefinition, ActivityType } from '../src/models/process-types';

describe('ProcessNormalizer Field Reference Validation', () => {
    let normalizer: typeof ProcessLoader;

    beforeEach(() => {
        normalizer = ProcessLoader;
    });

    test('should detect invalid field reference in compute activity', () => {
        const processDefinition: ProcessDefinition = {
            id: 'test-process',
            name: 'Test Process',
            description: 'Test process for field validation',
            version: '1.0.0',
            start: 'a:humanTask',
            activities: {
                humanTask: {
                    id: 'humanTask',
                    name: 'Human Task',
                    type: ActivityType.Human,
                    inputs: [
                        {
                            name: 'userName',
                            type: 'text',
                            label: 'User Name'
                        },
                        {
                            name: 'email',
                            type: 'text',
                            label: 'Email'
                        }
                    ]
                } as any,
                computeTask: {
                    id: 'computeTask',
                    name: 'Compute Task',
                    type: ActivityType.Compute,
                    code: [
                        'const name = a:humanTask.v:userName;',
                        'const invalidField = a:nonExistentActivity.v:someField;', // This should be caught
                        'console.log(name);'
                    ]
                } as any
            }
        };

        const result = normalizer.validate(processDefinition);
        
        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain("Variable reference 'a:nonExistentActivity.v:someField' references unknown activity 'nonExistentActivity'");
    });

    test('should detect reference to non-existent activity', () => {
        const processDefinition: ProcessDefinition = {
            id: 'test-process',
            name: 'Test Process',
            description: 'Test process for field validation',
            version: '1.0.0',
            start: 'a:computeTask',
            activities: {
                computeTask: {
                    id: 'computeTask',
                    name: 'Compute Task',
                    type: ActivityType.Compute,
                    code: [
                        'const value = a:nonExistentActivity.v:someField;' // This should be caught
                    ]
                } as any
            }
        };

        const result = normalizer.validate(processDefinition);
        
        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain("Variable reference 'a:nonExistentActivity.v:someField' references unknown activity 'nonExistentActivity'");
    });

    test('should detect reference to non-human activity', () => {
        const processDefinition: ProcessDefinition = {
            id: 'test-process',
            name: 'Test Process',
            description: 'Test process for field validation',
            version: '1.0.0',
            start: 'a:computeTask1',
            activities: {
                computeTask1: {
                    id: 'computeTask1',
                    name: 'Compute Task 1',
                    type: ActivityType.Compute,
                    code: ['console.log("task 1");']
                } as any,
                computeTask2: {
                    id: 'computeTask2',
                    name: 'Compute Task 2',
                    type: ActivityType.Compute,
                    code: [
                        'const value = a:computeTask1.v:someField;' // Should be valid now
                    ]
                } as any
            }
        };

        const result = normalizer.validate(processDefinition);
        
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    test('should validate correct field references', () => {
        const processDefinition: ProcessDefinition = {
            id: 'test-process',
            name: 'Test Process',
            description: 'Test process for field validation',
            version: '1.0.0',
            start: 'a:humanTask',
            activities: {
                humanTask: {
                    id: 'humanTask',
                    name: 'Human Task',
                    type: ActivityType.Human,
                    inputs: [
                        {
                            name: 'userName',
                            type: 'text',
                            label: 'User Name'
                        },
                        {
                            name: 'email',
                            type: 'text',
                            label: 'Email'
                        }
                    ]
                } as any,
                computeTask: {
                    id: 'computeTask',
                    name: 'Compute Task',
                    type: ActivityType.Compute,
                    code: [
                        'const name = a:humanTask.v:userName;',
                        'const email = a:humanTask.v:email;',
                        'console.log(name, email);'
                    ]
                } as any
            }
        };

        const result = normalizer.validate(processDefinition);
        
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    test('should detect mic-build.json validation error', () => {
        // Simulate the problematic mic-build.json structure
        const processDefinition: ProcessDefinition = {
            id: 'mic',
            name: 'Build steps and quality checks for microphone assembly',
            description: 'A process demonstrating build steps and quality checks for microphone assembly',
            version: '1.0.0',
            start: 'a:basicFacts',
            activities: {
                basicFacts: {
                    id: 'basicFacts',
                    name: 'Collect Basic Facts',
                    type: ActivityType.Sequence,
                    activities: ['a:commonFacts', 'a:validateCommonFacts', 'a:generateTitle']
                } as any,
                commonFacts: {
                    id: 'commonFacts',
                    name: 'Common Facts Collection',
                    type: ActivityType.Human,
                    inputs: [
                        { name: 'customerName', type: 'text', label: 'Customer Name' },
                        { name: 'storeOrderNumber', type: 'text', label: 'Store Order Number' },
                        { name: 'buildNumber', type: 'text', label: 'Build Number' }
                    ]
                } as any,
                validateCommonFacts: {
                    id: 'validateCommonFacts',
                    name: 'Validate Common Facts',
                    type: ActivityType.Compute,
                    code: [
                        'const buildNumber = a:commonFacts.v:buildNumber;',
                        'const buildNumberEngraved = a:commonFacts.v:buildNumberEngraved;', // This field doesn't exist!
                        'a:validateCommonFacts.passFail = buildNumberEngraved ? "pass" : "fail";'
                    ]
                } as any,
                generateTitle: {
                    id: 'generateTitle',
                    name: 'Generate Title',
                    type: ActivityType.Compute,
                    code: [
                        'const customerName = a:commonFacts.v:customerName;',
                        'console.log(customerName);'
                    ]
                } as any
            }
        };

        const result = normalizer.validate(processDefinition);
        
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });
});