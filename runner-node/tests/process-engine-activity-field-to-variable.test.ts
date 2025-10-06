import { ProcessEngine } from '../src/process-engine';
import { RepositoryFactory } from '../src/repositories/repository-factory';
import { createMockProcessDefinition } from './setup';

describe('ProcessEngine compute copying activity field to variable', () => {
  let engine: ProcessEngine;

  beforeEach(async () => {
    await RepositoryFactory.initializeInMemory();
    engine = new ProcessEngine();
  });

  it('should copy a human activity field into a process variable using v: syntax', async () => {
    const proc = createMockProcessDefinition({
      id: 'copy-field-process',
      name: 'Copy Field',
      start: 'a:mainSeq',
      activities: {
        mainSeq: {
          id: 'mainSeq',
          name: 'Main sequence',
          type: 'sequence',
          activities: ['a:enterName', 'a:copyName']
        },
        enterName: {
          id: 'enterName',
          name: 'Enter Name',
          type: 'human',
          prompt: 'Please enter name',
          inputs: [ { name: 'customerName', type: 'string' } ]
        },
        copyName: {
          id: 'copyName',
          name: 'Copy Name',
          type: 'compute',
          code: [ 'v:customer = a:enterName.v:customerName' ]
        }
      },
      variables: [ { name: 'customer', type: 'string' } ]
    } as any);

    await engine.loadProcess(proc as any);

    const createResult = await engine.createInstance('copy-field-process');
    expect(createResult.instanceId).toBeTruthy();

    // Instance should now be waiting on the human task 'enterName'
    const instanceId = createResult.instanceId;
    const instanceBefore = await engine.getInstance(instanceId);
    expect(instanceBefore).not.toBeNull();
    if (!instanceBefore) return;
    expect(instanceBefore.currentActivity).toBe('enterName');

    // Submit the human task with a customerName
    const submitResult = await engine.submitHumanTask(instanceId, 'enterName', { customerName: 'Alice' });
    expect(submitResult.status).toBeDefined();

    // After submission, engine should continue and eventually set the process variable
    const instanceAfter = await engine.getInstance(instanceId);
    expect(instanceAfter).not.toBeNull();
    if (!instanceAfter) return;

    expect(instanceAfter.variables.customer).toBe('Alice');
  });
});
