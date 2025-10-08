import { ProcessEngine } from '../src/process-engine';
import { RepositoryFactory } from '../src/repositories/repository-factory';
import { ActivityType, FieldType, ProcessStatus } from '../src/types';

describe('Long mixed chain execution', () => {
    let engine: ProcessEngine;

    beforeEach(() => {
        RepositoryFactory.initializeInMemory();
        engine = new ProcessEngine();
    });

    test('long mixed chain of sequence/switch/branch/nested-sequences completes', async () => {
        const process = {
            id: 'long-chain-test',
            name: 'Long Chain Test',
            start: 'a:rootSeq',
            activities: {
                rootSeq: {
                    id: 'rootSeq',
                    type: ActivityType.Sequence,
                    activities: [
                        'a:compute1',        // compute
                        'a:switch1',         // switch -> nestedSeq1
                        'a:afterSwitch',     // compute
                        'a:branch1',         // branch -> thenSeq1
                        'a:seq2',            // sequence with two computes
                        'a:seq3',            // nested sequence which itself contains a sequence
                        'a:finalCompute',
                        'a:end'
                    ]
                },
                compute1: {
                    id: 'compute1',
                    type: ActivityType.Compute,
                    code: ['return { ok: true };']
                },
                switch1: {
                    id: 'switch1',
                    type: ActivityType.Switch,
                    expression: `'NESTED'`,
                    cases: {
                        NESTED: 'a:nestedSeq1'
                    },
                    default: 'a:afterSwitch'
                },
                nestedSeq1: {
                    id: 'nestedSeq1',
                    type: ActivityType.Sequence,
                    activities: ['a:ns1a', 'a:ns1b']
                },
                ns1a: { id: 'ns1a', type: ActivityType.Compute, code: ['return { a:1 };'] },
                ns1b: { id: 'ns1b', type: ActivityType.Compute, code: ['return { b:2 };'] },
                afterSwitch: { id: 'afterSwitch', type: ActivityType.Compute, code: ['return { after: true };'] },
                branch1: {
                    id: 'branch1',
                    type: ActivityType.Branch,
                    condition: 'true',
                    then: 'a:thenSeq1'
                },
                thenSeq1: {
                    id: 'thenSeq1',
                    type: ActivityType.Sequence,
                    activities: ['a:then1']
                },
                then1: { id: 'then1', type: ActivityType.Compute, code: ['return { then: 1 };'] },
                seq2: {
                    id: 'seq2',
                    type: ActivityType.Sequence,
                    activities: ['a:seq2a','a:seq2b']
                },
                seq2a: { id: 'seq2a', type: ActivityType.Compute, code: ['return { s2a: 1 };'] },
                seq2b: { id: 'seq2b', type: ActivityType.Compute, code: ['return { s2b: 2 };'] },
                seq3: {
                    id: 'seq3',
                    type: ActivityType.Sequence,
                    activities: ['a:innerSeq']
                },
                innerSeq: {
                    id: 'innerSeq',
                    type: ActivityType.Sequence,
                    activities: ['a:innerA','a:innerB']
                },
                innerA: { id: 'innerA', type: ActivityType.Compute, code: ['return { ia: 1 };'] },
                innerB: { id: 'innerB', type: ActivityType.Compute, code: ['return { ib: 2 };'] },
                finalCompute: { id: 'finalCompute', type: ActivityType.Compute, code: ['return { final: true };'] },
                end: { id: 'end', type: ActivityType.Terminate }
            }
        } as any;

        await engine.loadProcess(process);
        const result = await engine.createInstance('long-chain-test');
        const instance = await engine.getInstance(result.instanceId!);

        expect(instance).toBeDefined();
        expect(instance!.status).toBe(ProcessStatus.Completed);
    }, 20000);
});
