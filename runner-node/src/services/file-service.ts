import { FileRepository } from '../repositories/file-repository';
import { RepositoryFactory } from '../repositories/repository-factory';
import { FileMetadata, FileReference, FileUploadRequest, FileAssociation } from '../models/file-types';
import { Variable } from '../models/process-types';
import { FieldType } from '../models/common-types';
import { logger } from '../logger';

/**
 * Service for managing files within the JPEL process engine
 * Provides high-level operations and integration with variables
 */
export class FileService {
	private fileRepo: FileRepository;

	constructor() {
		this.fileRepo = RepositoryFactory.getFileRepository();
	}

	/**
	 * Get the underlying repository (for direct access when needed)
	 */
	getRepository(): FileRepository {
		return this.fileRepo;
	}

	/**
	 * Upload a file and create a variable for it with process association
	 * @param uploadData File upload details
	 * @param variableName Name for the variable to create
	 * @param processInstanceId Process instance ID to associate with
	 * @param activityId Activity ID where file was uploaded
	 * @returns Variable containing the file reference
	 */
	async uploadAndCreateVariable(
		uploadData: { filename: string; mimeType: string; content: Buffer; description?: string },
		variableName: string,
		processInstanceId: string,
		activityId: string,
		processId: string,
		userContext: { userId: string; organizationId?: string } = { userId: 'system' }
	): Promise<Variable> {
		logger.info('FileService: Uploading file and creating variable', {
			filename: uploadData.filename,
			variableName,
			size: uploadData.content.length
		});

		const uploadRequest: FileUploadRequest = {
			fileAssociation: {
				fileId: '', // Will be set by repository
				processId,
				processInstanceId,
				activityId,
				variableName,
				tenantUserId: userContext.userId,
				tenantOrgId: userContext.organizationId
			},
			filename: uploadData.filename,
			mimeType: uploadData.mimeType,
			content: uploadData.content,
			description: uploadData.description
		};

		const fileReference = await this.fileRepo.store(uploadRequest);

		const variable: Variable = {
			name: variableName,
			type: FieldType.File,
			value: fileReference,
			description: `File: ${fileReference.metadata.filename}`
		};

		logger.info('FileService: File uploaded and variable created', {
			fileId: fileReference.metadata.id,
			variableName,
			filename: fileReference.metadata.filename
		});

		return variable;
	}

	/**
	 * Create multiple file variables from uploaded files (like from a form submission)
	 * @param files Array of uploaded file data
	 * @param baseVariableName Base name for variables (will append index if multiple)
	 * @param processInstanceId Process instance ID to associate with
	 * @param activityId Activity ID where files were uploaded
	 * @param processId Process ID
	 * @returns Array of created variables
	 */
	async createVariablesFromUploads(
		files: { filename: string; mimeType: string; content: Buffer; description?: string }[],
		baseVariableName: string = 'uploadedFile',
		processInstanceId: string,
		activityId: string,
		processId: string,
		userContext: { userId: string; organizationId?: string } = { userId: 'system' }
	): Promise<Variable[]> {
		logger.info('FileService: Creating variables from multiple uploads', {
			fileCount: files.length,
			baseVariableName
		});

		const variables: Variable[] = [];

		for (let i = 0; i < files.length; i++) {
			const file = files[i];
			const variableName = files.length === 1 ? baseVariableName : `${baseVariableName}_${i + 1}`;

			const variable = await this.uploadAndCreateVariable(
				file,
				variableName, 
				processInstanceId,
				activityId,
				processId,
				userContext
			);
			variables.push(variable);
		}

		logger.info('FileService: Created variables from uploads', {
			variableCount: variables.length,
			variableNames: variables.map(v => v.name)
		});

		return variables;
	}

	/**
	 * Get file reference from a variable
	 * @param variable Variable that should contain a file reference
	 * @returns File reference or null if variable doesn't contain a file
	 */
	getFileReferenceFromVariable(variable: Variable): FileReference | null {
		if (variable.type !== FieldType.File) {
			return null;
		}

		const value = variable.value;
		if (!value || typeof value !== 'object' || !value.metadata?.id) {
			return null;
		}

		return value as FileReference;
	}

	/**
	 * Download file data from a variable (returns the FileReference)
	 * @param variable Variable containing file reference
	 * @returns FileReference or null if not a valid file variable
	 */
	async downloadFromVariable(variable: Variable): Promise<FileReference | null> {
		const fileRef = this.getFileReferenceFromVariable(variable);
		if (!fileRef) {
			logger.warn('FileService: Variable does not contain a valid file reference', {
				variableName: variable.name,
				variableType: variable.type
			});
			return null;
		}

		// Verify file still exists
		const exists = await this.fileRepo.exists(fileRef.metadata.id);
		if (!exists) {
			logger.warn('FileService: Referenced file no longer exists', {
				fileId: fileRef.metadata.id
			});
			return null;
		}

		return fileRef;
	}

	/**
	 * Update variables array with file variables
	 * Utility method for activities to add file variables to their variables array
	 * @param variables Existing variables array
	 * @param fileVariables New file variables to add
	 */
	updateVariablesWithFiles(variables: Variable[], fileVariables: Variable[]): void {
		for (const fileVariable of fileVariables) {
			// Check if variable already exists
			const existingIndex = variables.findIndex(v => v.name === fileVariable.name);
			
			if (existingIndex >= 0) {
				// Replace existing variable
				variables[existingIndex] = fileVariable;
				logger.debug('FileService: Replaced existing file variable', {
					variableName: fileVariable.name
				});
			} else {
				// Add new variable
				variables.push(fileVariable);
				logger.debug('FileService: Added new file variable', {
					variableName: fileVariable.name
				});
			}
		}
	}

	/**
	 * Get all files associated with a process instance
	 * @param processInstanceId Process instance ID
	 * @returns Array of file references
	 */
	async getProcessFiles(processInstanceId: string): Promise<FileReference[]> {
		// Use the repository's getProcessFiles method if available, otherwise filter the list
		const repo = this.fileRepo as any;
		if (repo.getProcessFiles) {
			return await repo.getProcessFiles(processInstanceId);
		}

		// Fallback: use list with filter
		const allFiles = await this.fileRepo.list({ instanceId: processInstanceId });
		const fileReferences: FileReference[] = [];

		for (const metadata of allFiles) {
			const fileRef = await this.fileRepo.retrieve(metadata.id);
			if (fileRef) {
				fileReferences.push(fileRef);
			}
		}

		return fileReferences;
	}
}