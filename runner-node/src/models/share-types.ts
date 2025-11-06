/**
 * Share link types for public access to process instances
 */

import { AggregatePassFail } from './instance-types';
import { PassFail } from './instance-types';

/**
 * Share token metadata
 */
export interface ShareToken {
	/** Unique token ID */
	token: string;
	/** Process instance ID this token provides access to */
	instanceId: string;
	/** Process ID for context */
	processId: string;
	/** User who created the share link */
	createdBy: string;
	/** Organization ID for tenant isolation */
	organizationId?: string;
	/** When the token was created */
	createdAt: Date;
	/** When the token expires (default: 7 days) */
	expiresAt: Date;
	/** Whether the token is active */
	active: boolean;
	/** Optional description/title for the share */
	title?: string;
	/** Access level permissions */
	permissions: SharePermissions;
}

/**
 * Permissions for shared access
 */
export interface SharePermissions {
	/** Allow viewing instance summary */
	viewSummary: boolean;
	/** Allow viewing activity details and variables */
	viewActivities: boolean;
	/** Allow viewing and downloading files */
	viewFiles: boolean;
	/** Allow viewing process definition (read-only) */
	viewProcessDefinition: boolean;
}

/**
 * Public view of process instance for sharing
 */
export interface PublicInstanceView {
	/** Instance basic info */
	instanceId: string;
	processId: string;
	processName: string;
	title?: string;
	status: string;
	aggregatePassFail?: AggregatePassFail; 
	startedAt: Date;
	completedAt?: Date;

	/** Process definition info (if allowed) */
	processDefinition?: {
		name: string;
		description?: string;
		version: string;
	};

	/** Activity summary */
	activities: PublicActivityView[];

	/** Files associated with this instance */
	files: PublicFileView[];

	/** Share metadata */
	shareInfo: {
		title?: string;
		createdAt: Date;
		expiresAt: Date;
	};
}

/**
 * Public view of an activity
 */
export interface PublicActivityView {
	activityId: string;
	name?: string;
	description?: string;
	type: string;
	status: string;
	passFail?: PassFail;
	startedAt?: Date;
	completedAt?: Date;
	/** Variables (filtered for public viewing) */
	variables: PublicVariableView[];
}

/**
 * Public view of a variable
 */
export interface PublicVariableView {
	name: string;
	type: string;
	value: any;
	description?: string;
	/** For file variables, include public access info */
	fileInfo?: {
		filename: string;
		mimeType: string;
		sizeBytes: number;
		url: string;
		thumbnailUrl?: string;
	};
}

/**
 * Public view of a file
 */
export interface PublicFileView {
	fileId: string;
	filename: string;
	mimeType: string;
	sizeBytes: number;
	createdAt: Date;
	activityId: string;
	variableName: string;
	description?: string;
	/** Public access URLs */
	url: string;
	thumbnailUrl?: string;
	/** File type category for UI */
	category: 'image' | 'document' | 'video' | 'audio' | 'archive' | 'other';
}

/**
 * Request to create a share link
 */
export interface CreateShareRequest {
	instanceId: string;
	title?: string;
	expiresInDays?: number; // Default: 7 days
	permissions?: Partial<SharePermissions>;
}

/**
 * Response with share link
 */
export interface ShareLinkResponse {
	shareUrl: string;
	token: string;
	expiresAt: Date;
}