/**
 * Process Definition - the template/blueprint for a process
 */
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
 * Process Runtime Instance - a running instance of a process definition
 */
export interface ProcessInstance {
	instanceId: string;
	processId: string;
	status: ProcessStatus;
	startedAt: Date;
	completedAt?: Date;
	currentActivity?: string;
	variables: { [key: string]: any };
	activities: { [key: string]: ActivityInstance };
}

export enum ProcessStatus {
	Running = "Running",
	Completed = "Completed",
	Failed = "Failed",
	Cancelled = "Cancelled"
}

/**
 * Activity Definition - the template for an activity
 */
interface Activity {
	id: string;
	name?: string;
	description?: string;
	type: ActivityType;
	timeout?: number; // seconds
}

/**
 * Activity Runtime Instance - a running instance of an activity
 */
export interface ActivityInstance extends Activity {
	status: ActivityStatus;
	passFail?: PassFail;
	startedAt?: Date;
	completedAt?: Date;
	data?: { [key: string]: any }; // User input data from forms, API responses, etc.
	error?: string;
}

// Simplified Activity Types
export enum ActivityType {
	Human = "human",
	Compute = "compute",
	API = "api",
	Sequence = "sequence",
	Parallel = "parallel",
	Branch = "branch",
	Terminate = "terminate"
}

export interface HumanActivity extends Activity {
	type: ActivityType.Human;
	prompt?: string;
	inputs?: Field[];
	fileUploads?: FileUpload[];
	attachments?: Attachment[];
}

export interface Field {
	name: string;
	type: FieldType;
	required?: boolean;
	options?: string[]; // For select/enum fields
	min?: number;
	max?: number;
	units?: string;
	defaultValue?: any;
	description?: string;
}

export enum FieldType {
	Text = "text",
	Number = "number",
	Boolean = "boolean",
	Select = "select",
	Date = "date",
	File = "file"
}

/**
 * File upload details for a Human Task
 */
export interface FileUpload {
	name: string;				// Identifier for the file
	description?: string;		// Description of the expected file
	allowedTypes: string[];		// Allowed MIME types (e.g., ["image/png", "application/pdf"])
	maxBytes: number;			// Maximum file size in bytes
	minCount: number;			// Minimum number of files required
	maxCount: number;			// Maximum number of files allowed
}

/**
 * Attachment details for a Human Task
 */
export interface Attachment {
	name: string;
	objectUrl: string;
	previewUrl: string;
	mediaType: string;
	bytes	: number;
}

export interface APIActivity extends Activity {
	type: ActivityType.API;
	method: HttpMethod;
	url: string;
	headers?: { [key: string]: string };
	queryParams?: { [key: string]: string };
	body?: any;
}

export enum HttpMethod {
	GET = "GET",
	POST = "POST",
	PUT = "PUT",
	DELETE = "DELETE"
}

/**
 * Execute a group of activities in parallel
 */
export interface ParallelActivity extends Activity {
	type: ActivityType.Parallel;
	activities: string[]; // Array of activity references (a:activityId)
}

/**
 * Execute a group of activities in sequence
 */
export interface SequenceActivity extends Activity {
	type: ActivityType.Sequence;
	activities: string[]; // Array of activity references (a:activityId)
}

/**
 * Execute JavaScript code. The script has access to:
 * - a:activityId.f:fieldName (activity field values)
 * - a:activityId.status (activity status)
 * - this.data (current activity data)
 */
export interface ComputeActivity extends Activity {
	type: ActivityType.Compute;
	code: string[];
}



export interface TerminateActivity extends Activity {
	type: ActivityType.Terminate;
	reason?: string;
	result?: 'success' | 'failure';
}

/**
 * Conditional branching - supports if/else and multiple conditions
 */
export interface BranchActivity extends Activity {
	type: ActivityType.Branch;
	condition: string;
	then: string; // Activity reference (a:activityId)
	else?: string; // Activity reference (a:activityId)
}



/**
 * Process-level variable definition
 * Can be referenced as: process.variableName
 */
export interface Variable {
	name: string;
	type: FieldType;
	defaultValue?: any;
	description?: string;
}

/**
 * Activity Execution Status
 */
export enum ActivityStatus {
	Pending = "Pending",
	InProgress = "InProgress",
	Completed = "Completed",
	Failed = "Failed",
	Cancelled = "Cancelled",
	TimedOut = "TimedOut",
}

/**
 * Activity Pass/Fail Status
 */
export enum PassFail {
	Pass = "Pass",
	Fail = "Fail",
}
