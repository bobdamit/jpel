import { FileMetadata, FileReference, FileUploadRequest, FileListOptions } from '../models/file-types';

/**
 * Repository interface for file storage operations
 * Implementations can use S3, local filesystem, database BLOBs, etc.
 */
export interface FileRepository {
	/**
	 * Store a new file and return its metadata
	 * @param uploadRequest File upload details
	 * @returns Promise resolving to the stored file metadata
	 */
	store(uploadRequest: FileUploadRequest): Promise<FileReference>;

	/**
	 * Retrieve file data by ID
	 * @param fileId Unique file identifier
	 * @returns Promise resolving to file data, or null if not found
	 */
	retrieve(fileId: string): Promise<FileReference | null>;

	/**
	 * Get file metadata without content
	 * @param fileId Unique file identifier
	 * @returns Promise resolving to file metadata, or null if not found
	 */
	getMetadata(fileId: string): Promise<FileMetadata | null>;

	/**
	 * Delete a file
	 * @param fileId Unique file identifier
	 * @returns Promise resolving to true if deleted, false if not found
	 */
	delete(fileId: string): Promise<boolean>;

	/**
	 * List files with optional filtering
	 * @param options Filtering and pagination options
	 * @returns Promise resolving to array of file metadata
	 */
	list(options?: FileListOptions): Promise<FileMetadata[]>;

	/**
	 * Check if a file exists
	 * @param fileId Unique file identifier
	 * @returns Promise resolving to true if file exists
	 */
	exists(fileId: string): Promise<boolean>;

}

