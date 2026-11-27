// Types for index.js. The schemas are plain JSON Schema (draft-07) objects;
// pass them to Ajv's compile().

/** A JSON Schema document. */
export interface JsonSchema {
	readonly $schema: string;
	readonly $id: string;
	readonly title: string;
	readonly [keyword: string]: unknown;
}

/** Validates JPEL process definitions. */
export declare const processSchema: JsonSchema;

/** Describes JPEL process runs (instances). */
export declare const instanceSchema: JsonSchema;

/** Validates JPEL run events, as engines send them to other systems. */
export declare const eventSchema: JsonSchema;
