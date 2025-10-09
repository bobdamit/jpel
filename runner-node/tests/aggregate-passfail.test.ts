import { ProcessEngine } from '../src/process-engine';
import { RepositoryFactory } from '../src/repositories/repository-factory';
import { AggregatePassFail } from '../src/models/instance-types';
import { createMockProcessDefinition } from './setup';
import { ActivityType } from '../src/models/process-types';

describe('Aggregate PassFail Tests', () => {
    let engine: ProcessEngine;

    beforeEach(async () => {
        await RepositoryFactory.initializeInMemory();
        engine = new ProcessEngine();
    });

    test('should set aggregate to AllPass when single activity passes', async () => {
        const processDefinition = createMockProcessDefinition({
            id: 'single-pass-test',
            name: 'Single Pass Test',
            start: 'a:step1',
            activities: {
                step1: {
                    id: 'step1',
                    name: 'Step 1',
                    type: 'compute',
                    code: ["a:step1.passFail = 'pass';", "a:step1.value = 'step1 complete';"]
                }
            }
        } as any);

        await engine.loadProcess(processDefinition as any);
        const create = await engine.createInstance('single-pass-test');
        const completedInstance = await engine.getInstance(create.instanceId);
        
        expect(completedInstance).not.toBeNull();
        if (!completedInstance) return;

        expect(completedInstance.status).toBe('completed');
        expect(completedInstance.aggregatePassFail).toBe(AggregatePassFail.AllPass);
        expect(completedInstance.activities.step1.passFail).toBe('pass');
    });

    test('should set aggregate to AnyFail when single activity fails', async () => {
        const processDefinition = createMockProcessDefinition({
            id: 'single-fail-test',
            name: 'Single Fail Test',
            start: 'a:step1',
            activities: {
                step1: {
                    id: 'step1',
                    name: 'Step 1',
                    type: 'compute',
                    code: ["a:step1.passFail = 'fail';", "a:step1.value = 'step1 failed';"]
                }
            }
        } as any);

        await engine.loadProcess(processDefinition as any);
        const create = await engine.createInstance('single-fail-test');
        const completedInstance = await engine.getInstance(create.instanceId);

        expect(completedInstance).not.toBeNull();
        if (!completedInstance) return;
        
        expect(completedInstance.status).toBe('completed');
        expect(completedInstance.aggregatePassFail).toBe(AggregatePassFail.AnyFail);
        expect(completedInstance.activities.step1.passFail).toBe('fail');
    });

    test('should not set aggregate when no activities have passFail values', async () => {
        const processDefinition = createMockProcessDefinition({
            id: 'no-passfail-test',
            name: 'No PassFail Test',
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
        const create = await engine.createInstance('no-passfail-test');
        const completedInstance = await engine.getInstance(create.instanceId);

        expect(completedInstance).not.toBeNull();
        if (!completedInstance) return;
        
        expect(completedInstance.status).toBe('completed');
        expect(completedInstance.aggregatePassFail).toBeUndefined();
        expect(completedInstance.activities.step1.passFail).toBeUndefined();
    });

    test('should handle mixed passFail in sequence', async () => {
        const processDefinition = createMockProcessDefinition({
            id: 'sequence-mixed-test',
            name: 'Sequence Mixed Test',
            start: 'a:sequence',
            activities: {
                sequence: {
                    id: 'sequence',
                    type: ActivityType.Sequence,
                    activities: ['a:step1', 'a:step2', 'a:step3']
                },
                step1: {
                    id: 'step1',
                    type: ActivityType.Compute,
                    code: ["a:step1.passFail = 'pass';", "a:step1.value = 'step1 passed';"]
                },
                step2: {
                    id: 'step2',
                    type: ActivityType.Compute,
                    code: ["a:step2.passFail = 'fail';", "a:step2.value = 'step2 failed';"]
                },
                step3: {
                    id: 'step3',
                    type: ActivityType.Compute,
                    code: ["a:step3.value = 'step3 complete (no passFail)';"]
                }
            }
        } as any);

        await engine.loadProcess(processDefinition as any);
        const create = await engine.createInstance('sequence-mixed-test');
        const completedInstance = await engine.getInstance(create.instanceId);

        expect(completedInstance).not.toBeNull();
        if (!completedInstance) return;
        
        expect(completedInstance.status).toBe('completed');
        expect(completedInstance.aggregatePassFail).toBe(AggregatePassFail.AnyFail);
        expect(completedInstance.activities.step1.passFail).toBe('pass');
        expect(completedInstance.activities.step2.passFail).toBe('fail');
        expect(completedInstance.activities.step3.passFail).toBeUndefined();
    });
});