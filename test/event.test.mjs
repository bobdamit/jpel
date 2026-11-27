// The event schema: the five run events, and room for an engine's own.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Ajv from 'ajv';

const schema = JSON.parse(readFileSync(new URL('../schema/event.schema.json', import.meta.url), 'utf8'));
const validate = new Ajv({ allErrors: true, strict: true, discriminator: true }).compile(schema);

const event = (type, extra = {}) => ({
	id: 'e-1',
	type,
	at: '2026-11-27T14:03:00Z',
	run: { id: 'r-1', processId: 'winterize', title: 'Sea Breeze' },
	...extra
});
const step = { id: 'engineOil', name: 'Change engine oil and filter' };
const valid = value => validate(value);

test('each run event, with what it carries', () => {
	const events = [
		event('run.started', { data: { properties: { title: 'Sea Breeze' }, variables: { engineHours: 1240 } } }),
		event('run.started'),
		event('step.completed', { step, data: { values: { oilLitres: 3.8 } } }),
		event('step.completed', { step }),
		event('check.failed', { step, data: { rule: 'acts.engineOil.oilLitres >= 4', values: { 'acts.engineOil.oilLitres': 3.8 } } }),
		event('check.failed', { step, data: { rule: 'acts.engineOil.oilLitres >= 4' } }),
		event('run.completed', { data: { outcome: 'any_fail' } }),
		event('run.completed'),
		event('run.stopped', { data: { status: 'failed', error: 'Lab result: timed out after P14D' } }),
		event('run.stopped', { data: { status: 'cancelled' } })
	];
	for (const e of events) {
		assert.ok(valid(e), `${e.type}: ${JSON.stringify(validate.errors)}`);
	}
});

test('every event has an id, a type and a time; every run event has a run', () => {
	for (const key of ['id', 'type', 'at']) {
		const e = event('approval.decided');
		delete e[key];
		assert.ok(!valid(e), key);
	}
	for (const type of ['run.started', 'step.completed', 'check.failed', 'run.completed', 'run.stopped']) {
		const e = event(type, { step, data: { rule: 'x', status: 'failed' } });
		assert.ok(valid(e), `${type}: ${JSON.stringify(validate.errors)}`);
		delete e.run;
		assert.ok(!valid(e), `${type} without run`);
	}
	assert.ok(!valid(event('run.started', { run: { id: 'r-1' } })), 'run.processId');
});

test("an engine's own types needn't be about a run", () => {
	const changed = event('definition.updated', { process: { id: 'winterize', name: 'Winterize the sailboat' } });
	delete changed.run;
	assert.ok(valid(changed), JSON.stringify(validate.errors));
	// A run, when there is one, is still checked
	assert.ok(!valid(event('approval.decided', { run: { id: 'r-1' } })), 'run.processId');
});

test('what each type requires', () => {
	assert.ok(!valid(event('step.completed')), 'step.completed needs step');
	assert.ok(!valid(event('check.failed', { data: { rule: 'x' } })), 'check.failed needs step');
	assert.ok(!valid(event('check.failed', { step, data: {} })), 'check.failed needs the rule');
	assert.ok(!valid(event('run.completed', { data: { outcome: 'mixed' } })), 'outcome');
	assert.ok(!valid(event('run.stopped')), 'run.stopped needs data');
	assert.ok(!valid(event('run.stopped', { data: { status: 'completed' } })), 'stopped status');
	assert.ok(!valid(event('step.completed', { step: { name: 'no id' } })), 'step.id');
});

test("an engine's own types and keys are allowed", () => {
	const approval = event('approval.decided', {
		organizationId: 'org-1',
		actor: { userId: 'u-1', name: 'Pat' },
		step,
		data: { decision: 'approved' },
		run: { id: 'r-1', processId: 'winterize', url: 'https://example.com/runs/r-1' }
	});
	assert.ok(valid(approval), JSON.stringify(validate.errors));
	assert.ok(valid(event('plan.trial_ending')));
	for (const type of ['RunStarted', 'run', 'run.', '.started', 'run started']) {
		assert.ok(!valid(event(type)), type);
	}
});
