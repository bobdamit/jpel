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

export interface ProcessInstanceFlyweight {
	instanceId: string;
	processId: string;
	title?: string;
	status: ProcessStatus;
	startedAt: Date;
	completedAt?: Date;
}

export interface ProcessInstance {
	instanceId: string;
	processId: string;
	title?: string;
	status: ProcessStatus;
	startedAt: Date;
	completedAt?: Date;
	currentActivity?: string;
	variables: { [key: string]: any };
	activities: { [key: string]: ActivityInstance };
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

/**
 * Base runtime instance that extends the activity definition with execution state
 */
export interface ActivityInstance extends Activity {
	status: ActivityStatus;
	passFail?: PassFail;
	startedAt?: Date;
	completedAt?: Date;
	error?: string;
	variables?: Variable[]; // Consistent variable storage across all activity types
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
	fileUploads?: FileUpload[];
	attachments?: Attachment[];
}

/**
 * Runtime instance of a human activity with collected field values
 */
export interface HumanActivityInstance extends ActivityInstance, HumanActivity {
	type: ActivityType.Human;
	// Note: variables are now stored in base ActivityInstance.variables
	// inputs from HumanActivity definition are converted to variables at runtime
	_files?: any[]; // Uploaded files
}

/**
 * Field definition for activity inputs (definition-time schema)
 * Used in process templates to define expected inputs
 */
export interface Field {
	name: string;
	type: FieldType;
	required?: boolean;
	options?: ValueOption[]; // For select/enum fields
	min?: number;
	max?: number;
	units?: string;
	defaultValue?: any;
	description?: string;
	pattern?: string; // Regex pattern for validation
	patternDescription?: string; // Description of the pattern for UI display
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

export interface FileUpload {
	name: string;
	description?: string;
	allowedTypes: string[];
	maxBytes: number;
	minCount?: number;
	maxCount?: number;
}

export interface Attachment {
	name: string;
	url: string;
	mediaType: string;
	bytes?: number;
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

/**
 * Runtime instance of an API activity with response data
 */
export interface APIActivityInstance extends ActivityInstance, APIActivity {
	type: ActivityType.API;
	responseData?: any; // API response data
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

/**
 * Runtime instance of a compute activity with execution results
 */
export interface ComputeActivityInstance extends ActivityInstance, ComputeActivity {
	type: ActivityType.Compute;
}

export interface SequenceActivity extends Activity {
	type: ActivityType.Sequence;
	activities: string[];
}

/**
 * Runtime instance of a sequence activity with execution state
 */
export interface SequenceActivityInstance extends ActivityInstance, SequenceActivity {
	type: ActivityType.Sequence;
	sequenceIndex?: number;
	sequenceActivities?: string[];
}

export interface ParallelActivity extends Activity {
	type: ActivityType.Parallel;
	activities: string[];
}

/**
 * Runtime instance of a parallel activity with execution state
 */
export interface ParallelActivityInstance extends ActivityInstance, ParallelActivity {
	type: ActivityType.Parallel;
	parallelState?: 'running' | 'completed';
	activeActivities?: string[];
	completedActivities?: string[];
}

export interface BranchActivity extends Activity {
	type: ActivityType.Branch;
	condition: string;
	then: string;
	else?: string;
}

/**
 * Runtime instance of a branch activity with execution result
 */
export interface BranchActivityInstance extends ActivityInstance, BranchActivity {
	type: ActivityType.Branch;
	conditionResult?: boolean;
	nextActivity?: string;
}

export interface SwitchActivity extends Activity {
	type: ActivityType.Switch;
	expression: string;
	cases: { [key: string]: string };
	default?: string;
}

/**
 * Runtime instance of a switch activity with execution result
 */
export interface SwitchActivityInstance extends ActivityInstance, SwitchActivity {
	type: ActivityType.Switch;
	expressionValue?: any;
	matchedCase?: string;
	nextActivity?: string;
}

export interface TerminateActivity extends Activity {
	type: ActivityType.Terminate;
	reason?: string;
	result?: 'success' | 'failure';
}

export interface Variable {
	name: string;
	type: FieldType;
	value?: any; // Runtime value
	defaultValue?: any;
	description?: string;
	required?: boolean;
	options?: string[]; // For select/enum fields
	min?: number;
	max?: number;
	units?: string;
	pattern?: string; // Regex pattern for validation
	patternDescription?: string; // Description of the pattern for UI display
}

/**
 * Runtime field value that extends Variable for form field compatibility
 * Used in UI contexts where field-specific properties are needed
 */
export interface FieldValue extends Variable {
	// FieldValue is now just an alias for Variable with field-specific semantics
}

// API Response types
export interface ApiResponse<T = any> {
	success: boolean;
	data?: T;
	error?: string;
	timestamp: string;
}

/**
 * Data structure for presenting a human task to the UI
 * This is a VIEW model, not a domain model
 */
export interface HumanTaskData {
	activityId: string;
	prompt?: string;
	fields: FieldValue[]; // UI needs FieldValue with all presentation properties
	fileUploads?: FileUpload[];
	attachments?: Attachment[];
	context?: { [key: string]: any }; // Additional context data, e.g., previous run data
}

/**
 * Result of a process execution step (NOT the entire process state)
 * This represents what happened after executing one step/activity
 */
export interface ProcessExecutionResult {
	instanceId: string;
	status: ProcessStatus; // Current status of the instance
	currentActivity?: string; // Which activity is now current (if any)
	message?: string; // Status message about what happened
	// Note: humanTask is a convenience for API responses when the result is "waiting for human input"
	// It's NOT part of the core domain model - just a view helper
	humanTask?: HumanTaskData;
}