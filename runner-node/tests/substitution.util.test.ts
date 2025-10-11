import { createMockProcessInstance, createMockActivityInstance } from './setup';
import { substituteStringTemplate, substituteObjectVariables } from '../src/utils/substitution';

describe('substitution utils', () => {
  test('substituteStringTemplate replaces activity and process variables', () => {
    const instance = createMockProcessInstance({ variables: { g: 'gv' }, activities: { a1: createMockActivityInstance({ id: 'a1', variables: [{ name: 'foo', value: 'bar' }] }) } } as any);
    const out = substituteStringTemplate('hello a:a1.v:foo and process.g', instance as any);
    expect(out).toContain('bar');
    expect(out).toContain('gv');
  });

  test('substituteObjectVariables returns object with substituted values', () => {
    const instance = createMockProcessInstance({ variables: { g: 'gv' }, activities: { a1: createMockActivityInstance({ id: 'a1', variables: [{ name: 'foo', value: 'bar' }] }) } } as any);
    const obj = { x: 'a:a1.v:foo', y: 'process.g' };
    const out = substituteObjectVariables(obj, instance as any);
    expect(out.x).toBe('bar');
    expect(out.y).toBe('gv');
  });
});
