
import { RepositoryFactory } from '../src/repositories/repository-factory';

import { InMemoryFileRepository } from '../src/repositories/in-memory-file-repository';
import { FileService } from '../src/services/file-service';
import { FileReference, FileUploadRequest } from '../src/models/file-types';
import { FieldType } from '../src/models/common-types';

describe('File System Integration', () => {
	let fileRepo: InMemoryFileRepository;
	let fileService: FileService;

	beforeEach(async () => {
		// Initialize repositories with in-memory implementations
		await RepositoryFactory.initializeInMemory();
		fileRepo = RepositoryFactory.getFileRepository() as InMemoryFileRepository;
		fileService = new FileService();
	});

	afterEach(() => {
		RepositoryFactory.reset();
	});

	test('should store and retrieve a file', async () => {
		const testContent = Buffer.from('Hello, this is a test file!');
		const uploadRequest: FileUploadRequest = {
			fileAssociation: {
				processId: 'process-789',
				processInstanceId: 'instance-456',
				activityId: 'activity-123',
				variableName: 'upload_1',
			},
			filename: 'test.txt',
			mimeType: 'text/plain',
			content: testContent,
			description: 'Test file for integration testing'
		};

		// Store the file
		const fileRef: FileReference = await fileRepo.store(uploadRequest);

		expect(fileRef.url).toBeDefined();
		expect(fileRef.metadata.id).toBeDefined();
		expect(fileRef.metadata.filename).toBe('test.txt');
		expect(fileRef.metadata.mimeType).toBe('text/plain');
		expect(fileRef.metadata.sizeBytes).toBe(testContent.length);
		expect(fileRef.metadata.description).toBe('Test file for integration testing');

		// Retrieve the file
		const retrievedFileRef = await fileRepo.retrieve(fileRef.metadata.id);

		expect(retrievedFileRef).not.toBeNull();
		expect(retrievedFileRef!.metadata.filename).toBe('test.txt');
		expect(retrievedFileRef!.url).toBeDefined();
	});

	test('should create file variables from uploads', async () => {
		const files = [
			{
				filename: 'document1.pdf',
				mimeType: 'application/pdf',
				content: Buffer.from('PDF content here'),
				description: 'First document'
			},
			{
				filename: 'image1.jpg',
				mimeType: 'image/jpeg',
				content: Buffer.from('JPEG data here'),
				description: 'Profile image'
			}
		];

		const variables = await fileService.createVariablesFromUploads(
			files,
			'upload',
			'test-process',
			'test-instance',
			'test-activity'
		);

		expect(variables).toHaveLength(2);

		// Check first file variable
		const var1 = variables[0];
		expect(var1.name).toBe('upload_1');
		expect(var1.type).toBe(FieldType.File);
		expect(var1.value).toHaveProperty('metadata');
		expect(var1.value.metadata).toHaveProperty('id');
		expect(var1.value.metadata).toHaveProperty('filename', 'document1.pdf');
		expect(var1.value.metadata).toHaveProperty('mimeType', 'application/pdf');
		expect(var1.value).toHaveProperty('url');

		// Check second file variable
		const var2 = variables[1];
		expect(var2.name).toBe('upload_2');
		expect(var2.type).toBe(FieldType.File);
		expect(var2.value).toHaveProperty('metadata');
		expect(var2.value.metadata).toHaveProperty('filename', 'image1.jpg');
		expect(var2.value.metadata).toHaveProperty('mimeType', 'image/jpeg');
		expect(var2.value).toHaveProperty('url');
	});





	test('should list files with filtering', async () => {
		const testAssociation = {
			processId: 'test-process',
			processInstanceId: 'test-instance',
			activityId: 'test-activity',
			variableName: 'test-file'
		};

		// Upload multiple files
		await fileRepo.store({
			fileAssociation: testAssociation,
			filename: 'doc1.pdf',
			mimeType: 'application/pdf',
			content: Buffer.from('PDF 1'),
			tags: ['document', 'important']
		});

		await fileRepo.store({
			fileAssociation: testAssociation,
			filename: 'image1.jpg',
			mimeType: 'image/jpeg',
			content: Buffer.from('JPEG 1'),
			tags: ['image']
		});

		await fileRepo.store({
			fileAssociation: testAssociation,
			filename: 'doc2.pdf',
			mimeType: 'application/pdf',
			content: Buffer.from('PDF 2'),
			tags: ['document']
		});

		// List all files
		const allFiles = await fileRepo.list();
		expect(allFiles).toHaveLength(3);

		// Filter by MIME type
		const pdfFiles = await fileRepo.list({ mimeTypePattern: 'application/pdf' });
		expect(pdfFiles).toHaveLength(2);

		// Filter by tags
		const importantFiles = await fileRepo.list({ tags: ['important'] });
		expect(importantFiles).toHaveLength(1);
		expect(importantFiles[0].filename).toBe('doc1.pdf');
	});


});