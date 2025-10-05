import { RepositoryFactory } from '../src/repositories/repository-factory';
import { ProcessEngine } from '../src/process-engine';
import { ActivityType, FieldType } from '../src/types';

async function run() {
  await RepositoryFactory.initializeInMemory();
  const engine = new ProcessEngine();

  const process = {
    id: 'switch-test-debug',
    name: 'Switch Debug',
    variables: [{ name: 'switchValue', type: FieldType.Text, defaultValue: 'option1' }],
    start: 'a:switch',
    activities: {
      switch: {
        id: 'switch',
        type: ActivityType.Switch,
        expression: 'process.switchValue',
        cases: {
          'option1': 'a:case1',
          'option2': 'a:case2'
        },
        default: 'a:defaultCase'
      },
      case1: { id: 'case1', type: ActivityType.Compute, code: ['return { case: 1 };'] },
      case2: { id: 'case2', type: ActivityType.Compute, code: ['return { case: 2 };'] },
      defaultCase: { id: 'defaultCase', type: ActivityType.Compute, code: ['return { case: "default" };'] }
    }
  } as any;

  await engine.loadProcess(process);
  const result = await engine.createInstance('switch-test-debug');
  console.log('create result', result);
  const inst = await engine.getInstance(result.instanceId);
  console.log('instance currentActivity', inst?.currentActivity);
  const sw = inst?.activities['switch'];
  console.log('switch activity instance:', JSON.stringify(sw, null, 2));
}

run().catch(err => {
  console.error('debug run error', err);
  process.exit(1);
});
