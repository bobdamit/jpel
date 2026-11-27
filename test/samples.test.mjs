// Every sample must validate against the process schema, refer only to
// activities that exist, and use the current syntax.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';

const read = path => JSON.parse(readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8'));
const samplesDir = fileURLToPath(new URL('../samples/', import.meta.url));
const samples = readdirSync(samplesDir).filter(name => name.endsWith('.json'));

const ajv = new Ajv({ allErrors: true, strict: true, discriminator: true });
const validateProcess = ajv.compile(read('../schema/process.schema.json'));
const validateEvent = ajv.compile(read('../schema/event.schema.json'));
ajv.compile(read('../schema/instance.schema.json'));

/** Activity IDs an activity routes to */
function targets(activity) {
	switch (activity.type) {
		case 'sequence': return activity.activities;
		case 'switch': return [...Object.values(activity.cases ?? {}), activity.default, activity.then, activity.else].filter(Boolean);
		default: return [];
	}
}

/** Code-like strings of an activity */
function scripts(activity) {
	const code = Array.isArray(activity.code) ? activity.code.join('\n') : activity.code;
	return [code, activity.condition, activity.expression, activity.passWhen].filter(Boolean);
}

/** The {{...}} template paths in an api activity's url, headers, queryParams and body */
function templates(activity) {
	if (activity.type !== 'api') {
		return [];
	}
	const strings = [];
	const collect = value => {
		if (typeof value === 'string') strings.push(value);
		else if (value && typeof value === 'object') Object.values(value).forEach(collect);
	};
	collect([activity.url, activity.headers, activity.queryParams, activity.body]);
	return strings.flatMap(s => [...s.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)].map(m => m[1]));
}

// The syntax the current markup replaced
const OLD_SYNTAX = /(?<![\w$.])(?:a|v|var|p):[A-Za-z_]|\$title|(?<![\w$.])(?:process|properties|activities|this)\./;

test('there are samples', () => assert.ok(samples.length > 0));

for (const name of samples) {
	test(name, () => {
		const definition = JSON.parse(readFileSync(`${samplesDir}/${name}`, 'utf8'));
		const valid = validateProcess(definition);
		assert.ok(valid, ajv.errorsText(validateProcess.errors, { separator: '\n' }));

		const ids = new Set(Object.keys(definition.activities));
		assert.ok(ids.has(definition.start), `start '${definition.start}' is not an activity`);
		for (const [id, activity] of Object.entries(definition.activities)) {
			for (const target of targets(activity)) {
				assert.ok(ids.has(target), `${id} routes to unknown activity '${target}'`);
			}
			for (const script of scripts(activity)) {
				for (const [, ref] of script.matchAll(/\bacts\.([A-Za-z_$][\w$]*)|\bacts\[["']([^"']+)["']\]/g)) {
					assert.ok(ids.has(ref), `${id} reads unknown activity '${ref}'`);
				}
				assert.doesNotMatch(script, OLD_SYNTAX, `${id} uses old syntax`);
			}
			for (const path of templates(activity)) {
				const [root, ref] = path.split('.');
				assert.ok(['vars', 'props', 'acts', 'env', 'receive'].includes(root), `${id} uses unknown template {{${path}}}`);
				if (root === 'acts') {
					assert.ok(ids.has(ref), `${id} reads unknown activity '${ref}' in {{${path}}}`);
				}
				if (root === 'receive') {
					assert.equal(definition.activities[ref]?.type, 'receive', `${id}: {{${path}}} must name a receive activity`);
				}
			}
		}
	});
}

test('the README examples are valid', () => {
	const readme = readFileSync(fileURLToPath(new URL('../README.md', import.meta.url)), 'utf8');
	const blocks = [...readme.matchAll(/```json\r?\n([\s\S]*?)```/g)].map(m => m[1].trim());
	// Whole processes and events validate as they are; activity snippets ("id": {...})
	// and top-level keys ("properties": [...]) inside a minimal process
	let checked = 0;
	let events = 0;
	for (const block of blocks) {
		let definition;
		if (block.startsWith('{')) {
			const object = JSON.parse(block);
			if ('at' in object && 'type' in object) {
				assert.ok(validateEvent(object), `${block.slice(0, 60)}...\n${ajv.errorsText(validateEvent.errors)}`);
				events++;
				continue;
			}
			if (Object.keys(object).every(key => key === 'properties' || key === 'variables')) {
				// Starting values for a run
				for (const values of Object.values(object)) {
					assert.equal(typeof values, 'object', 'starting values are objects');
				}
				continue;
			}
			definition = object;
		} else if (/^"[\w-]+": \{/.test(block)) {
			const activities = JSON.parse(`{${block}}`);
			const targets = Object.values(activities).flatMap(activity => [
				...(activity.activities ?? []), ...Object.values(activity.cases ?? {}), activity.default, activity.then, activity.else
			]).filter(Boolean);
			for (const id of targets) activities[id] ??= { type: 'terminate' };
			definition = { id: 'readme', name: 'README', start: Object.keys(activities)[0], activities };
		} else {
			// A top-level key: dataGenerators, properties
			definition = { id: 'readme', name: 'README', start: 'a', activities: { a: { type: 'terminate' } }, ...JSON.parse(`{${block}}`) };
		}
		assert.ok(validateProcess(definition), `${block.slice(0, 60)}...\n${ajv.errorsText(validateProcess.errors)}`);
		checked++;
	}
	assert.ok(checked >= 10, `checked ${checked} examples`);
	assert.ok(events >= 1, `checked ${events} events`);
});
