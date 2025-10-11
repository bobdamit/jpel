import { ActivityInstance, HumanTaskData } from "./instance-types";

// Core types from the updated JPEL schema
export interface ProcessDefinition {
	id: string;
	name: string;
	description?: string;
	version?: string;
	variables?: Variable[];
	start: string; // Initial activity reference (a:activityId)
	activities: { [key: string]: Activity };
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
}




export enum ProcessStatus {
	Running = "running",
	Completed = "completed",
	Failed = "failed",
	Cancelled = "cancelled"
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

export enum ActivityStatus {
	Pending = "pending",
	Running = "running",
	Completed = "completed",
	Failed = "failed",
	Cancelled = "cancelled",
	Timeout = "timeout"
}

export enum PassFail {
	Pass = "pass",
	Fail = "fail"
}

// Specific activity types (DEFINITIONS)
export interface HumanActivity extends Activity {
	type: ActivityType.Human;
	prompt?: string;
	inputs?: Field[]; // Definition-time: field schemas
}


/**
 * Field definition for activity inputs (definition-time schema)
 * Used in process templates to define expected inputs
 */
export interface Field {
	name: string;
	label?: string;
	hint?: string;
	type: FieldType;
	required?: boolean;
	options?: ValueOption[]; // For select/enum fields, allows label/value pairs
	min?: number;
	max?: number;
	units?: string;
	defaultValue?: any;
	description?: string;
	pattern?: string; // Regex pattern for validation
	patternDescription?: string; // Description of the pattern for UI display
	fileSpec? : FileSpec; // For file fields, specify allowed types and extensions
}

export interface FileSpec extends Field {
	extensions: string[] | ['*'];
	fileType?: string;
}

export interface ValueOption {
	label?: string;
	value: string | number | boolean;
}

export enum FieldType {
	Text = "text",
	Number = "number",
	Boolean = "boolean",
	Select = "select",
	Date = "date",
	File = "file",
}

export interface APIActivity extends Activity {
	type: ActivityType.API;
	method: HttpMethod;
	url: string;
	headers?: { [key: string]: string };
	queryParams?: { [key: string]: string };
	body?: any;
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

export interface Variable {
	name: string;
	label?: string;
	hint?: string;
	type: FieldType;
	value?: any; // Runtime value
	defaultValue?: any;
	description?: string;
	required?: boolean;
	options?: ValueOption[]; // For select/enum fields, label/value pairs
	min?: number;
	max?: number;
	units?: string;
	pattern?: string; // Regex pattern for validation
	patternDescription?: string; // Description of the pattern for UI display
	fileSpec? : FileSpec; // For file fields, specify allowed types and extensions
}

