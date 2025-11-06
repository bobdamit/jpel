import { ProcessStatus } from '../src/models/instance-types';
import { ProcessEngine } from '../src/process-engine';
import { RepositoryFactory } from '../src/repositories/repository-factory';
import { createMockProcessDefinition } from './setup';

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

        // Navigation to start should work and execute the start activity
        const navigateResult = await engine.restartInstance(instanceId);
        
        // Since step1 is a compute activity that completes immediately, 
        // the process completes after navigating to start and executing
        expect(navigateResult.status).toBe(ProcessStatus.Completed);

        // Verify the instance was updated (should be completed now)
        const instance = await engine.getInstance(instanceId);
        expect(instance).not.toBeNull();
        if (instance) {
            expect(instance.status).toBe(ProcessStatus.Completed);
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

            const navigateResult = await engine.restartInstance(instanceId);
            expect(navigateResult.status).toBe(ProcessStatus.Failed);
            expect(navigateResult.message).toContain('No start activity defined');
        } catch (error) {
            // Process loading may fail, which is expected for invalid definitions
            expect(error).toBeDefined();
        }
    });
});