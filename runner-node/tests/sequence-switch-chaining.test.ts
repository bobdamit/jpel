import { ProcessEngine } from '../src/process-engine';
import { RepositoryFactory } from '../src/repositories/repository-factory';
import { ActivityType, FieldType, ProcessStatus, ActivityStatus } from '../src/models/process-types';

describe('Sequence + Switch Chaining Tests', () => {
    let engine: ProcessEngine;

    beforeEach(async () => {
        RepositoryFactory.initializeInMemory();
        engine = new ProcessEngine();
    });

    test('sequence containing switch that routes to a human should continue after branch completes', async () => {
        const proc = {
            id: 'seq-switch-test',
            name: 'Sequence Switch Test',
            version: '1.0.0',
            start: 'a:seq',
            activities: {
                seq: { type: ActivityType.Sequence, activities: ['a:switchAct', 'a:afterSwitch'] },
                switchAct: { type: ActivityType.Switch, expression: "'DONOR'", cases: { DONOR: 'a:donor', CUSTOM: 'a:custom' } },
                donor: { type: ActivityType.Human, fields: [{ name: 'donor', label: 'Donor', type: FieldType.Text }] },
                custom: { type: ActivityType.Human, fields: [{ name: 'custom', label: 'Custom', type: FieldType.Text }] },
                afterSwitch: { type: ActivityType.Human, fields: [{ name: 'after', label: 'After', type: FieldType.Text }] }
            }
        };

        await engine.loadProcess(proc);
        const create = await engine.createInstance('seq-switch-test');
        const instanceId = create.instanceId;

        // After starting, the switch should route to 'donor'
        let instance = await engine.getInstance(instanceId);
        expect(instance).toBeDefined();
        expect(instance?.executionContext.currentActivity).toBe('donor');

        // Complete donor
        await engine.submitHumanTask(instanceId, 'donor', { donor: '990' });

        // Now sequence should continue to afterSwitch
        instance = await engine.getInstance(instanceId);
        expect(instance?.executionContext.currentActivity).toBe('afterSwitch');
        // The sequence child (seq) should have progressed; verify sequence child instance
        const seqInst = instance?.activities['seq'];
        expect(seqInst?.status === ActivityStatus.Running || seqInst?.status === ActivityStatus.Completed).toBeTruthy();

        // Finish the process
        await engine.submitHumanTask(instanceId, 'afterSwitch', { after: 'done' });
        instance = await engine.getInstance(instanceId);
        expect(instance?.status).toBe(ProcessStatus.Completed);
    });

    test('switch selecting a nested sequence should allow nested sequence to run and parent to continue', async () => {
        const proc = {
            id: 'switch-nested-seq-test',
            name: 'Switch Nested Sequence Test',
            version: '1.0.0',
            start: 'a:parentSeq',
            activities: {
                parentSeq: { type: ActivityType.Sequence, activities: ['a:chooser', 'a:afterParent'] },
                chooser: { type: ActivityType.Switch, expression: "'INNER'", cases: { INNER: 'a:innerSeq', OTHER: 'a:otherAct' } },
                innerSeq: { type: ActivityType.Sequence, activities: ['a:innerOne', 'a:innerTwo'] },
                innerOne: { type: ActivityType.Human, fields: [{ name: 'one', label: 'One', type: FieldType.Text }] },
                innerTwo: { type: ActivityType.Human, fields: [{ name: 'two', label: 'Two', type: FieldType.Text }] },
                otherAct: { type: ActivityType.Human, fields: [{ name: 'other', label: 'Other', type: FieldType.Text }] },
                afterParent: { type: ActivityType.Human, fields: [{ name: 'after', label: 'After Parent', type: FieldType.Text }] }
            }
        };

        await engine.loadProcess(proc);
        const create = await engine.createInstance('switch-nested-seq-test');
        const instanceId = create.instanceId;

        // chooser should set currentActivity to innerOne (first child of innerSeq)
        let instance = await engine.getInstance(instanceId);
        expect(instance?.executionContext.currentActivity).toBe('innerOne');

        // Complete innerOne -> should go to innerTwo
        await engine.submitHumanTask(instanceId, 'innerOne', { one: 'x' });
        instance = await engine.getInstance(instanceId);
        expect(instance?.executionContext.currentActivity).toBe('innerTwo');

        // Complete innerTwo -> nested sequence completes and parent should continue to afterParent
        await engine.submitHumanTask(instanceId, 'innerTwo', { two: 'y' });
        instance = await engine.getInstance(instanceId);
        expect(instance?.executionContext.currentActivity).toBe('afterParent');

        // Finish
        await engine.submitHumanTask(instanceId, 'afterParent', { after: 'ok' });
        instance = await engine.getInstance(instanceId);
        expect(instance?.status).toBe(ProcessStatus.Completed);
    });
});
