import { ProcessEngine } from '../src/process-engine';
import { RepositoryFactory } from '../src/repositories/repository-factory';
import { createMockProcessDefinition } from './setup';

describe('Bracket-access JPEL translations', () => {
  let engine: ProcessEngine;

  beforeEach(async () => {
    await RepositoryFactory.initializeInMemory();
    engine = new ProcessEngine();
  });

  it('should write and read a variable with a hyphen using v: syntax', async () => {
    const proc = createMockProcessDefinition({
      id: 'dash-var-process',
      name: 'Dash Var',
      start: 'a:setDash',
      activities: {
        setDash: {
          id: 'setDash',
          name: 'Set Dash',
          type: 'compute',
          code: [ 'v:my-var = "dash-value"' ]
        }
      },
      variables: [ { name: 'my-var', type: 'string' } ]
    } as any);

    await engine.loadProcess(proc as any);
    const res = await engine.createInstance('dash-var-process');
    const inst = await engine.getInstance(res.instanceId);
    expect(inst).not.toBeNull();
    if (!inst) return;
    expect(inst.variables['my-var']).toBe('dash-value');
  });

  it('should copy a field with hyphen from a hyphenated activity id into a variable', async () => {
    const proc = createMockProcessDefinition({
      id: 'dash-activity-process',
      name: 'Dash Activity',
      start: 'a:mainSeq',
      activities: {
        mainSeq: {
          id: 'mainSeq',
          name: 'Main',
          type: 'sequence',
          activities: ['a:enter-name', 'a:copy-name']
        },
        'enter-name': {
          id: 'enter-name',
          name: 'Enter Name',
          type: 'human',
          prompt: 'Enter name',
          inputs: [ { name: 'customer-name', type: 'string' } ]
        },
        'copy-name': {
          id: 'copy-name',
          name: 'Copy Name',
          type: 'compute',
          code: [ 'v:customer = a:enter-name.f:customer-name' ]
        }
      },
      variables: [ { name: 'customer', type: 'string' } ]
    } as any);

    await engine.loadProcess(proc as any);
    const create = await engine.createInstance('dash-activity-process');
    const instanceId = create.instanceId;
    // submit human task with hyphenated field
    await engine.submitHumanTask(instanceId, 'enter-name', { 'customer-name': 'Bob' });
    const inst = await engine.getInstance(instanceId);
    expect(inst).not.toBeNull();
    if (!inst) return;
    expect(inst.variables.customer).toBe('Bob');
  });
});
