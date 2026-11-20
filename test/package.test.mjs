// The package entry point exports the schemas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import Ajv from 'ajv';
import { processSchema, instanceSchema } from '@rockscience/jpel';

test('the entry point exports both schemas and they compile', () => {
	assert.equal(processSchema.title, 'JPEL process definition');
	assert.equal(instanceSchema.title, 'JPEL process run');
	const ajv = new Ajv({ allErrors: true, strict: true, discriminator: true });
	ajv.compile(processSchema);
	ajv.compile(instanceSchema);
});
