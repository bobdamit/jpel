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

// Load a process definition from file
app.post(
	"/api/processes/load",
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		const { filePath } = req.body;

		if (!filePath) {
			res
				.status(400)
				.json(createResponse(false, null, "File path is required"));
			return;
		}

		try {
			const fullPath = path.resolve(filePath);
			const processJson = fs.readFileSync(fullPath, "utf8");
			const processDefinition: ProcessDefinition = JSON.parse(processJson);

			await processEngine.loadProcess(processDefinition);

			res.json(
				createResponse(true, {
					message: `Process '${processDefinition.id}' loaded successfully`,
					processId: processDefinition.id,
				})
			);
		} catch (error: any) {
			res
				.status(400)
				.json(
					createResponse(
						false,
						null,
						`Failed to load process: ${error.message}`
					)
				);
		}
	})
);

// Load a process definition from JSON body
app.post(
	"/api/processes",
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		try {
			const processDefinition: ProcessDefinition = req.body;

			if (!processDefinition.id || !processDefinition.name) {
				res
					.status(400)
					.json(createResponse(false, null, "Process must have id and name"));
				return;
			}

			await processEngine.loadProcess(processDefinition);

			res.json(
				createResponse(true, {
					message: `Process '${processDefinition.id}' loaded successfully`,
					processId: processDefinition.id,
				})
			);
		} catch (error: any) {
			res
				.status(400)
				.json(
					createResponse(
						false,
						null,
						`Failed to load process: ${error.message}`
					)
				);
		}
	})
);

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
		const data = req.body;
		const files = req.files as Express.Multer.File[];

		// Process uploaded files
		const processedFiles = files?.map((file) => ({
			originalName: file.originalname,
			filename: file.filename,
			path: file.path,
			size: file.size,
			mimetype: file.mimetype,
		}));

		const result: ProcessExecutionResult = await processEngine.submitHumanTask(
			instanceId,
			activityId,
			data,
			processedFiles
		);

		// Include the current instance state for UI rendering
		const instance = await processEngine.getInstance(instanceId);

		res.json(createResponse(true, { ...result, instance }));
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

		if (!instance.currentActivity) {
			res.json(createResponse(true, { message: "No current activity", instance }));
			return;
		}

		const currentActivity = instance.activities[instance.currentActivity];

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

		const result: ProcessExecutionResult = await processEngine.reRunInstance(instanceId);

		if (result.status === "failed") {
			res.status(400).json(createResponse(false, null, result.message));
			return;
		}

		res.json(createResponse(true, result));
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
