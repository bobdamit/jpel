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

test('a receive activity takes fields, a timeout, code and passWhen', () => {
	const receive = {
		type: 'receive',
		name: 'Lab result',
		fields: [{ name: 'ironPpm', type: 'number', units: 'ppm', required: true }],
		timeout: 'P14D',
		code: 'return { worn: received.ironPpm > 100 };',
		passWhen: '!acts.a.worn',
		'x-note': 'kept'
	};
	assert.ok(valid(process({ a: receive })), JSON.stringify(validate.errors));
	assert.ok(valid(process({ a: { type: 'receive' } })), 'everything but type is optional');
	assert.ok(!valid(process({ a: { ...receive, method: 'POST' } })), 'api keys');
	assert.ok(!valid(process({ a: { ...receive, prompt: 'Waiting' } })), 'human keys');
});

test('receive timeouts are ISO 8601 durations, without years or months', () => {
	const timeout = value => valid(process({ a: { type: 'receive', timeout: value } }));
	for (const ok of ['PT30M', 'PT8H', 'P14D', 'P2W', 'PT90S', 'P1DT12H', 'P1W2DT3H4M5S']) {
		assert.ok(timeout(ok), ok);
	}
	for (const bad of ['P', 'PT', 'P1DT', '14D', 'P1M', 'P1Y', 'P1.5D', 'PT8h', 'p14d', 'P14D ', 3600]) {
		assert.ok(!timeout(bad), String(bad));
	}
});

test('a property may be required', () => {
	const withProperty = property => ({ ...process({ a: { type: 'terminate' } }), properties: [{ id: 'title', name: 'Boat', ...property }] });
	assert.ok(valid(withProperty({ required: true })));
	assert.ok(valid(withProperty({ required: false, defaultValue: 'Unnamed' })));
	assert.ok(!valid(withProperty({ required: 'yes' })));
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

test('x- extensions are allowed on the process, activities and fields', () => {
	const field = { name: 'finish', type: 'number', min: 1, max: 10, 'x-display': 'scale', 'x-report': { hidden: true } };
	const definition = { ...process({ a: { type: 'human', fields: [field], 'x-color': 'blue' }, b: { type: 'switch', condition: 'true', then: 'a', 'x-note': 1 } }), 'x-tool': { v: 2 } };
	assert.ok(valid(definition), JSON.stringify(validate.errors));
	// Only x-: other unknown keys are still typos
	assert.ok(!valid(process({ a: { type: 'human', fields: [{ ...field, display: 'scale' }] } })));
	assert.ok(!valid(process({ a: { type: 'human', 'X-upper': 1 } })));
});
