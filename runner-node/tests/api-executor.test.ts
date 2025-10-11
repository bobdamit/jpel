import { createMockProcessInstance, createMockActivityInstance } from './setup';
import { ExpressionEvaluator } from '../src/expression-evaluator';
import { APIExecutor } from '../src/api-executor';
jest.mock('axios');

describe('Activity variable extraction and API substitution', () => {
  test('ExpressionEvaluator.getActivityVariableState maps variables array to object', () => {
    const evaluator = new ExpressionEvaluator();
    const activity = createMockActivityInstance({
      id: 'act1',
      variables: [
        { name: 'foo', value: 'bar' },
        { name: 'num', value: 42 },
      ],
    });

    const result = evaluator.getActivityVariableState(activity as any);
    expect(result).toEqual({ foo: 'bar', num: 42 });
  });

  test('APIExecutor substitutes activity variables and process variables in URL, headers and body', async () => {
    const instance = createMockProcessInstance({
      variables: { global: 'gval' },
      activities: {
        act1: createMockActivityInstance({ id: 'act1', variables: [{ name: 'x', value: 'v1' }] }),
      },
    } as any);

    const api = new APIExecutor();

    // Test substituteVariables indirectly via building a fake activity and calling execute with a mocked axios
    const activityDef: any = {
      method: 'GET',
      url: 'https://example.com/a:act1.v:x?g=process.global',
      headers: { 'x-header': 'a:act1.v:x' },
      queryParams: { q: 'process.global' },
    };

    // Mock axios to return the request back so we can inspect substitutions
    const axios = require('axios') as any;
    axios.mockImplementation(async (cfg: any) => {
      return { status: 200, statusText: 'OK', headers: cfg.headers, data: { url: cfg.url, params: cfg.params, data: cfg.data } };
    });

    const response = await api.execute(activityDef, instance as any);

    expect(response.status).toBe(200);
    expect(response.data.url).toContain('v1');
  expect(response.data.params).toEqual({ q: 'gval' });
  // Headers are returned in response.headers by our axios mock
  expect(response.headers['x-header']).toBe('v1');

  // restore axios mock
  axios.mockReset?.();
  });
});
