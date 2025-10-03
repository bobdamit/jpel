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
  Running = "running",
  Completed = "completed",
  Failed = "failed",
  Cancelled = "cancelled"
}

export interface Activity {
  id: string;
  name?: string;
  description?: string;
  type: ActivityType;
  timeout?: number; // seconds
}

export interface ActivityInstance extends Activity {
  status: ActivityStatus;
  passFail?: PassFail;
  startedAt?: Date;
  completedAt?: Date;
  data?: { [key: string]: any }; // User input data from forms, API responses, etc.
  error?: string;
}

export enum ActivityType {
  Human = "human",
  Compute = "compute",
  API = "api",
  Sequence = "sequence",
  Parallel = "parallel",
  Branch = "branch",
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

// Specific activity types
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

export interface TerminateActivity extends Activity {
  type: ActivityType.Terminate;
  reason?: string;
  result?: 'success' | 'failure';
}

export interface Variable {
  name: string;
  type: FieldType;
  defaultValue?: any;
  description?: string;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface HumanTaskData {
  activityId: string;
  prompt?: string;
  fields: Field[];
  fileUploads?: FileUpload[];
  attachments?: Attachment[];
}

export interface ProcessExecutionResult {
  instanceId: string;
  status: ProcessStatus;
  currentActivity?: string;
  humanTask?: HumanTaskData;
  message?: string;
}