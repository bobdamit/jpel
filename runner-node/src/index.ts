import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import multer from "multer";
import * as fs from "fs";
import * as path from "path";
import { ProcessEngine } from "./process-engine";
import { RepositoryFactory } from "./repositories/repository-factory";
import { logger } from './logger';
import {
	ProcessDefinition
} from "./models/process-types";
import { ApiResponse, ProcessExecutionResult } from "./models/instance-types";

/**
 * Extracts data from typed activity instances for API responses
 */
function getActivityData(activity: any): any {
	if (!activity) return {};
	
	// Return data based on activity type
	if (activity.formData) {
		// HumanActivityInstance
		return activity.formData;
	} else if (activity.responseData) {
		// APIActivityInstance  
		return activity.responseData;
	} else if (activity.computedValues) {
		// ComputeActivityInstance
		return activity.computedValues;
	} else if (activity.sequenceIndex !== undefined) {
		// SequenceActivityInstance
		return { sequenceIndex: activity.sequenceIndex, activities: activity.sequenceActivities };
	} else if (activity.parallelState) {
		// ParallelActivityInstance
		return { parallelState: activity.parallelState, activeActivities: activity.activeActivities, completedActivities: activity.completedActivities };
	} else if (activity.conditionResult !== undefined) {
		// BranchActivityInstance
		return { conditionResult: activity.conditionResult, nextActivity: activity.nextActivity };
	} else if (activity.expressionValue !== undefined) {
		// SwitchActivityInstance
		return { expressionValue: activity.expressionValue, matchedCase: activity.matchedCase, nextActivity: activity.nextActivity };
	}
	
	return {};
}

const app = express();
const port = process.env.PORT || 3000;

// Initialize repositories and process engine
async function initializeApplication() {
	try {
		// Initialize repositories (in-memory for now)
	await RepositoryFactory.initializeInMemory();
	logger.info('Repositories initialized');

	// Test repository health
	const health = await RepositoryFactory.healthCheck();
	logger.info('Repository health:', health);

	} catch (error) {
		console.error('❌ Failed to initialize application:', error);
		process.exit(1);
	}
}

let processEngine: ProcessEngine;

// Middleware
app.use(helmet({
	contentSecurityPolicy: {
		directives: {
			defaultSrc: ["'self'"],
			scriptSrc: ["'self'", "'unsafe-inline'"],
			styleSrc: ["'self'", "'unsafe-inline'"],
			imgSrc: ["'self'", "data:", "https:"],
			connectSrc: ["'self'"],
			fontSrc: ["'self'"],
			objectSrc: ["'none'"],
			mediaSrc: ["'self'"],
			frameSrc: ["'none'"],
		},
	},
}));
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Serve static files (demo interface and samples)
app.use(express.static(path.join(process.cwd(), 'public')));
app.use('/samples', express.static(path.join(process.cwd(), 'samples')));

// File upload configuration
const upload = multer({
	dest: "uploads/",
	limits: {
		fileSize: 10 * 1024 * 1024, // 10MB limit
	},
});

// Error handling middleware
const asyncHandler =
	(fn: Function) => (req: Request, res: Response, next: NextFunction) => {
		Promise.resolve(fn(req, res, next)).catch(next);
	};

// Utility function to create API responses
const createResponse = <T>(
	success: boolean,
	data?: T,
	error?: string
): ApiResponse<T> => ({
	success,
	data,
	error,
	timestamp: new Date().toISOString(),
});

// Routes

// Redirect root to demo interface
app.get("/", (req: Request, res: Response) => {
	res.redirect("/index.html");
});

// Health check
app.get("/health", (req: Request, res: Response) => {
	res.json(createResponse(true, { status: "OK", service: "JPEL Runner" }));
});



// Get all loaded processes
app.get("/api/processes", async (req: Request, res: Response) => {
	const processes = await processEngine.getProcesses();
	res.json(createResponse(true, processes));
});

// Get a specific process definition
app.get("/api/processes/:processId", async (req: Request, res: Response): Promise<void> => {
	const { processId } = req.params;
	const process = await processEngine.getProcess(processId);

	if (!process) {
		res.status(404).json(createResponse(false, null, "Process not found"));
		return;
	}

	res.json(createResponse(true, process));
});

// Create a new process instance
app.post(
	"/api/processes/:processId/instances",
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		const { processId } = req.params;

		const result: ProcessExecutionResult = await processEngine.createInstance(
			processId
		);

		if (result.status === "failed") {
			res.status(400).json(createResponse(false, null, result.message));
			return;
		}

		// Include the current instance state for UI rendering
		const instance = await processEngine.getInstance(result.instanceId);

		res.json(createResponse(true, { ...result, instance }));
	})
);

// Get process instance details
app.get("/api/instances/:instanceId", async (req: Request, res: Response): Promise<void> => {
	const { instanceId } = req.params;
	const instance = await processEngine.getInstance(instanceId);

	if (!instance) {
		res
			.status(404)
			.json(createResponse(false, null, "Process instance not found"));
		return;
	}

	res.json(createResponse(true, instance));
});

// Execute next step in process instance
app.post(
	"/api/instances/:instanceId/step",
	asyncHandler(async (req: Request, res: Response) => {
		const { instanceId } = req.params;

		const result: ProcessExecutionResult = await processEngine.executeNextStep(
			instanceId
		);

		// Include the current instance state for UI rendering
		const instance = await processEngine.getInstance(instanceId);

		res.json(createResponse(true, { ...result, instance }));
	})
);

// Submit human task data
app.post(
	"/api/instances/:instanceId/activities/:activityId/submit",
	upload.array("files"),
	asyncHandler(async (req: Request, res: Response) => {
		const { instanceId, activityId } = req.params;
		const { _fileUploads, ...data } = req.body;
		let files = req.files as Express.Multer.File[];

		// Debug logging
		console.log('Submit request received:', {
			instanceId,
			activityId,
			data: Object.keys(data),
			hasFileUploads: !!_fileUploads,
			fileUploadCount: _fileUploads?.length || 0,
			fileUploads: _fileUploads
		});

		// Handle base64 file uploads from JSON payload
		if (_fileUploads && Array.isArray(_fileUploads)) {
			const base64Files = _fileUploads.map((upload: any) => {
				const buffer = Buffer.from(upload.content, 'base64');
				return {
					fieldname: upload.fieldName || 'file', // Use the fieldName from frontend
					originalname: upload.filename,
					encoding: '7bit',
					mimetype: upload.mimeType,
					buffer: buffer,
					size: buffer.length,
					destination: '',
					filename: upload.filename,
					path: '',
					stream: null as any
				} as Express.Multer.File;
			});
			
			// Combine with any multipart files
			files = [...(files || []), ...base64Files];
			console.log('Processed files:', files.map(f => ({ fieldname: f.fieldname, originalname: f.originalname, size: f.size })));
		}

		const result: ProcessExecutionResult = await processEngine.submitHumanTask(
			instanceId,
			activityId,
			data,
			files
		);

		// Include the current instance state for UI rendering
		const instance = await processEngine.getInstance(instanceId);

		res.json(createResponse(true, { ...result, instance }));
	})
);

// Get file reference (returns FileReference with URL and thumbnail URL)
app.get(
	"/api/files/:fileId",
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		const { fileId } = req.params;
		const fileService = processEngine.getFileService();
		
		try {
			const fileReference = await fileService.getRepository().retrieve(fileId);
			if (!fileReference) {
				res.status(404).json(createResponse(false, null, "File not found"));
				return;
			}
			
			res.json(createResponse(true, fileReference));
		} catch (error) {
			logger.error("Error retrieving file reference:", error);
			res.status(500).json(createResponse(false, null, "Failed to retrieve file reference"));
		}
	})
);

// Download file content (only for non-image files that need download links)
app.get(
	"/api/files/:fileId/download",
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		const { fileId } = req.params;
		const fileRepository = processEngine.getFileService().getRepository() as any;
		
		try {
			const fileData = fileRepository.files?.get(fileId);
			if (!fileData) {
				res.status(404).json(createResponse(false, null, "File not found"));
				return;
			}
			
			// Only serve non-image files for download
			if (fileData.metadata.mimeType.startsWith('image/')) {
				res.status(400).json(createResponse(false, null, "Images should use data URLs"));
				return;
			}
			
			res.setHeader('Content-Type', fileData.metadata.mimeType);
			res.setHeader('Content-Disposition', `attachment; filename="${fileData.metadata.filename}"`);
			res.setHeader('Content-Length', fileData.content.length);
			
			res.send(fileData.content);
		} catch (error) {
			logger.error("Error downloading file:", error);
			res.status(500).json(createResponse(false, null, "Failed to download file"));
		}
	})
);

// Get current human task for an instance
app.get(
	"/api/instances/:instanceId/current-task",
	async (req: Request, res: Response): Promise<void> => {
		const { instanceId } = req.params;
		const instance = await processEngine.getInstance(instanceId);

		if (!instance) {
			res
				.status(404)
				.json(createResponse(false, null, "Process instance not found"));
			return;
		}

		let executionContext = instance.executionContext;

		if (!executionContext.currentActivity) {
			res.json(createResponse(true, { message: "No current activity", instance }));
			return;
		}

		const currentActivity = instance.activities[executionContext.currentActivity];

		if (
			currentActivity.status === "running" &&
			currentActivity.type === "human"
		) {
			// This is a waiting human task - convert variables to FieldValue[] for UI
			const variables = (currentActivity as any).variables || [];
			
			// Convert Variable[] to FieldValue[] format expected by UI
			const fieldsWithValues = variables.map((variable: any) => ({
				...variable,
				value: variable.value !== undefined ? variable.value : 
					   variable.defaultValue !== undefined ? variable.defaultValue : undefined
			}));

			const activityData = getActivityData(currentActivity);
			const humanTaskData = {
				activityId: currentActivity.id,
				prompt: (currentActivity as any).prompt,
				fields: fieldsWithValues, // These are now FieldValue[] objects
				fileUploads: (currentActivity as any).fileUploads,
				attachments: (currentActivity as any).attachments,
				context: activityData && Object.keys(activityData).length > 0 ? { previousRunData: activityData } : undefined
			};

			res.json(createResponse(true, { humanTask: humanTaskData, instance }));
			return;
		}

		res.json(
			createResponse(true, {
				currentActivity: currentActivity.id,
				status: currentActivity.status,
				type: currentActivity.type,
				instance
			})
		);
	}
);

// Get process instances for a specific process
app.get("/api/processes/:processId/instances", async (req: Request, res: Response): Promise<void> => {
	const { processId } = req.params;
	const instances = await processEngine.getInstancesByProcessId(processId);

	res.json(createResponse(true, instances));
});

// Re-run a process instance
app.post(
	"/api/instances/:instanceId/rerun",
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		const { instanceId } = req.params;

		const result: ProcessExecutionResult = await processEngine.resumeInstance(instanceId);

		if (result.status === "failed") {
			res.status(400).json(createResponse(false, null, result.message));
			return;
		}

		res.json(createResponse(true, result));
	})
);

// Navigate to start activity
app.post(
	"/api/instances/:instanceId/navigate/start",
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		const { instanceId } = req.params;

		const result: ProcessExecutionResult = await processEngine.restartInstance(instanceId);

		if (result.status === "failed") {
			res.status(400).json(createResponse(false, null, result.message));
			return;
		}

		res.json(createResponse(true, result));
	})
);

// File Management API Endpoints

// Get file by ID
app.get(
	"/api/files/:fileId",
	asyncHandler(async (req: Request, res: Response) => {
		const { fileId } = req.params;
		const fileRepo = processEngine.getFileService().getRepository();
		
		const fileReference = await fileRepo.retrieve(fileId);
		if (!fileReference) {
			res.status(404).json(createResponse(false, null, "File not found"));
			return;
		}

		res.json(createResponse(true, fileReference));
	})
);

// Download file content by ID
app.get(
	"/api/files/:fileId/download",
	asyncHandler(async (req: Request, res: Response) => {
		const { fileId } = req.params;
		const fileRepo = processEngine.getFileService().getRepository() as any; // Cast to access getContent
		
		// Get file metadata first
		const fileMetadata = await fileRepo.getMetadata(fileId);
		if (!fileMetadata) {
			res.status(404).json(createResponse(false, null, "File not found"));
			return;
		}

		// Get file content
		const fileContent = await fileRepo.getContent(fileId);
		if (!fileContent) {
			res.status(404).json(createResponse(false, null, "File content not found"));
			return;
		}

		// Set appropriate headers for file download
		res.setHeader('Content-Type', fileMetadata.mimeType);
		res.setHeader('Content-Disposition', `attachment; filename="${fileMetadata.filename}"`);
		res.setHeader('Content-Length', fileMetadata.size.toString());
		
		res.send(fileContent);
	})
);

// Get file metadata by ID
app.get(
	"/api/files/:fileId/metadata",
	asyncHandler(async (req: Request, res: Response) => {
		const { fileId } = req.params;
		const fileRepo = processEngine.getFileService().getRepository();
		
		const metadata = await fileRepo.getMetadata(fileId);
		if (!metadata) {
			res.status(404).json(createResponse(false, null, "File not found"));
			return;
		}

		res.json(createResponse(true, metadata));
	})
);

// List files with optional filtering
app.get(
	"/api/files",
	asyncHandler(async (req: Request, res: Response) => {
		const fileRepo = processEngine.getFileService().getRepository();
		
		const options = {
			tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
			mimeTypePattern: req.query.mimeType as string,
			createdBy: req.query.createdBy as string,
			limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
			offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
			sortBy: req.query.sortBy as 'filename' | 'createdAt' | 'size',
			sortOrder: req.query.sortOrder as 'asc' | 'desc'
		};

		const files = await fileRepo.list(options);

		res.json(createResponse(true, { files }));
	})
);

// Get file variables for a specific activity
app.get(
	"/api/instances/:instanceId/activities/:activityId/files",
	asyncHandler(async (req: Request, res: Response) => {
		const { instanceId, activityId } = req.params;
		
		const instance = await processEngine.getInstance(instanceId);
		if (!instance) {
			res.status(404).json(createResponse(false, null, "Instance not found"));
			return;
		}

		const activity = instance.activities[activityId];
		if (!activity) {
			res.status(404).json(createResponse(false, null, "Activity not found"));
			return;
		}

		const fileVariables = activity.variables?.filter(v => v.type === 'file') || [];
		
		res.json(createResponse(true, {
			activityId,
			fileVariables,
			fileCount: fileVariables.length
		}));
	})
);

// Download file from activity variable
app.get(
	"/api/instances/:instanceId/activities/:activityId/files/:variableName",
	asyncHandler(async (req: Request, res: Response) => {
		const { instanceId, activityId, variableName } = req.params;
		
		const fileReference = await processEngine.getFileFromActivityVariable(instanceId, activityId, variableName);
		if (!fileReference) {
			res.status(404).json(createResponse(false, null, "File variable not found"));
			return;
		}

		// Redirect to the file's download URL
		res.redirect(fileReference.url);
	})
);



// Error handling middleware
app.use((error: any, req: Request, res: Response, next: NextFunction) => {
	console.error("Error:", error);
	res.status(500).json(createResponse(false, null, "Internal server error"));
});

// 404 handler - must be last
app.use((req: Request, res: Response) => {
	res.status(404).json(createResponse(false, null, "Endpoint not found"));
});

// Start server
async function startServer() {
	await initializeApplication();

	// Initialize process engine with repositories
	processEngine = new ProcessEngine();
	logger.info('Process engine initialized');

	app.listen(port, () => {
		logger.info(`JPEL Runner API server started on port ${port}`);
		logger.info(`Health check: http://localhost:${port}/health`);
		logger.info(`API base URL: http://localhost:${port}/api`);
	});
}

startServer().catch(error => {
	console.error('❌ Failed to start server:', error);
	process.exit(1);
});

export default app;
