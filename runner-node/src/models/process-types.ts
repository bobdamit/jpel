import { ActivityInstance, HumanTaskData } from "./instance-types";
import { DataGenerator } from "./data-generator-types";
import { FieldType, ValueOption, FileSpec, FieldDataGenerator } from "./common-types";

// Core types from the updated JPEL schema
export interface ProcessDefinition {
	id: string;
	name: string;
	description?: string;
	version?: string;
	variables?: Variable[];
	properties?: PropertyDefinition[]; // Property schemas for instance-level metadata
	start: string; // Initial activity reference (a:activityId)
	activities: { [key: string]: Activity };
	dataGenerators?: DataGenerator[]; // Data generators for auto-generated values
	ownerUserId?: string;
	organizationId?: string;
	visibility?: 'tenant' | 'system';
	createdAt?: string;
	updatedAt?: string;
}

/**
 * Lightweight representation of a process template for listing purposes
 * Contains only essential metadata without loading the full process definition
 */
export interface ProcessTemplateFlyweight {
	id: string;
	name: string;
	description?: string;
	version?: string;
	ownerUserId?: string;
	organizationId?: string;
	visibility?: 'tenant' | 'system';
}

export interface Activity {
	id?: string; // Optional - will be derived from map key if not provided
	name?: string;
	description?: string;
	type: ActivityType;
	timeout?: number; // seconds
}


export enum ActivityType {
	Human = "human",
	Compute = "compute",
	API = "api",
	Sequence = "sequence",
	Parallel = "parallel",
	Branch = "branch",
	Switch = "switch",
	Terminate = "terminate"
}

// Specific activity types (DEFINITIONS)
export interface HumanActivity extends Activity {
	type: ActivityType.Human;
	prompt?: string;
	inputs?: Variable[]; // Definition-time: field schemas (Variable without value)
}

export interface APIActivity extends Activity {
	type: ActivityType.API;
	method: HttpMethod;
	url: string;
	headers?: { [key: string]: string };
	queryParams?: { [key: string]: string };
	body?: any;
	timeout?: number; // Timeout in seconds, defaults to 30
	retries?: number; // Number of retries on failure, defaults to 0
	expectedStatus?: number[]; // Expected HTTP status codes, defaults to [200]
	code?: string[]; // Optional code to process the response
}


export enum HttpMethod {
	GET = "GET",
	POST = "POST",
	PUT = "PUT",
	DELETE = "DELETE"
}

export interface ComputeActivity extends Activity {
	type: ActivityType.Compute;
	code: string[];
}



export interface SequenceActivity extends Activity {
	type: ActivityType.Sequence;
	activities: string[];
}


export interface ParallelActivity extends Activity {
	type: ActivityType.Parallel;
	activities: string[];
}


export interface BranchActivity extends Activity {
	type: ActivityType.Branch;
	condition: string;
	then: string;
	else?: string;
}


export interface SwitchActivity extends Activity {
	type: ActivityType.Switch;
	expression: string;
	cases: { [key: string]: string };
	default?: string;
}


export interface TerminateActivity extends Activity {
	type: ActivityType.Terminate;
	reason?: string;
	result?: 'success' | 'failure';
}

/**
 * Variable: A typed value holder used throughout the process lifecycle
 * 
 * Usage contexts:
 * 1. DEFINITION TIME - Process-level variable schemas (ProcessDefinition.variables)
 * 2. DEFINITION TIME - Activity input schemas (HumanActivity.inputs)
 * 3. RUNTIME - Activity instance values (ActivityInstance.variables with actual values)
 * 
 * At definition time: 'value' is undefined, only schema properties are set
 * At runtime: 'value' contains the actual data, schema properties guide validation/rendering
 */
export interface Variable {
	name: string;
	label?: string;
	hint?: string;
	placeholder?: string;
	type: FieldType;
	value?: any; // Runtime value (undefined at definition time)
	defaultValue?: any;
	description?: string;
	required?: boolean;
	options?: ValueOption[]; // For select/enum fields, label/value pairs
	min?: number; // for numeric types
	max?: number; // for numeric types
	units?: string;
	pattern?: string; // Regex pattern for validation
	patternDescription?: string; // Description of the pattern for UI display
	fileSpec?: FileSpec; // For file fields, specify allowed types and extensions
	dataGenerator?: FieldDataGenerator; // For auto-generated values like serial numbers
}

/**
 * Field: Type alias for Variable when used as an input schema in activity definitions
 * Semantically: Field emphasizes "this is a form field definition"
 * Functionally: Identical to Variable
 */
export type Field = Variable;

/**
 * PropertyDefinition: Schema for instance-level properties at definition time
 * 
 * Similar to Variable but simpler - properties are always strings and used for
 * instance-level metadata like title, summary data, etc.
 * 
 * At runtime, actual property values are stored in ProcessInstance.properties
 * 
 * JPEL syntax: p:propertyName (e.g., p:title = "value")
 */
export interface PropertyDefinition {
	id: string; // ID for referencing in JPEL expressions
	name: string; // Friendly name for display
	defaultValue?: string; // Optional default value
	includeInSummary?: boolean; // Whether to show in instance list/summary view
}



