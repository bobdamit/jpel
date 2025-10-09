import { Activity, ActivityStatus, ActivityType, APIActivity, Attachment, BranchActivity, ComputeActivity, 
	 FileUpload, HumanActivity, ParallelActivity, PassFail, ProcessStatus, SequenceActivity, SwitchActivity, Variable } from "./process-types";

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
	aggregatePassFail?: AggregatePassFail; 
}

export enum AggregatePassFail {
	AllPass = "all_pass",
	AnyFail = "any_fail"
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
 * Runtime instance of an API activity with response data
 */
export interface APIActivityInstance extends ActivityInstance, APIActivity {
	type: ActivityType.API;
	responseData?: any; // API response data
}

/**
 * Runtime instance of a compute activity with execution results
 */
export interface ComputeActivityInstance extends ActivityInstance, ComputeActivity {
	type: ActivityType.Compute;
}

/**
 * Runtime instance of a sequence activity with execution state
 */
export interface SequenceActivityInstance extends ActivityInstance, SequenceActivity {
	type: ActivityType.Sequence;
	sequenceIndex?: number;
	sequenceActivities?: string[];
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


/**
 * Runtime instance of a branch activity with execution result
 */
export interface BranchActivityInstance extends ActivityInstance, BranchActivity {
	type: ActivityType.Branch;
	conditionResult?: boolean;
	nextActivity?: string;
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