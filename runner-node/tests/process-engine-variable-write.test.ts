import { ProcessEngine } from '../src/process-engine';
import { RepositoryFactory } from '../src/repositories/repository-factory';
import { createMockProcessDefinition } from './setup';

describe('ProcessEngine variable write semantics', () => {
  let engine: ProcessEngine;

  beforeEach(async () => {
    // Initialize in-memory repositories via factory convenience method
    await RepositoryFactory.initializeInMemory();
    engine = new ProcessEngine();
  });

  it('should allow compute activity to write process variables using v: syntax and persist them', async () => {
    const proc = createMockProcessDefinition({
      id: 'write-test-process',
      name: 'Write Test',
      start: 'a:setVar',
      activities: {
        setVar: {
          id: 'setVar',
          name: 'Set Variable',
          type: 'compute',
          code: [
            'v:theTitle = "Hello from compute"'
          ]
        }
      },
      variables: [ { name: 'theTitle', type: 'string' } ]
    } as any);

    await engine.loadProcess(proc as any);

    const createResult = await engine.createInstance('write-test-process');
    expect(createResult).not.toBeNull();
    expect(createResult.instanceId).toBeTruthy();

    const instance = await engine.getInstance(createResult.instanceId);
    expect(instance).not.toBeNull();
    if (!instance) return;

    expect(instance.variables.theTitle).toBe('Hello from compute');
  });
});
