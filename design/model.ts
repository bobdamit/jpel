export interface Process {
	pid: string;
	name: string;
	description?: string;
	activityRepo?: Activity[];
	variables?: Variable[];
	activities?: Activity[] | string[];
}

interface Activity {
	aid: string;
	name?: string;
	description?: string;
	type: ActivityType;
	status?: ActivityStatus;
	passFail?: PassFail;
}


// BPEL Activity Types
export enum ActivityType {
	HumanTask = "HumanTask",
	Compute = "Compute",
	Terminate = "Terminate",
	Sequence = "Sequence",
	RestAPI = "RestAPI",
	Flow = "Flow",
	Case = "Case",
	If = "If",
	While = "While",
	Catch = "Catch",
}

export interface HumanTaskActivity extends Activity {
	type: ActivityType.HumanTask;
	subject?: string;
	inputs : Value[] | string[]
	fieldSets?: FieldSet[];
	fileUploads?: FileUpload[];
	attachments?: Attachment[];
}

export interface FieldSet {
	name: string;
	variables: Variable[];
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

export interface RestAPIActivity extends Activity {
	type: ActivityType.RestAPI;
	timeoutSeconds?: number;
	method: HttpMethod;
	url: string;
	headers: KeyValue[];
	querieParams?: KeyValue[];
	request?: any;
	response?: any;
}

export interface KeyValue {
	key: string;
	value: string;
}

export enum HttpMethod {
	GET = "GET",
	POST = "POST",
	PUT = "PUT",
	DELETE = "DELETE",
}

/**
 * Execute a group of Activites in Parallel
 */
export interface FlowActivity extends Activity {
	type: ActivityType.Flow;
	activities?: Activity[] | string[];
}

/**
 * Execute a group of Activites in Sequence
 */
export interface SequenceActivity extends Activity {
	type: ActivityType.Sequence;
	activities?: Activity[] | string[];
}

/**
 * Execute some scripting code. The script has access
 * to the process and activity variables and can
 * manipulate them.
 * The script also has access to the response model of
 * any RestAPI activity
 */
export interface ComputeActivity extends Activity {
	type: ActivityType.Compute;
	language: ScriptLang;
	code: string[];
	output?: Variable[];
}

export enum ScriptLang {
	JS = "JS",
}

export interface TerminateActivity extends Activity {
	type: ActivityType.Terminate;
	reason: string;
}

/** 
 * Evaluate a condition and branch to one Activity or another 
*/
export interface IfActivity extends Activity {
	type: ActivityType.If;
	condition?: string;
	then?: Activity;
	else?: Activity;
}

/**
 * Evaluate a condition and branch to various activites based
 * on the condition
 */
export interface CaseActivity extends Activity {
	type: ActivityType.Case;
	cases?: Case[];
}

export interface Case {
	condition: string;
	activity?: Activity | string;
}

/**
 * Execute a group of activities while a condition is true
 */
export interface WhileActivity extends Activity {
	type: ActivityType.While;
	condition?: string;
	activity?: Activity | string;
}

export interface Value {
	name: string;
	description: string;
	vid: string;
	value?: any;
	type: ValueType;
}

/**
 * Variables are rich data that define the scope,
 * type, constraints and default values of the data
 *
 * They can be referenced with the following format:
 * $Namespace.VariableID
 * $Namespace defines the scope of the variable such as
 * $Process
 * $Activity['activityid']
 *
 * For example:
 * $Process.my-var
 * $Activity['my-activity'].my-var
 *
 * @export
 * @interface Variable
 */
export interface Variable extends Value {
	defaultValue?: any;
	constraint?: VariableConstraint;
	presentation?: VariablePresentation;
}

/**
 * Variable Presentation
 *
 * Some presentation data for a variable
 * Used for HumanTask Activities.
 */
export interface VariablePresentation {
	units?: string;
	precision?: number;
	format?: string;
}


/**
 * Some constraints for a variable. Can be use for
 * form validation on HumanTask activities
 */
export interface VariableConstraint {
	allowedValues?: any[];
	required?: boolean;
	pattern?: string;
	minLength?: number;
	maxLength?: number;
	min?: number;
	max?: number;
}

/**
 * Variable Scope
 *
 * Some scope data for a variable
 * Used for HumanTask Activities.
 */
export interface VariableScope {
	activity: string;
	process: string;
}

/**
 * Variable Types
 */
export enum ValueType {
	String = "String",
	Number = "Number",
	Boolean = "Boolean",
	Enum = "Enum",
	Object = "Object",
	Array = "Array",
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
