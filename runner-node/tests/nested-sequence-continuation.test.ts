import { ProcessEngine } from '../src/process-engine';
import { RepositoryFactory } from '../src/repositories/repository-factory';
import { ActivityType, FieldType, ProcessStatus, ActivityStatus } from '../src/types';
import fs from 'fs';
import path from 'path';

describe('Nested Sequence Continuation Tests', () => {
    let engine: ProcessEngine;

    beforeEach(async () => {
        RepositoryFactory.initializeInMemory();
        engine = new ProcessEngine();
    });

    test('should continue main sequence after nested sequence completes', async () => {
        // Create a simpler process that demonstrates the bug with nested sequences
        const testProcess = {
            id: 'nested-sequence-test',
            name: 'Nested Sequence Test',
            version: '1.0.0',
            start: 'a:main',
            activities: {
                main: {
                    type: ActivityType.Sequence,
                    activities: [
                        'a:basicFactsSequence',
                        'a:validateCommonFacts',
                        'a:finalDecision'
                    ]
                },
                basicFactsSequence: {
                    type: ActivityType.Sequence,
                    activities: [
                        'a:enterMicFacts',
                        'a:setMicType'
                    ]
                },
                enterMicFacts: {
                    type: ActivityType.Human,
                    fields: [
                        { name: 'customerName', label: 'Customer Name', type: FieldType.Text, required: true },
                        { name: 'customerType', label: 'Customer Type', type: FieldType.Text, required: true }
                    ]
                },
                setMicType: {
                    type: ActivityType.Human,
                    fields: [
                        { name: 'micType', label: 'Mic Type', type: FieldType.Text, required: true }
                    ]
                },
                validateCommonFacts: {
                    type: ActivityType.Human,
                    fields: [
                        { name: 'validationResult', label: 'Validation Result', type: FieldType.Text, required: true }
                    ]
                },
                finalDecision: {
                    type: ActivityType.Human,
                    fields: [
                        { name: 'decision', label: 'Decision', type: FieldType.Text, required: true }
                    ]
                }
            }
        };
        
        // Load the process definition
        await engine.loadProcess(testProcess);
        
        // Start the process
        const result = await engine.createInstance('nested-sequence-test');
        const instanceId = result.instanceId;
        
        // Complete the first activity in basicFactsSequence (enterMicFacts)
        await engine.submitHumanTask(instanceId, 'enterMicFacts', {
            customerName: 'Test Customer',
            customerType: 'individual'
        });
        
        // Complete the second activity in basicFactsSequence (setMicType)  
        await engine.submitHumanTask(instanceId, 'setMicType', {
            micType: 'primary'
        });
        
        // At this point, basicFactsSequence should be complete and 
        // the main sequence should continue to validateCommonFacts
        let instance = await engine.getInstance(instanceId);
        
        // Verify that the current activity is validateCommonFacts (not stuck)
        expect(instance?.currentActivity).toBe('validateCommonFacts');
        expect(instance?.status).toBe(ProcessStatus.Running);
        
        // Verify basicFactsSequence is completed
        const basicFactsSeqInstance = instance?.activities['basicFactsSequence'];
        expect(basicFactsSeqInstance?.status).toBe(ActivityStatus.Completed);
        
        // Complete validateCommonFacts to continue
        await engine.submitHumanTask(instanceId, 'validateCommonFacts', {
            validationResult: 'passed'
        });
        
        // Now should be at finalDecision
        instance = await engine.getInstance(instanceId);
        expect(instance?.currentActivity).toBe('finalDecision');
        expect(instance?.status).toBe(ProcessStatus.Running);
        
        // Complete the decision to finish the process
        await engine.submitHumanTask(instanceId, 'finalDecision', {
            decision: 'approve'
        });
        
        // Process should now be completed
        instance = await engine.getInstance(instanceId);
        expect(instance?.status).toBe(ProcessStatus.Completed);
        expect(instance?.currentActivity).toBeUndefined();
    });

    test('should handle multiple levels of nested sequences', async () => {
        // Create a process with deeply nested sequences
        const processDefinition = {
            id: 'multi-nested-test',
            name: 'Multi-Nested Sequence Test',
            version: '1.0.0',
            start: 'a:outerSeq',
            activities: {
                outerSeq: {
                    type: ActivityType.Sequence,
                    activities: [
                        'a:innerSeq1',
                        'a:finalActivity'
                    ]
                },
                innerSeq1: {
                    type: ActivityType.Sequence, 
                    activities: [
                        'a:deepestSeq',
                        'a:middleActivity'
                    ]
                },
                deepestSeq: {
                    type: ActivityType.Sequence,
                    activities: [
                        'a:firstActivity',
                        'a:secondActivity'
                    ]
                },
                firstActivity: {
                    type: ActivityType.Human,
                    fields: [
                        { name: 'input1', label: 'First Input', type: FieldType.Text }
                    ]
                },
                secondActivity: {
                    type: ActivityType.Human,
                    fields: [
                        { name: 'input2', label: 'Second Input', type: FieldType.Text }
                    ]
                },
                middleActivity: {
                    type: ActivityType.Human,
                    fields: [
                        { name: 'input3', label: 'Middle Input', type: FieldType.Text }
                    ]
                },
                finalActivity: {
                    type: ActivityType.Human,
                    fields: [
                        { name: 'input4', label: 'Final Input', type: FieldType.Text }
                    ]
                }
            }
        };
        
        // Load and start the process
        await engine.loadProcess(processDefinition);
        const result = await engine.createInstance('multi-nested-test');
        const instanceId = result.instanceId;
        
        // Complete firstActivity (in deepestSeq)
        await engine.submitHumanTask(instanceId, 'firstActivity', { input1: 'test1' });
        
        // Should now be at secondActivity
        let instance = await engine.getInstance(instanceId);
        expect(instance?.currentActivity).toBe('secondActivity');
        
        // Complete secondActivity (completes deepestSeq)
        await engine.submitHumanTask(instanceId, 'secondActivity', { input2: 'test2' });
        
        // Should now be at middleActivity (innerSeq1 continues)
        instance = await engine.getInstance(instanceId);
        expect(instance?.currentActivity).toBe('middleActivity');
        
        // Complete middleActivity (completes innerSeq1)
        await engine.submitHumanTask(instanceId, 'middleActivity', { input3: 'test3' });
        
        // Should now be at finalActivity (outerSeq continues)
        instance = await engine.getInstance(instanceId);
        expect(instance?.currentActivity).toBe('finalActivity');
        
        // Complete finalActivity (completes entire process)
        await engine.submitHumanTask(instanceId, 'finalActivity', { input4: 'test4' });
        
        // Process should be completed
        instance = await engine.getInstance(instanceId);
        expect(instance?.status).toBe(ProcessStatus.Completed);
        expect(instance?.currentActivity).toBeUndefined();
    });
});