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
		}
	});
}
