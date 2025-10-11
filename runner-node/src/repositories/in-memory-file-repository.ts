import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { FileRepository } from './file-repository';
import { FileMetadata, FileReference, FileUploadRequest, FileAssociation, FileListOptions } from '../models/file-types';
import { logger } from '../logger';

/**
 * In-memory implementation of FileRepository for demo/testing purposes
 * In production, this would be replaced with S3Repository, FSRepository, etc.
 */
export class InMemoryFileRepository implements FileRepository {
	private files: Map<string, { metadata: FileMetadata; content: Buffer; association: FileAssociation }> = new Map();

	constructor() {
		logger.info('InMemoryFileRepository: Initialized');
	}

	async store(uploadRequest: FileUploadRequest): Promise<FileReference> {
		const fileId = uuidv4();
		const checksum = createHash('sha256').update(uploadRequest.content).digest('hex');
		
		const metadata: FileMetadata = {
			id: fileId,
			filename: uploadRequest.filename,
			mimeType: uploadRequest.mimeType,
			sizeBytes: uploadRequest.content.length,
			createdAt: new Date(),
			description: uploadRequest.description,
			tags: uploadRequest.tags || [],
			createdBy: uploadRequest.uploadedBy,
			checksum
		};

		// Store the association with the file ID set
		const association: FileAssociation = {
			...uploadRequest.fileAssociation,
			fileId
		};

		// Store file data with metadata, content, and association
		this.files.set(fileId, {
			metadata,
			content: uploadRequest.content,
			association
		});

		const fileReference: FileReference = {
			fileAssociation: association,
			metadata,
			url: this.buildUrl(fileId),
			thumbnailUrl: this.buildThumbnailUrl(fileId)
		};

		logger.info('InMemoryFileRepository: File stored', {
			fileId,
			filename: metadata.filename,
			sizeBytes: metadata.sizeBytes,
			mimeType: metadata.mimeType,
			processInstanceId: association.processInstanceId,
			activityId: association.activityId
		});

		return fileReference;
	}

	async retrieve(fileId: string): Promise<FileReference | null> {
		const fileData = this.files.get(fileId);
		if (!fileData) {
			logger.warn('InMemoryFileRepository: File not found for retrieval', { fileId });
			return null;
		}

		const fileReference: FileReference = {
			fileAssociation: fileData.association,
			metadata: fileData.metadata,
			url: `https://somefakeimageurl.com/api/files/${fileId}/download`,
			thumbnailUrl: this.isImage(fileData.metadata.mimeType)
				? `https://somefakeimageurl.com/api/files/${fileId}/thumbnail`
				: undefined
		};

		logger.debug('InMemoryFileRepository: File retrieved', {
			fileId,
			filename: fileData.metadata.filename
		});

		return fileReference;
	}

	async getMetadata(fileId: string): Promise<FileMetadata | null> {
		const fileData = this.files.get(fileId);
		if (!fileData) {
			return null;
		}
		return fileData.metadata;
	}

	async delete(fileId: string): Promise<boolean> {
		const deleted = this.files.delete(fileId);
		if (deleted) {
			logger.info('InMemoryFileRepository: File deleted', { fileId });
		} else {
			logger.warn('InMemoryFileRepository: File not found for deletion', { fileId });
		}
		return deleted;
	}

	async list(options: FileListOptions = {}): Promise<FileMetadata[]> {
		let results = Array.from(this.files.values()).map(fd => fd.metadata);

		// Apply filters based on associations
		if (options.processId || options.instanceId) {
			const filteredFileIds = Array.from(this.files.entries())
				.filter(([_, fileData]) => {
					const association = fileData.association;
					if (options.processId && association.processId !== options.processId) {
						return false;
					}
					if (options.instanceId && association.processInstanceId !== options.instanceId) {
						return false;
					}
					return true;
				})
				.map(([fileId, _]) => fileId);

			results = results.filter(metadata => filteredFileIds.includes(metadata.id));
		}

		// Apply other filters
		if (options.tags && options.tags.length > 0) {
			results = results.filter(metadata => 
				options.tags!.some(tag => metadata.tags?.includes(tag))
			);
		}

		if (options.mimeTypePattern) {
			const pattern = new RegExp(options.mimeTypePattern, 'i');
			results = results.filter(metadata => pattern.test(metadata.mimeType));
		}

		if (options.createdBy) {
			results = results.filter(metadata => metadata.createdBy === options.createdBy);
		}

		// Apply sorting
		if (options.sortBy) {
			results.sort((a, b) => {
				let aVal: any, bVal: any;
				
				switch (options.sortBy) {
					case 'filename':
						aVal = a.filename.toLowerCase();
						bVal = b.filename.toLowerCase();
						break;
					case 'createdAt':
						aVal = a.createdAt.getTime();
						bVal = b.createdAt.getTime();
						break;
					case 'size':
						aVal = a.sizeBytes;
						bVal = b.sizeBytes;
						break;
					default:
						return 0;
				}

				if (options.sortOrder === 'desc') {
					return bVal < aVal ? -1 : bVal > aVal ? 1 : 0;
				} else {
					return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
				}
			});
		}

		// Apply pagination
		if (options.offset || options.limit) {
			const start = options.offset || 0;
			const end = options.limit ? start + options.limit : undefined;
			results = results.slice(start, end);
		}

		return results;
	}

	async exists(fileId: string): Promise<boolean> {
		return this.files.has(fileId);
	}

	/**
	 * Get file content by ID (for download)
	 * @param fileId File ID
	 * @returns File content buffer or null if not found
	 */
	async getContent(fileId: string): Promise<Buffer | null> {
		const fileData = this.files.get(fileId);
		return fileData ? fileData.content : null;
	}

	/**
	 * Get all files associated with a process instance
	 * @param processInstanceId Process instance ID
	 * @returns Array of file references
	 */
	async getProcessFiles(processInstanceId: string): Promise<FileReference[]> {
		const results: FileReference[] = [];
		
		for (const [fileId, fileData] of this.files.entries()) {
			if (fileData.association.processInstanceId === processInstanceId) {
				results.push({
					fileAssociation: fileData.association,
					metadata: fileData.metadata,
					url: 'todo'
				});
			}
		}
		
		return results;
	}

	/**
	 * Get current file count (for debugging/monitoring)
	 */
	getFileCount(): number {
		return this.files.size;
	}

	/**
	 * Clear all files (for testing)
	 */
	clear(): void {
		this.files.clear();
		logger.info('InMemoryFileRepository: All files and associations cleared');
	}

	/**
	 * Check if a MIME type represents an image
	 */
	private isImage(mimeType: string): boolean {
		return mimeType.startsWith('image/');
	}

	private buildUrl(fileId: string): string {
		const fd = this.files.get(fileId);
		if (!fd) {
			throw new Error('File not found');
		}
		return `https://fakeurl.com/files/${fd.association.processInstanceId}/${fileId}`;
	}

	private buildThumbnailUrl(fileId: string): string {
		const fd = this.files.get(fileId);
		if (!fd) {
			throw new Error('File not found');
		}
		if(this.isImage(fd.metadata.mimeType) === false) {
			// todo: use real icon based on mime type
			return 'fileicon'; // Return generic file icon for non-images
		}
		return `https://fakeurl.com/files/${fd.association.processInstanceId}/${fileId}/thumbnail`;
	}
}