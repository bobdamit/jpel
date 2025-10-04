import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import multer from "multer";
import * as fs from "fs";
import * as path from "path";
import { ProcessEngine } from "./process-engine";
import { RepositoryFactory } from "./repositories/repository-factory";
import {
	ProcessDefinition,
	ApiResponse,
	ProcessExecutionResult,
} from "./types";

const app = express();
const port = process.env.PORT || 3000;

// Initialize repositories and process engine
async function initializeApplication() {
  try {
    // Initialize repositories (in-memory for now)
    await RepositoryFactory.initializeInMemory();
    console.log('✅ Repositories initialized');
    
    // Test repository health
    const health = await RepositoryFactory.healthCheck();
    console.log('📊 Repository health:', health);
    
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
app.use(express.static(path.join(__dirname, '../public')));
app.use('/samples', express.static(path.join(__dirname, '../samples')));

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

		res.json(createResponse(true, result));
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

		res.json(createResponse(true, result));
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

		res.json(createResponse(true, result));
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
			res.json(createResponse(true, { message: "No current activity" }));
			return;
		}

		const currentActivity = instance.activities[instance.currentActivity];

		if (
			currentActivity.status === "running" &&
			currentActivity.type === "human"
		) {
			// This is a waiting human task - we need to reconstruct the task data
			const processDefinition = await processEngine.getProcess(instance.processId);
			const activityDef =
				processDefinition?.activities[instance.currentActivity];

			if (activityDef) {
				const humanTaskData = {
					activityId: currentActivity.id,
					prompt: (activityDef as any).prompt,
					fields: (activityDef as any).inputs || [],
					fileUploads: (activityDef as any).fileUploads,
					attachments: (activityDef as any).attachments,
				};

				res.json(createResponse(true, { humanTask: humanTaskData }));
				return;
			}
		}

		res.json(
			createResponse(true, {
				currentActivity: currentActivity.id,
				status: currentActivity.status,
				type: currentActivity.type,
			})
		);
	}
);

// Error handling middleware
app.use((error: any, req: Request, res: Response, next: NextFunction) => {
	console.error("Error:", error);
	res.status(500).json(createResponse(false, null, "Internal server error"));
});

// 404 handler
app.use("*", (req: Request, res: Response) => {
	res.status(404).json(createResponse(false, null, "Endpoint not found"));
});

// Start server
async function startServer() {
	await initializeApplication();
	
	// Initialize process engine with repositories
	processEngine = new ProcessEngine();
	console.log('✅ Process engine initialized');
	
	app.listen(port, () => {
		console.log(`🚀 JPEL Runner API server started on port ${port}`);
		console.log(`📖 Health check: http://localhost:${port}/health`);
		console.log(`📋 API base URL: http://localhost:${port}/api`);
	});
}

startServer().catch(error => {
	console.error('❌ Failed to start server:', error);
	process.exit(1);
});

export default app;
