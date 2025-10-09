import { ProcessEngine } from '../src/process-engine';
import { RepositoryFactory } from '../src/repositories/repository-factory';
import { createMockProcessDefinition } from './setup';
import { ActivityStatus } from '../src/models/process-types';

describe('ActivityInstance native field write access', () => {
  let engine: ProcessEngine;

  beforeEach(async () => {
    await RepositoryFactory.initializeInMemory();
    engine = new ProcessEngine();
  });

  it('should allow compute code to set activity.passFail', async () => {
    const proc = createMockProcessDefinition({
      id: 'passfail-test',
      name: 'PassFail Test',
      start: 'a:validateCommonFacts',
      activities: {
        validateCommonFacts: {
          id: 'validateCommonFacts',
          name: 'Validate Common Facts',
          type: 'compute',
          code: [
            "a:validateCommonFacts.passFail = 'pass';",
            "this.result = 'ok';"
          ]
        }
      }
    } as any);

    await engine.loadProcess(proc as any);
    const create = await engine.createInstance('passfail-test');
    const inst = await engine.getInstance(create.instanceId);
    expect(inst).not.toBeNull();
    if (!inst) return;

    const ai = inst.activities['validateCommonFacts'];
    expect(ai).toBeDefined();
    expect(ai.status).toBe(ActivityStatus.Completed);
    expect(ai.passFail).toBe('pass');
  });
});
