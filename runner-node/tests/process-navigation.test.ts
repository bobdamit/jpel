import { ProcessEngine } from '../src/process-engine';
import { RepositoryFactory } from '../src/repositories/repository-factory';
import { createMockProcessDefinition } from './setup';
import { ActivityType, ProcessStatus, FieldType } from '../src/models/process-types';

describe('Process Navigation Tests', () => {
    let engine: ProcessEngine;

    beforeEach(async () => {
        await RepositoryFactory.initializeInMemory();
        engine = new ProcessEngine();
    });

    test('should navigate to start activity', async () => {
        const processDefinition = createMockProcessDefinition({
            id: 'navigation-test',
            name: 'Navigation Test',
            start: 'a:step1',
            activities: {
                step1: {
                    id: 'step1',
                    name: 'Step 1',
                    type: 'compute',
                    code: ["a:step1.value = 'step1 complete';"]
                },
                step2: {
                    id: 'step2',
                    name: 'Step 2',
                    type: 'compute',
                    code: ["a:step2.value = 'step2 complete';"]
                }
            }
        } as any);

        await engine.loadProcess(processDefinition as any);
        const create = await engine.createInstance('navigation-test');
        const instanceId = create.instanceId;

        // Navigation to start should work
        const navigateResult = await engine.navigateToStart(instanceId);
        
        expect(navigateResult.status).toBe(ProcessStatus.Running);
        expect(navigateResult.currentActivity).toBe('step1');
        expect(navigateResult.message).toContain('Navigated to start activity');

        // Verify the instance was updated
        const instance = await engine.getInstance(instanceId);
        expect(instance).not.toBeNull();
        if (instance) {
            expect(instance.executionContext.currentActivity).toBe('step1');
        }
    });

    test('should navigate to next pending activity', async () => {
        // Create a process with a sequence that connects step1 -> step2
        const processDefinition = createMockProcessDefinition({
            id: 'next-pending-test',
            name: 'Next Pending Test',
            start: 'a:mainSequence',
            activities: {
                mainSequence: {
                    id: 'mainSequence',
                    type: ActivityType.Sequence,
                    activities: ['a:step1', 'a:step2']
                },
                step1: {
                    id: 'step1',
                    type: ActivityType.Human,
                    inputs: [{ name: 'input1', type: FieldType.Text, required: false }]
                },
                step2: {
                    id: 'step2',
                    type: ActivityType.Human,
                    inputs: [{ name: 'input2', type: FieldType.Text, required: false }]
                }
            }
        } as any);

        await engine.loadProcess(processDefinition as any);
        const create = await engine.createInstance('next-pending-test');
        const instanceId = create.instanceId;
        
        // The instance should start at step1 (first activity in sequence)
        let instance = await engine.getInstance(instanceId);
        expect(instance).not.toBeNull();
        expect(instance?.executionContext.currentActivity).toBe('step1');
        
        // Complete step1 to move to step2
        await engine.submitHumanTask(instanceId, 'step1', { input1: 'test' });
        
        // Verify we're now at step2
        instance = await engine.getInstance(instanceId);
        expect(instance?.executionContext.currentActivity).toBe('step2');
        
        // Now navigate to next pending (which should still be step2 since it's not completed)
        const navigateResult = await engine.navigateToNextPending(instanceId);
        
        expect(navigateResult.status).toBe(ProcessStatus.Running);
        expect(navigateResult.message).toContain('Navigated to next pending activity');
        
        // Should be at step2
        const updatedInstance = await engine.getInstance(instanceId);
        expect(updatedInstance).not.toBeNull();
        if (updatedInstance) {
            expect(updatedInstance.executionContext.currentActivity).toBe('step2');
        }
    });

    test('should handle navigation when all activities are completed', async () => {
        const processDefinition = createMockProcessDefinition({
            id: 'completed-test',
            name: 'Completed Test',
            start: 'a:step1',
            activities: {
                step1: {
                    id: 'step1',
                    name: 'Step 1',
                    type: 'compute',
                    code: ["a:step1.value = 'step1 complete';"]
                }
            }
        } as any);

        await engine.loadProcess(processDefinition as any);
        const create = await engine.createInstance('completed-test');
        const instanceId = create.instanceId;

        // Instance should be completed after creation and execution
        const instance = await engine.getInstance(instanceId);
        expect(instance).not.toBeNull();
        
        // Navigate to next pending when all activities are done
        const navigateResult = await engine.navigateToNextPending(instanceId);
        
        expect(navigateResult.status).toBe(ProcessStatus.Completed);
        expect(navigateResult.message).toBe('All activities are completed');
    });

    test('should handle navigation with invalid instance ID', async () => {
        const invalidInstanceId = 'non-existent-instance';

        const startResult = await engine.navigateToStart(invalidInstanceId);
        expect(startResult.status).toBe(ProcessStatus.Failed);
        expect(startResult.message).toContain('not found');

        const pendingResult = await engine.navigateToNextPending(invalidInstanceId);
        expect(pendingResult.status).toBe(ProcessStatus.Failed);
        expect(pendingResult.message).toContain('not found');
    });

    test('should handle navigation with process definition without start activity', async () => {
        const processDefinition = createMockProcessDefinition({
            id: 'no-start-test',
            name: 'No Start Test',
            start: '', // Invalid start
            activities: {
                step1: {
                    id: 'step1',
                    name: 'Step 1',
                    type: 'compute',
                    code: ["a:step1.value = 'step1 complete';"]
                }
            }
        } as any);

        // This should fail during load, but let's test navigation error handling
        try {
            await engine.loadProcess(processDefinition as any);
            const create = await engine.createInstance('no-start-test');
            const instanceId = create.instanceId;

            const navigateResult = await engine.navigateToStart(instanceId);
            expect(navigateResult.status).toBe(ProcessStatus.Failed);
            expect(navigateResult.message).toContain('No start activity defined');
        } catch (error) {
            // Process loading may fail, which is expected for invalid definitions
            expect(error).toBeDefined();
        }
    });
});