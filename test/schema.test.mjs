// The process schema rejects old syntax and typos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Ajv from 'ajv';

const schema = JSON.parse(readFileSync(new URL('../schema/process.schema.json', import.meta.url), 'utf8'));
const validate = new Ajv({ allErrors: true, strict: true, discriminator: true }).compile(schema);

const process = activities => ({ id: 'p', name: 'P', start: 'a', activities });
const valid = definition => validate(definition);

test('a minimal process is valid', () => {
	assert.ok(valid(process({ a: { type: 'compute', code: 'vars.x = 1;' } })));
});

test('code may be a string or an array of lines', () => {
	assert.ok(valid(process({ a: { type: 'compute', code: ['const x = 1;', 'return { x };'] } })));
});

test('a compute activity may have only passWhen', () => {
	assert.ok(valid(process({ a: { type: 'compute', passWhen: 'acts.b.ok' }, b: { type: 'human' } })));
	assert.ok(!valid(process({ a: { type: 'compute' } })));
});

test('switch takes expression + cases or condition + then, not both', () => {
	assert.ok(valid(process({ a: { type: 'switch', expression: 'vars.k', cases: { x: 'b' }, default: 'b' }, b: { type: 'terminate' } })));
	assert.ok(valid(process({ a: { type: 'switch', condition: 'vars.ok', then: 'b' }, b: { type: 'terminate' } })));
	assert.ok(!valid(process({ a: { type: 'switch', condition: 'vars.ok', then: 'b', expression: 'vars.k', cases: { x: 'b' } }, b: { type: 'terminate' } })));
	assert.ok(!valid(process({ a: { type: 'switch', expression: 'vars.k', cases: { x: 'b' }, else: 'b' }, b: { type: 'terminate' } })));
});

test('old forms are rejected', () => {
	assert.ok(!valid({ ...process({ a: { type: 'terminate' } }), start: 'a:a' }), 'a: prefix');
	assert.ok(!valid({ ...process({ a: { type: 'terminate' } }), version: '1.0.0' }), 'version');
	assert.ok(!valid(process({ a: { type: 'branch', condition: 'true', then: 'a' } })), 'branch');
	assert.ok(!valid(process({ a: { type: 'human', inputs: [] } })), 'inputs');
	assert.ok(!valid(process({ a: { type: 'sequence', activities: ['a:b'] }, b: { type: 'terminate' } })), 'a: in a sequence');
});

test('unknown keys are rejected', () => {
	assert.ok(!valid(process({ a: { type: 'human', desciption: 'typo' } })));
	assert.ok(!valid(process({ a: { type: 'human', fields: [{ name: 'x', type: 'text', multiline: true }] } })));
	assert.ok(!valid(process({ a: { type: 'human', fields: [{ name: 'x', type: 'string' }] } })));
});
