/**
 * File storage types for the JPEL process engine
 * Files are treated as a special type of variable that can be stored and retrieved
 */

/**
 * Metadata about a file stored in the file repository
 */
export interface FileMetadata {
	/** Unique identifier for the file */
	id: string;
	/** Original filename */
	filename: string;
	/** MIME type of the file */
	mimeType: string;
	/** Size in bytes */
	sizeBytes: number;
	/** When the file was uploaded/created */
	createdAt: Date;
	/** Optional description or notes about the file */
	description?: string;
	/** Tags for categorization */
	tags?: string[];
	/** Who created/uploaded the file */
	createdBy?: string;
	/** Hash/checksum for integrity verification */
	checksum?: string;
}



/**
 * File reference for use in variables
 * This is what gets stored in Variable.value when type is FieldType.File
 * Contains presentation-layer information and access URL
 */
export interface FileReference {
	fileAssociation: FileAssociation;
	metadata: FileMetadata;
	thumbnailUrl?: string;
	url: string;
}

/**
 * File association with process instances
 * Tracks which files belong to which process instances and activities
 */
export interface FileAssociation {
	/** File ID */
	fileId?: string;
	processId: string;
	/** Process instance ID this file belongs to */
	processInstanceId: string;
	/** Activity ID where this file was created/uploaded */
	activityId: string;
	/** Variable name the file is associated with */
	variableName: string;

}

/**
 * Upload request for new files
 */
export interface FileUploadRequest {
	fileAssociation: FileAssociation;
	/** Original filename */
	filename: string;
	/** MIME type */
	mimeType: string;
	/** File content */
	content: Buffer;
	/** Optional description */
	description?: string;
	/** Optional tags */
	tags?: string[];
	/** Who is uploading */
	uploadedBy?: string;
}

/**
 * Options for listing files
 */
export interface FileListOptions {
	processId?: string;
	instanceId?: string;
	/** Filter by tags */
	tags?: string[];
	/** Filter by MIME type pattern */
	mimeTypePattern?: string;
	/** Filter by creator */
	createdBy?: string;
	/** Pagination: limit results */
	limit?: number;
	/** Pagination: offset for results */
	offset?: number;
	/** Sort field */
	sortBy?: 'filename' | 'createdAt' | 'size';
	/** Sort direction */
	sortOrder?: 'asc' | 'desc';
}