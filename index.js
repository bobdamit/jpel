// The JPEL JSON Schemas. See README.md for how to compile them with Ajv.
import processSchema from './schema/process.schema.json' with { type: 'json' };
import instanceSchema from './schema/instance.schema.json' with { type: 'json' };
import eventSchema from './schema/event.schema.json' with { type: 'json' };

export { processSchema, instanceSchema, eventSchema };
