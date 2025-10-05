import { ProcessEngine } from '../src/process-engine';
import { 
    ProcessDefinition, 
    ProcessStatus, 
    ActivityStatus, 
    ActivityType,
    Field,
    FieldValue,
    FieldType,
    HumanActivity
} from '../src/types';
import { RepositoryFactory } from '../src/repositories/repository-factory';

describe('ProcessEngine FieldValue Architecture', () => {
    let processEngine: ProcessEngine;
    
    const sampleProcess: ProcessDefinition = {
        id: 'test-fieldvalue-process',
        name: 'Test FieldValue Process',
        description: 'Test process for FieldValue architecture',
        version: '1.0.0',
        start: 'a:userForm',
        activities: {
            userForm: {
                id: 'userForm',
                name: 'User Form',
                type: ActivityType.Human,
                prompt: 'Please fill out the form:',
                inputs: [
                    {
                        name: 'userName',
                        type: FieldType.Text,
                        required: true,
                        defaultValue: 'Default Name',
                        description: 'User name field'
                    },
                    {
                        name: 'userAge',
                        type: FieldType.Number,
                        required: false,
                        defaultValue: 25,
                        min: 0,
                        max: 120
                    },
                    {
                        name: 'isActive',
                        type: FieldType.Boolean,
                        required: false,
                        defaultValue: true
                    }
                ]
            } as HumanActivity,
            complete: {
                id: 'complete',
                name: 'Complete',
                type: ActivityType.Terminate
            }
        }
    };

    beforeEach(async () => {
        // Initialize in-memory repositories
        RepositoryFactory.initializeInMemory();
        processEngine = new ProcessEngine();
        
        // Load the test process
        await processEngine.loadProcess(sampleProcess);
    });

    describe('Field to FieldValue Conversion', () => {
        test('should convert Field[] to FieldValue[] when creating process instance', async () => {
            // Create a new instance
            const result = await processEngine.createInstance('test-fieldvalue-process');
            
            expect(result.status).toBe(ProcessStatus.Running);
            expect(result.instanceId).toBeDefined();
            expect(result.humanTask).toBeDefined();
            
            // Check that the human task contains FieldValue objects
            const fields = result.humanTask!.fields;
            expect(fields).toHaveLength(3);
            
            // Verify each field is a FieldValue (has 'value' property)
            fields.forEach(field => {
                expect(field).toHaveProperty('value');
                expect(field).toHaveProperty('name');
                expect(field).toHaveProperty('type');
            });
            
            // Verify default values are set
            expect(fields[0].name).toBe('userName');
            expect(fields[0].value).toBe('Default Name');
            
            expect(fields[1].name).toBe('userAge');
            expect(fields[1].value).toBe(25);
            
            expect(fields[2].name).toBe('isActive');
            expect(fields[2].value).toBe(true);
        });

        test('should store FieldValue[] in activity instance, not just Field[]', async () => {
            // Create instance
            const result = await processEngine.createInstance('test-fieldvalue-process');
            const instanceId = result.instanceId;
            
            // Get the instance and check activity structure
            const instance = await processEngine.getInstance(instanceId);
            expect(instance).toBeDefined();
            
            const userFormActivity = instance!.activities['userForm'];
            expect(userFormActivity).toBeDefined();
            
            // Check that the activity instance has FieldValue[] inputs
            const inputs = (userFormActivity as any).inputs;
            expect(inputs).toBeDefined();
            expect(Array.isArray(inputs)).toBe(true);
            expect(inputs).toHaveLength(3);
            
            // Verify each input is a FieldValue
            inputs.forEach((input: any) => {
                expect(input).toHaveProperty('value');
                expect(input).toHaveProperty('name');
                expect(input).toHaveProperty('type');
            });
        });
    });

    describe('FieldValue Persistence', () => {
        test('should update FieldValue objects when submitting human task', async () => {
            // Create instance
            const createResult = await processEngine.createInstance('test-fieldvalue-process');
            const instanceId = createResult.instanceId;
            
            // Submit form data
            const submissionData = {
                userName: 'John Doe',
                userAge: 30,
                isActive: false
            };
            
            const submitResult = await processEngine.submitHumanTask(
                instanceId, 
                'userForm', 
                submissionData
            );
            
            expect(submitResult.status).not.toBe(ProcessStatus.Failed);
            
            // Get the updated instance
            const instance = await processEngine.getInstance(instanceId);
            const userFormActivity = instance!.activities['userForm'];
            
            // Check that FieldValue objects were updated
            const inputs = (userFormActivity as any).inputs;
            expect(inputs).toHaveLength(3);
            
            const userNameField = inputs.find((f: FieldValue) => f.name === 'userName');
            const userAgeField = inputs.find((f: FieldValue) => f.name === 'userAge');
            const isActiveField = inputs.find((f: FieldValue) => f.name === 'isActive');
            
            expect(userNameField.value).toBe('John Doe');
            expect(userAgeField.value).toBe(30);
            expect(isActiveField.value).toBe(false);
            
            // Also check that form data is stored in activity.formData
            expect((userFormActivity as any).formData).toBeDefined();
            expect((userFormActivity as any).formData!.userName).toBe('John Doe');
            expect((userFormActivity as any).formData!.userAge).toBe(30);
            expect((userFormActivity as any).formData!.isActive).toBe(false);
        });
    });

    describe('FieldValue Preservation in Re-runs', () => {
        test('should preserve FieldValue data when re-running instance', async () => {
            // Create and complete an instance
            const createResult = await processEngine.createInstance('test-fieldvalue-process');
            const originalInstanceId = createResult.instanceId;
            
            // Submit form data
            const originalData = {
                userName: 'Alice Smith',
                userAge: 28,
                isActive: true
            };
            
            await processEngine.submitHumanTask(
                originalInstanceId, 
                'userForm', 
                originalData
            );
            
            // Re-run the instance (should reuse the same instance, not create a new one)
            const rerunResult = await processEngine.reRunInstance(originalInstanceId);
            expect(rerunResult.status).not.toBe(ProcessStatus.Failed);
            
            // The instance ID should be the SAME (re-run reuses the instance)
            expect(rerunResult.instanceId).toBe(originalInstanceId);
            
            // Check that the instance has the preserved values from the previous run
            expect(rerunResult.humanTask).toBeDefined();
            const fields = rerunResult.humanTask!.fields;
            
            const userNameField = fields.find(f => f.name === 'userName');
            const userAgeField = fields.find(f => f.name === 'userAge');
            const isActiveField = fields.find(f => f.name === 'isActive');
            
            expect(userNameField!.value).toBe('Alice Smith');
            expect(userAgeField!.value).toBe(28);
            expect(isActiveField!.value).toBe(true);
        });

        test('should use default values for fields not present in original instance', async () => {
            // Create an instance and only submit partial data
            const createResult = await processEngine.createInstance('test-fieldvalue-process');
            const originalInstanceId = createResult.instanceId;
            
            // Submit only userName
            const partialData = {
                userName: 'Partial User'
                // userAge and isActive not provided
            };
            
            await processEngine.submitHumanTask(
                originalInstanceId, 
                'userForm', 
                partialData
            );
            
            // Re-run the instance
            const rerunResult = await processEngine.reRunInstance(originalInstanceId);
            const fields = rerunResult.humanTask!.fields;
            
            const userNameField = fields.find(f => f.name === 'userName');
            const userAgeField = fields.find(f => f.name === 'userAge');
            const isActiveField = fields.find(f => f.name === 'isActive');
            
            // Submitted field should be preserved
            expect(userNameField!.value).toBe('Partial User');
            
            // Non-submitted fields should have their default values
            expect(userAgeField!.value).toBe(25); // default value
            expect(isActiveField!.value).toBe(true); // default value
        });
    });

    describe('API Consistency', () => {
        test('should return FieldValue[] from executeHumanActivity', async () => {
            const result = await processEngine.createInstance('test-fieldvalue-process');
            
            expect(result.humanTask).toBeDefined();
            expect(result.humanTask!.fields).toHaveLength(3);
            
            // All fields should be FieldValue objects
            result.humanTask!.fields.forEach(field => {
                expect(field).toHaveProperty('value');
                expect(field).toHaveProperty('name');
                expect(field).toHaveProperty('type');
            });
        });

        test('should maintain FieldValue structure after re-run', async () => {
            // Create and complete an instance first
            const createResult = await processEngine.createInstance('test-fieldvalue-process');
            const instanceId = createResult.instanceId;
            
            // Submit the form with data
            await processEngine.submitHumanTask(instanceId, 'userForm', {
                userName: 'Context User',
                userAge: 35,
                isActive: true
            });
            
            // Re-run the instance (should reset to beginning but keep data)
            const reRunResult = await processEngine.reRunInstance(instanceId);
            
            expect(reRunResult.humanTask).toBeDefined();
            const fields = reRunResult.humanTask!.fields;
            
            // Check that previous data is still in FieldValue objects after re-run
            const userNameField = fields.find(f => f.name === 'userName');
            const userAgeField = fields.find(f => f.name === 'userAge');
            const isActiveField = fields.find(f => f.name === 'isActive');
            
            expect(userNameField!.value).toBe('Context User');
            expect(userAgeField!.value).toBe(35);
            expect(isActiveField!.value).toBe(true); // default value (not in context)
        });
    });

    describe('Type Safety', () => {
        test('should maintain proper TypeScript types for FieldValue objects', async () => {
            const result = await processEngine.createInstance('test-fieldvalue-process');
            const fields = result.humanTask!.fields;
            
            // TypeScript compilation should ensure these are FieldValue objects
            fields.forEach(field => {
                // These properties should exist due to FieldValue interface
                expect(typeof field.name).toBe('string');
                expect(typeof field.type).toBe('string');
                expect(field.value).toBeDefined(); // value property is key difference
                
                // Properties from Field interface should also exist
                if (field.required !== undefined) {
                    expect(typeof field.required).toBe('boolean');
                }
                if (field.defaultValue !== undefined) {
                    expect(field.defaultValue).toBeDefined();
                }
            });
        });
    });
});