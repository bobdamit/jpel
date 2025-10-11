import { v4 as uuidv4 } from 'uuid';
import {
	ProcessDefinition,
	ProcessTemplateFlyweight,
	ProcessStatus,
	Activity,
	ActivityStatus,
	ActivityType,
	HumanActivity,
	ComputeActivity,
	APIActivity,
	SequenceActivity,
	BranchActivity,
	SwitchActivity,
	TerminateActivity,
	FieldType,
	Variable,
	PassFail
} from './models/process-types';
import { ExpressionEvaluator } from './expression-evaluator';
import { APIExecutor } from './api-executor';
import { FieldValidator } from './field-validator';
import { RepositoryFactory } from './repositories/repository-factory';
import { ProcessDefinitionRepository } from './repositories/process-definition-repository';
import { ProcessInstanceRepository } from './repositories/process-instance-repository';
import { logger } from './logger';
import ProcessLoader from './process-loader';
import { ActivityInstance, APIActivityInstance, BranchActivityInstance, ProcessExecutionResult,
	FieldValue, ComputeActivityInstance, HumanActivityInstance, HumanTaskData, 
	ProcessInstance, ProcessInstanceFlyweight, SequenceActivityInstance, 
	SwitchActivityInstance, AggregatePassFail} from './models/instance-types';
import { ExecutionContext, ExecutionFrame } from './execution-context';
import { extractActivityId } from './utils/activity-ref';
import { updateActivityVariables } from './utils/variable-updater';
import { FileService } from './services/file-service';




/**
* Process Engine for loading, executing, and managing process definitions and instances
*/
export class ProcessEngine {
	private processDefinitionRepo: ProcessDefinitionRepository;
	private processInstanceRepo: ProcessInstanceRepository;
	private expressionEvaluator: ExpressionEvaluator;
	private apiExecutor: APIExecutor;
	private fileService: FileService;
	private continuationStrategies: Map<ActivityType, ActivityContinuationStrategy>;

	constructor() {

		this.processDefinitionRepo = RepositoryFactory.getProcessDefinitionRepository();
		this.processInstanceRepo = RepositoryFactory.getProcessInstanceRepository();
		this.expressionEvaluator = new ExpressionEvaluator();
		this.apiExecutor = new APIExecutor();
		this.fileService = new FileService();
		
		// Initialize continuation strategies
		this.continuationStrategies = new Map();
		this.continuationStrategies.set(ActivityType.Sequence, new SequenceContinuationStrategy());
		this.continuationStrategies.set(ActivityType.Switch, new SwitchContinuationStrategy());
		this.continuationStrategies.set(ActivityType.Branch, new BranchContinuationStrategy());
		
		// Default strategy for all other types
		const defaultStrategy = new DefaultContinuationStrategy();
		this.continuationStrategies.set(ActivityType.Human, defaultStrategy);
		this.continuationStrategies.set(ActivityType.Compute, defaultStrategy);
		this.continuationStrategies.set(ActivityType.API, defaultStrategy);
		this.continuationStrategies.set(ActivityType.Terminate, defaultStrategy);
		this.continuationStrategies.set(ActivityType.Parallel, defaultStrategy);
		
		logger.info('ProcessEngine: ctor complete');
	}



	/**
	 * Get all available process templates (flyweights)
	 * @returns 
	 */
	async getProcesses(): Promise<ProcessTemplateFlyweight[]> {
		return await this.processDefinitionRepo.listAvailableTemplates();
	}

	/**
	 * Get a specific process definition
	 * @param processId 
	 * @returns 
	 */
	async getProcess(processId: string): Promise<ProcessDefinition | null> {
		return await this.processDefinitionRepo.findById(processId);
	}

	/**
	 * Get a process instance by ID
	 * @param instanceId 
	 * @returns 
	 */
	async getInstance(instanceId: string): Promise<ProcessInstance | null> {
		return await this.processInstanceRepo.findById(instanceId);
	}


	/**
	 * Create a new process instance from a Process Definition
	 * This effectively makes a runtime snapshot of the process
	 * @param processId 
	 * @returns 
	 */
	async createInstance(processId: string): Promise<ProcessExecutionResult> {

		const processDefinition = await this.processDefinitionRepo.findById(processId);
		if (!processDefinition) {
			logger.error(`ProcessEngine: Process definition '${processId}' not found`);
			return {
				instanceId: '',
				status: ProcessStatus.Failed,
				message: `Process definition '${processId}' not found`
			};
		}

		logger.debug(`ProcessEngine: Found process definition`, {
			id: processDefinition.id,
			name: processDefinition.name,
			start: processDefinition.start
		});

		// Normalize any process data coming from repositories
		ProcessLoader.normalize(processDefinition);

		if (!processDefinition.start) {
			logger.error(`ProcessEngine: Process definition '${processId}' has no start activity defined`);
			return {
				instanceId: '',
				status: ProcessStatus.Failed,
				message: `Process definition '${processId}' has no start activity defined`
			};
		}

		const instanceId = uuidv4();

		let startActivityId: string;
		try {
			startActivityId = extractActivityId(processDefinition.start);
			logger.info(`ProcessEngine: Extracted start activity ID '${startActivityId}' from '${processDefinition.start}'`);
		} catch (error) {
			logger.error(`ProcessEngine: Failed to extract start activity ID from '${processDefinition.start}'`, error);
			return {
				instanceId: '',
				status: ProcessStatus.Failed,
				message: `Invalid start activity reference: ${processDefinition.start}`
			};
		}

		// initialize an execution context with the start activity
		let executionContext =  this.initExecutionContextAtStart(processDefinition);

		// materialize a new run instance from the process def
		const instance: ProcessInstance = {
			instanceId,
			processId,
			executionContext,
			status: ProcessStatus.Running,
			startedAt: new Date(),
			variables: this.initializeVariables(processDefinition.variables || []),
			activities: this.initializeActivities(processDefinition.activities)
		};

		logger.info(`ProcessEngine: Created instance object`, {
			instanceId,
			processId,
			executionContext
		});

		await this.processInstanceRepo.save(instance);

		return await this.executeNextStep(instanceId);
	}


	/**
	 * Create a new execution context starting at the Start activity
	 * @param startActivityId 
	 * @returns 
	 */
	private initExecutionContextAtStart(processDefinition: ProcessDefinition) : ExecutionContext {
		let executionContext = new ExecutionContext();

		// determine the start activity ID
		const startActivityId = extractActivityId(processDefinition.start);
		if (!startActivityId) {
			throw new Error(`Invalid start activity reference: ${processDefinition.start}`);
		}

		// Push the start activity as the root frame (no parent)
		executionContext.pushFrame(startActivityId);
		return executionContext;
	}




	/**
	 * Execute the next step in a process instance
	 * @param instanceId 
	 * @returns ProcessExecutionResult
	 */
	async executeNextStep(instanceId: string): Promise<ProcessExecutionResult> {
		logger.info(`ProcessEngine: Executing next step for instance '${instanceId}'`);

		const instance = await this.processInstanceRepo.findById(instanceId);

		const executionContext = instance.executionContext;

		logger.info(`ProcessEngine: Found instance`, {
			instanceId,
			status: instance.status,
			executionContext
		});

		if (instance.status !== ProcessStatus.Running) {
			logger.warn(`ProcessEngine: Instance '${instanceId}' is not running (status: ${instance.status})`);
			return {
				instanceId,
				status: instance.status,
				message: `Process is ${instance.status}`
			};
		}

		if (!executionContext.currentActivity) {
			logger.warn(`ProcessEngine: Instance '${instanceId}' has no current activity, completing process`);
			return await this.completeProcess(instanceId, 'No current activity');
		}

		const processDefinition = await this.processDefinitionRepo.findById(instance.processId);
		if (!processDefinition) {
			logger.error(`ProcessEngine: Process definition '${instance.processId}' not found for instance '${instanceId}'`);
			return {
				instanceId,
				status: ProcessStatus.Failed,
				message: 'Process definition not found'
			};
		}

		const activity = processDefinition.activities[executionContext.currentActivity];
		if (!activity) {
			logger.error(`ProcessEngine: Activity '${executionContext.currentActivity}' not found in process '${instance.processId}'`);
			return {
				instanceId,
				status: ProcessStatus.Failed,
				message: `Activity '${executionContext.currentActivity}' not found`
			};
		}

		logger.info(`ProcessEngine: Executing activity '${executionContext.currentActivity}' of type '${activity.type}'`);
		try {
			return await this.executeActivity(instanceId, activity);
		} catch (error) {
			logger.error(`ProcessEngine: Error executing activity '${executionContext.currentActivity}' for instance '${instanceId}'`, error);
			return {
				instanceId,
				status: ProcessStatus.Failed,
				message: `Error executing activity: ${error instanceof Error ? error.message : String(error)}`
			};
		}
	}


	/**
	 * Handle Submission of a human task
	 * @param instanceId The Instance ID
	 * @param activityId The activity ID
	 * @param data The submitted data
	 * @param files The submitted files
	 * @returns 
	 */
	// Submit data for a human task
	async submitHumanTask(instanceId: string, activityId: string, data: any, files?: any[]): Promise<ProcessExecutionResult> {
		logger.info(`ProcessEngine: Submitting human task for instance '${instanceId}', activity '${activityId}'`, {
			dataKeys: Object.keys(data || {}),
			hasFiles: !!(files && files.length > 0)
		});

		const instance = await this.processInstanceRepo.findById(instanceId);

		const activityInstance = instance.activities[activityId] as HumanActivityInstance;
		if (!activityInstance || activityInstance.status !== ActivityStatus.Running) {
			logger.error(`ProcessEngine: Activity '${activityId}' not found or not waiting for input`, {
				activityExists: !!activityInstance,
				activityStatus: activityInstance?.status,
				expectedStatus: ActivityStatus.Running
			});
			return {
				instanceId,
				status: ProcessStatus.Failed,
				message: 'Activity not found or not waiting for input'
			};
		}

		// Store the submitted data in the activity's variables array
		if (!activityInstance.variables) {
			activityInstance.variables = [];
		}

		// Get the process definition to access field definitions for validation
		const processDefinition = await this.processDefinitionRepo.findById(instance.processId);
		if (processDefinition) {
			const activityDef = processDefinition.activities[activityId];
			if (activityDef && activityDef.type === ActivityType.Human) {
				const humanActivity = activityDef as HumanActivity;
				if (humanActivity.inputs) {
					// Validate the submitted data against field definitions
					const validationResult = FieldValidator.validateFields(humanActivity.inputs, data);
					if (!validationResult.isValid) {
						logger.warn(`ProcessEngine: Field validation failed for activity '${activityId}'`, {
							errors: validationResult.errors
						});
						return {
							instanceId,
							status: ProcessStatus.Failed,
							message: `Field validation failed: ${validationResult.errors.join('; ')}`
						};
					}
					logger.debug(`ProcessEngine: Field validation passed for activity '${activityId}'`);
				}
			}
		}

		// Update variables array with submitted data (moved to util)
		updateActivityVariables(activityInstance, data);

		// Handle uploaded files by mapping them to specific field names
		if (files && files.length > 0) {
			logger.info(`ProcessEngine: Processing ${files.length} uploaded files for activity '${activityId}'`);
			
			try {
				// Get the activity definition to check which fields are file types
				const processDef = await this.processDefinitionRepo.findById(instance.processId);
				const activityDef = processDef?.activities[activityId];
				
				if (activityDef && activityDef.type === 'human') {
					const humanActivityDef = activityDef as any; // HumanActivity type
					const fileFields = humanActivityDef.inputs?.filter((field: any) => field.type === 'file') || [];
					
					// Map files to their corresponding field names
					for (let i = 0; i < files.length && i < fileFields.length; i++) {
						const file = files[i];
						const fieldName = fileFields[i].name;
						
						logger.info(`ProcessEngine: Mapping file to field '${fieldName}'`, {
							filename: file.originalname,
							fieldName
						});
						
						// Create file upload request
						const uploadRequest = {
							filename: file.originalname || file.filename || 'unknown',
							mimeType: file.mimetype || 'application/octet-stream',
							content: file.buffer || Buffer.alloc(0),
							description: `File uploaded for field ${fieldName}`
						};
						
						// Create file variable with the specific field name
						const fileVariable = await this.fileService.uploadAndCreateVariable(
							uploadRequest,
							fieldName,
							instanceId,
							activityId,
							instance.processId
						);
						
						// Add or update the variable in the activity's variables array
						const existingVarIndex = activityInstance.variables.findIndex(v => v.name === fieldName);
						if (existingVarIndex >= 0) {
							activityInstance.variables[existingVarIndex] = fileVariable;
						} else {
							activityInstance.variables.push(fileVariable);
						}
					}
					
					logger.info(`ProcessEngine: Created ${Math.min(files.length, fileFields.length)} file variables for activity '${activityId}'`);
				}
			} catch (error) {
				logger.error(`ProcessEngine: Failed to process uploaded files for activity '${activityId}'`, error);
				return {
					instanceId,
					status: ProcessStatus.Failed,
					message: `File processing failed: ${error instanceof Error ? error.message : String(error)}`
				};
			}
		}

		// Complete the human task
		activityInstance.status = ActivityStatus.Completed;
		activityInstance.completedAt = new Date();

		// Save the updated instance
		await this.processInstanceRepo.save(instance);

		logger.info(`ProcessEngine: Human Activity '${activityId}' completed, continuing execution for instance '${instanceId}'`);

		// Check for process completion and continue execution through call stack
		return await this.checkForProcessCompletion(instanceId, activityId);
	}

	/**
	 * Execute an Activity
	 * instanceId - the ID of the running instance
	 * activity - the Activity
	 */
	private async executeActivity(instanceId: string, activity: Activity): Promise<ProcessExecutionResult> {
		logger.info(`ProcessEngine: Executing activity '${activity.id}' of type '${activity.type}' for instance '${instanceId}'`);

		// do some sanity checks on the activity and instance
		if (!activity.id) {
			logger.error(`ProcessEngine: Activity missing ID during execution`, activity);
			return {
				instanceId,
				status: ProcessStatus.Failed,
				message: 'Activity missing ID'
			};
		}

		const instance = await this.processInstanceRepo.findById(instanceId);

		const activityInstance = instance.activities[activity.id];
		if (!activityInstance) {
			logger.error(`ProcessEngine: Activity instance '${activity.id}' not found in instance '${instanceId}'`);
			return {
				instanceId,
				status: ProcessStatus.Failed,
				message: `Activity instance '${activity.id}' not found`
			};
		}

		// Check if activity is already completed - if so, continue to completion check
		// EXCEPT for container activities (sequences) which may need to re-execute
		// to build proper call stack structure during navigation
		if (activityInstance.status === ActivityStatus.Completed) {
			const isContainerActivity = activity.type === ActivityType.Sequence ;
			
			if (!isContainerActivity) {
				logger.info(`ProcessEngine: Activity '${activity.id}' already completed, skipping execution`);
				return await this.checkForProcessCompletion(instanceId, activity.id);
			} else {
				logger.info(`ProcessEngine: Container activity '${activity.id}' was completed but allowing re-execution for call stack management`);
				// Allow container activities to re-execute to build proper call stack
			}
		}

		// Mark activity as running
		activityInstance.status = ActivityStatus.Running;
		activityInstance.startedAt = new Date();
		logger.debug(`ProcessEngine: Marked activity '${activity.id}' as running`);

		try {
			let result: ProcessExecutionResult;

			switch (activity.type) {
				case ActivityType.Human:
					logger.info(`ProcessEngine: Executing human activity '${activity.id}'`);
					result = await this.executeHumanActivity(instanceId, activity as HumanActivity);
					break; case ActivityType.Compute:
					logger.info(`ProcessEngine: Executing compute activity '${activity.id}'`);
					result = await this.executeComputeActivity(instanceId, activity as ComputeActivity);
					break;

				case ActivityType.API:
					logger.info(`ProcessEngine: Executing API activity '${activity.id}'`);
					result = await this.executeAPIActivity(instanceId, activity as APIActivity);
					break;

				case ActivityType.Sequence:
					logger.info(`ProcessEngine: Executing sequence activity '${activity.id}'`);
					result = await this.executeSequenceActivity(instanceId, activity as SequenceActivity);
					break;

				case ActivityType.Branch:
					logger.info(`ProcessEngine: Executing branch activity '${activity.id}'`);
					result = await this.executeBranchActivity(instanceId, activity as BranchActivity);
					break;

				case ActivityType.Switch:
					logger.info(`ProcessEngine: Executing switch activity '${activity.id}'`);
					result = await this.executeSwitchActivity(instanceId, activity as SwitchActivity);
					break;

				case ActivityType.Terminate:
					logger.info(`ProcessEngine: Executing terminate activity '${activity.id}'`);
					result = await this.executeTerminateActivity(instanceId, activity as TerminateActivity);
					break;

				default:
					logger.error(`ProcessEngine: Unknown activity type '${activity.type}' for activity '${activity.id}'`);
					throw new Error(`Unknown activity type: ${activity.type}`);
			}

			// Save the updated instance after activity execution
			const updatedInstance = await this.processInstanceRepo.findById(instanceId);
			await this.processInstanceRepo.save(updatedInstance);
			logger.debug(`ProcessEngine: Saved updated instance '${instanceId}' after activity execution`);
			return result;
		} catch (error) {
			logger.error(`ProcessEngine: Activity '${activity.id}' execution failed`, error);

			activityInstance.status = ActivityStatus.Failed;
			activityInstance.error = error instanceof Error ? error.message : String(error);

			// Save the failed state
			await this.processInstanceRepo.save(instance);

			return {
				instanceId,
				status: ProcessStatus.Failed,
				message: `Activity '${activity.id}' failed: ${activityInstance.error}`
			};
		}
	}

	private async executeHumanActivity(instanceId: string, activity: HumanActivity): Promise<ProcessExecutionResult> {
		// Human activities wait for external input
		const instance = await this.processInstanceRepo.findById(instanceId);

		if (!activity.id) {
			logger.error('ProcessEngine: Human activity missing ID');
			return {
				instanceId,
				status: ProcessStatus.Failed,
				message: 'Activity missing ID'
			};
		}

		const activityInstance = instance.activities[activity.id!] as HumanActivityInstance;
		activityInstance.status = ActivityStatus.Running;
		activityInstance.startedAt = new Date();

		// Ensure variables array exists
		if (!activityInstance.variables) {
			activityInstance.variables = [];
		}

		// If variables array is empty, initialize from inputs in activity definition
		if (activity.inputs && Array.isArray(activity.inputs) && activityInstance.variables.length === 0) {
			activityInstance.variables = activity.inputs.map(field => ({
				name: field.name,
				label: field.label,
				hint: field.hint,
				type: field.type,
				value: field.defaultValue, // Use defaultValue for initial value
				defaultValue: field.defaultValue,
				description: field.description,
				required: field.required,
				options: field.options,
				min: field.min,
				max: field.max,
				units: field.units,
				pattern: field.pattern,
				patternDescription: field.patternDescription,
				fileSpec: field.fileSpec
			}));
			
			// Remove inputs from runtime instance to prevent redundant state
			delete (activityInstance as any).inputs;
		}

		await this.processInstanceRepo.save(instance);

		logger.debug(`ProcessEngine: Executing human activity '${activity.id}'`, {
			variablesCount: activityInstance.variables.length,
			hasValues: activityInstance.variables.some(v => v.value !== undefined && v.value !== null && v.value !== '')
		});

		// Convert variables to FieldValue[] for UI binding
		const fieldsForUI: FieldValue[] = activityInstance.variables.map(variable => ({
			name: variable.name,
			type: variable.type,
			value: variable.value,
			defaultValue: variable.defaultValue,
			description: variable.description,
			required: variable.required,
			options: variable.options,
			min: variable.min,
			max: variable.max,
			units: variable.units,
			pattern: variable.pattern,
			patternDescription: variable.patternDescription,
			fileSpec: (variable as any).fileSpec
		}));

		const humanTaskData: HumanTaskData = {
			activityId: activity.id,
			prompt: activity.prompt,
			fields: fieldsForUI
		};

		return {
			instanceId,
			status: ProcessStatus.Running,
			currentActivity: activity.id,
			humanTask: humanTaskData,
			message: 'Waiting for human input'
		};
	}

	private async executeComputeActivity(instanceId: string, activity: ComputeActivity): Promise<ProcessExecutionResult> {
		const instance = await this.processInstanceRepo.findById(instanceId);

		if (!activity.id) {
			logger.error('ProcessEngine: Compute activity missing ID');
			return {
				instanceId,
				status: ProcessStatus.Failed,
				message: 'Activity missing ID'
			};
		}

		const activityInstance = instance.activities[activity.id] as ComputeActivityInstance;

		try {
			// Execute JavaScript code
			const result = this.expressionEvaluator.executeCode(activity.code, instance, activity.id);

			// Store results in the activity's variables array
			if (result) {
				if (!activityInstance.variables) {
					activityInstance.variables = [];
				}

				// Convert result object to variables
				Object.keys(result).forEach(key => {
					let variable = activityInstance.variables!.find(v => v.name === key);
					if (variable) {
						variable.value = result[key];
					} else {
						// Create new variable
						variable = {
							name: key,
							type: typeof result[key] === 'boolean' ? FieldType.Boolean : 
								  typeof result[key] === 'number' ? FieldType.Number : FieldType.Text,
							value: result[key]
						};
						activityInstance.variables!.push(variable);
					}
				});
			}

			// Complete the activity
			activityInstance.status = ActivityStatus.Completed;
			activityInstance.completedAt = new Date();

			await this.processInstanceRepo.save(instance);

			// Check for process completion and continue execution through call stack
			return await this.checkForProcessCompletion(instanceId, activity.id!);
		} catch (error) {
			activityInstance.status = ActivityStatus.Failed;
			activityInstance.error = error instanceof Error ? error.message : String(error);

			await this.processInstanceRepo.save(instance);
			return {
				instanceId,
				status: ProcessStatus.Failed,
				message: `Compute activity failed: ${activityInstance.error}`
			};
		}
	}

	private async executeAPIActivity(instanceId: string, activity: APIActivity): Promise<ProcessExecutionResult> {
		const instance = await this.processInstanceRepo.findById(instanceId);

		if (!activity.id) {
			logger.error('ProcessEngine: API activity missing ID');
			return {
				instanceId,
				status: ProcessStatus.Failed,
				message: 'Activity missing ID'
			};
		}

		const activityInstance = instance.activities[activity.id] as APIActivityInstance;

		try {
			const response = await this.apiExecutor.execute(activity, instance);

			activityInstance.responseData = response;
			activityInstance.status = ActivityStatus.Completed;
			activityInstance.completedAt = new Date();

			await this.processInstanceRepo.save(instance);

			// Check for process completion and continue execution through call stack
			return await this.checkForProcessCompletion(instanceId, activity.id!);
		} catch (error) {
			activityInstance.status = ActivityStatus.Failed;
			activityInstance.error = error instanceof Error ? error.message : String(error);

			await this.processInstanceRepo.save(instance);
			return {
				instanceId,
				status: ProcessStatus.Failed,
				message: `API activity failed: ${activityInstance.error}`
			};
		}
	}

	private async executeSequenceActivity(instanceId: string, activity: SequenceActivity): Promise<ProcessExecutionResult> {
		logger.info(`ProcessEngine: Executing sequence activity '${activity.id}'`);
		
		// Mark sequence as running
		const instance = await this.processInstanceRepo.findById(instanceId);

		if (!activity.id) {
			return { instanceId, status: ProcessStatus.Failed, message: 'Activity missing ID' };
		}

		const activityInstance = instance.activities[activity.id] as SequenceActivityInstance;
		activityInstance.status = ActivityStatus.Running;
		activityInstance.startedAt = new Date();

		// Execute the first activity in the sequence if any
		if (activity.activities.length > 0) {
			const firstActivityRef = activity.activities[0];
			const firstActivityId = extractActivityId(firstActivityRef);
			
			logger.info(`ProcessEngine: Starting sequence '${activity.id}' with first activity '${firstActivityId}'`);
			return await this.executeActivityInFrame(instanceId, firstActivityId, activity.id, 0);
		} else {
			// Empty sequence completes immediately
			logger.info(`ProcessEngine: Empty sequence '${activity.id}' completed immediately`);
			activityInstance.status = ActivityStatus.Completed;
			activityInstance.completedAt = new Date();
			await this.processInstanceRepo.save(instance);
			return await this.checkForProcessCompletion(instanceId, activity.id);
		}
	}

	private async executeBranchActivity(instanceId: string, activity: BranchActivity): Promise<ProcessExecutionResult> {
		const instance = await this.processInstanceRepo.findById(instanceId);

		if (!activity.id) {
			logger.error('ProcessEngine: Branch activity missing ID');
			return {
				instanceId,
				status: ProcessStatus.Failed,
				message: 'Activity missing ID'
			};
		}

		let executionContext = instance.executionContext;

		const activityInstance = instance.activities[activity.id] as BranchActivityInstance;

		try {
			const conditionResult = this.expressionEvaluator.evaluateCondition(activity.condition, instance);

			const nextActivity = conditionResult ? activity.then : activity.else;
			if (nextActivity) {
				const nextActivityId = extractActivityId(nextActivity);
				logger.info(`ProcessEngine: Branch condition met, Pushing Frame: '${nextActivityId}'`);
				executionContext.pushFrame(nextActivityId);

				activityInstance.status = ActivityStatus.Completed;
				activityInstance.completedAt = new Date();
				activityInstance.conditionResult = conditionResult;
				activityInstance.nextActivity = nextActivity;

				await this.processInstanceRepo.save(instance);
				return await this.executeNextStep(instanceId);
			} else {
				// No else branch, complete activity and continue through call stack
				activityInstance.status = ActivityStatus.Completed;
				activityInstance.completedAt = new Date();

				await this.processInstanceRepo.save(instance);
				return await this.checkForProcessCompletion(instanceId, activity.id!);
			}
		} catch (error) {
			activityInstance.status = ActivityStatus.Failed;
			activityInstance.error = error instanceof Error ? error.message : String(error);

			await this.processInstanceRepo.save(instance);
			return {
				instanceId,
				status: ProcessStatus.Failed,
				message: `Branch condition evaluation failed: ${activityInstance.error}`
			};
		}
	}

	private async executeSwitchActivity(instanceId: string, activity: SwitchActivity): Promise<ProcessExecutionResult> {
		const instance = await this.processInstanceRepo.findById(instanceId);

		if (!activity.id) {
			logger.error('ProcessEngine: Switch activity missing ID');
			return {
				instanceId,
				status: ProcessStatus.Failed,
				message: 'Activity missing ID'
			};
		}

		let executionContext = instance.executionContext;

		const activityInstance = instance.activities[activity.id] as SwitchActivityInstance;
		logger.info(`ProcessEngine: Executing switch activity '${activity.id}'`);

		try {
			// Evaluate the switch expression
			const expressionResult = this.expressionEvaluator.executeCode([`return ${activity.expression};`], instance, activity.id);
			const switchValue = typeof expressionResult === 'object' && expressionResult !== null
				? JSON.stringify(expressionResult)
				: String(expressionResult);

			logger.debug(`ProcessEngine: Switch expression '${activity.expression}' evaluated to: '${switchValue}'`);

			// Find matching case
			let nextActivity: string | undefined;

			if (activity.cases[switchValue]) {
				nextActivity = activity.cases[switchValue];
				logger.debug(`ProcessEngine: Switch matched case '${switchValue}' -> '${nextActivity}'`);
			} else if (activity.default) {
				nextActivity = activity.default;
				logger.debug(`ProcessEngine: Switch using default case -> '${nextActivity}'`);
			} else {
				throw new Error(`No matching case found for value '${switchValue}' in Activity ${activity.id} `);
			}

			// Update switch activity instance with the selection
			activityInstance.status = ActivityStatus.Running; // Keep running until selected branch completes
			activityInstance.expressionValue = switchValue;
			activityInstance.matchedCase = activity.cases[switchValue] ? switchValue : 'default';
			activityInstance.nextActivity = nextActivity;

			await this.processInstanceRepo.save(instance);

			// Execute the selected branch using proper call stack frame management
			const selectedActivityId = extractActivityId(nextActivity);
			return await this.executeActivityInFrame(instanceId, selectedActivityId, activity.id, undefined);
		} catch (error) {
			activityInstance.status = ActivityStatus.Failed;
			activityInstance.error = error instanceof Error ? error.message : String(error);

			logger.error(`Switch Eval Failed: ${activityInstance.error} `);

			await this.processInstanceRepo.save(instance);
			return {
				instanceId,
				status: ProcessStatus.Failed,
				message: `Switch evaluation failed: ${activityInstance.error}`
			};
		}
	}

	private async executeTerminateActivity(instanceId: string, activity: TerminateActivity): Promise<ProcessExecutionResult> {
		const instance = await this.processInstanceRepo.findById(instanceId);

		if (!activity.id) {
			logger.error('ProcessEngine: Terminate activity missing ID');
			return {
				instanceId,
				status: ProcessStatus.Failed,
				message: 'Activity missing ID'
			};
		}

		const activityInstance = instance.activities[activity.id];

		activityInstance.status = ActivityStatus.Completed;
		activityInstance.completedAt = new Date();

		await this.processInstanceRepo.save(instance);

		const success = activity.result !== 'failure';
		return await this.completeProcess(instanceId, activity.reason || 'Process terminated', success);
	}


	private async continueExecution(instanceId: string): Promise<ProcessExecutionResult> {
		logger.info(`ProcessEngine: Continuing execution for instance '${instanceId}'`);

		const instance = await this.processInstanceRepo.findById(instanceId);

		let executionContext = instance.executionContext;

		if (!executionContext.currentActivity) {
			logger.warn(`ProcessEngine: No current activity for instance '${instanceId}', completing process`);
			return await this.completeProcess(instanceId, 'Process completed - no current activity');
		}

		const currentActivityInstance = instance.activities[executionContext.currentActivity];
		if (!currentActivityInstance) {
			logger.error(`ProcessEngine: Current activity '${executionContext.currentActivity}' not found in instance '${instanceId}'`);
			return await this.completeProcess(instanceId, 'Current activity not found', false);
		}

		logger.debug(`ProcessEngine: Current activity '${executionContext.currentActivity}' status: ${currentActivityInstance.status}`);

		// Get process definition for sequence and next property handling
		const processDefinition = await this.processDefinitionRepo.findById(instance.processId);

		// Check if we're in a sequence and need to continue
		if (processDefinition) {
			// Then check for sequence activities
			for (const [activityId, activityDef] of Object.entries(processDefinition.activities)) {
				if (activityDef.type === ActivityType.Sequence) {
					const sequenceActivity = activityDef as SequenceActivity;
					const sequenceInstance = instance.activities[activityId];

					// Check if this sequence contains our current activity and has sequence data
					const seqInst = sequenceInstance as SequenceActivityInstance;
					if (seqInst.sequenceIndex !== undefined) {
						// Determine whether this sequence contains our current activity directly
						// or indirectly via a child activity that redirected execution (e.g. switch -> branch)
						const containsCurrent = sequenceActivity.activities.some(a => {
							const aid = extractActivityId(a);
							if (aid === executionContext.currentActivity) return true;
							const childInst = instance.activities[aid] as ActivityInstance | undefined;
							if (childInst && (childInst as any).nextActivity) {
								try {
									const redirected = extractActivityId((childInst as any).nextActivity);
									if (redirected === executionContext.currentActivity) return true;
								} catch (e) {
									// ignore malformed nextActivity
								}
							}
							return false;
						});

						if (containsCurrent) {
							logger.debug(`ProcessEngine: Found parent sequence '${activityId}' for current activity '${executionContext.currentActivity}'`);
							const nextIndex = seqInst.sequenceIndex! + 1;

							if (nextIndex < seqInst.sequenceActivities!.length) {
								// Continue with next activity in sequence
								seqInst.sequenceIndex = nextIndex;
								const nextActivity = extractActivityId(seqInst.sequenceActivities![nextIndex]);

								logger.info(`ProcessEngine: Pushing Frame sequence '${activityId}' - moving to activity '${nextActivity}' (index ${nextIndex})`);
								executionContext.pushFrame(nextActivity, activityId, nextIndex);
								
								logger.info(`ProcessEngine: Continuing sequence '${activityId}' - moving to activity '${nextActivity}' (index ${nextIndex})`);
								await this.processInstanceRepo.save(instance);
								return await this.executeNextStep(instanceId);
							} else {
								// Sequence completed
								logger.info(`ProcessEngine: Sequence '${activityId}' completed for instance '${instanceId}'`);
								sequenceInstance.status = ActivityStatus.Completed;
								sequenceInstance.completedAt = new Date();
								await this.processInstanceRepo.save(instance);
								// Record the completed sequence ID so we can check for parent sequences
								(instance as any).__lastCompletedSequenceId = activityId;
								break; // Exit the loop and continue with normal completion
							}
						}
					}
				}
			}

			// Check if a nested sequence just completed and advance any parent sequences that reference it
			const completedSeqId = (instance as any).__lastCompletedSequenceId as string | undefined;
			if (completedSeqId) {
				logger.debug(`ProcessEngine: Looking for parent sequence referencing completed sequence '${completedSeqId}'`);
				for (const [parentId, parentDef] of Object.entries(processDefinition.activities)) {
					if (parentDef.type === ActivityType.Sequence) {
						const parentActivity = parentDef as SequenceActivity;
						const parentInstance = instance.activities[parentId] as SequenceActivityInstance | undefined;
						
						// Check if this parent sequence references the completed nested sequence
								if (parentInstance && parentInstance.sequenceActivities) {
									// Determine whether parent sequence references the completed sequence directly
									// or indirectly via a child activity that redirected execution (e.g. switch -> nested sequence)
									const referencesCompleted = parentActivity.activities.some(a => {
										const aid = extractActivityId(a);
										if (aid === completedSeqId) return true;
										const childInst = instance.activities[aid] as ActivityInstance | undefined;
										if (childInst && (childInst as any).nextActivity) {
											try {
												const redirected = extractActivityId((childInst as any).nextActivity);
												if (redirected === completedSeqId) return true;
											} catch (e) {
												// ignore malformed nextActivity
											}
										}
										return false;
									});
									if (!referencesCompleted) continue;
									// Find the index within the parent's sequence activities that references the completed sequence.
									let completedIndex = -1;
									for (let i = 0; i < parentInstance.sequenceActivities.length; i++) {
										const ref = parentInstance.sequenceActivities[i];
										const refId = extractActivityId(ref);
										if (refId === completedSeqId) {
											completedIndex = i;
											break;
										}
										const childInst = instance.activities[refId] as ActivityInstance | undefined;
										if (childInst && (childInst as any).nextActivity) {
											try {
												const redirected = extractActivityId((childInst as any).nextActivity);
												if (redirected === completedSeqId) {
													completedIndex = i;
													break;
												}
											} catch (e) {
												// ignore malformed nextActivity
											}
										}
									}
									const nextIndex = completedIndex + 1;
							
							if (nextIndex < parentInstance.sequenceActivities.length) {
								// Continue to next activity in parent sequence
								parentInstance.sequenceIndex = nextIndex;
								const nextActivity = extractActivityId(parentInstance.sequenceActivities[nextIndex]);


								logger.info(`ProcessEngine: Pushing Frame Parent sequence '${parentId}' continuing to activity '${nextActivity}' (index ${nextIndex})`);
								executionContext.pushFrame(nextActivity, parentId, nextIndex);
								
								await this.processInstanceRepo.save(instance);
								// Clear the completed sequence marker
								delete (instance as any).__lastCompletedSequenceId;
								return await this.executeNextStep(instanceId);
							} else {
								// Parent sequence also completed
								logger.info(`ProcessEngine: Parent sequence '${parentId}' completed for instance '${instanceId}'`);
								parentInstance.status = ActivityStatus.Completed;
								parentInstance.completedAt = new Date();
								await this.processInstanceRepo.save(instance);
								// Continue searching for outer parent sequences
							}
						}
					}
				}
			}
		}

		// If we reach here and no sequence continuation happened, the process is complete
		logger.info(`ProcessEngine: No sequence continuation found, completing process for instance '${instanceId}'`);
		return await this.completeProcess(instanceId, 'Process completed successfully');
	}

	/**
	 * Check if process should complete after an activity finishes
	 * Process completes when the call stack is empty (at root)
	 */
	private async checkForProcessCompletion(instanceId: string, completedActivityId: string): Promise<ProcessExecutionResult> {
		const instance = await this.processInstanceRepo.findById(instanceId);

		// Pop the completed frame from call stack
		const completedFrame = instance.executionContext.popFrame();
		
		// If call stack is now empty, process is complete
		if (instance.executionContext.isAtRoot()) {
			logger.info(`ProcessEngine: Call stack empty after completing '${completedActivityId}', process complete for instance '${instanceId}'`);
			return await this.completeProcess(instanceId, `Process completed - call stack empty after '${completedActivityId}'`);
		}

		// There's still a parent frame, so continue execution from there
		const parentFrame = instance.executionContext.getCurrentFrame();
		if (parentFrame) {
			logger.info(`ProcessEngine: Returning to parent frame '${parentFrame.activityId}' after completing '${completedActivityId}'`);
			return await this.continueFromParent(instanceId, completedFrame!);
		}

		// Fallback - should not reach here
		return await this.completeProcess(instanceId, 'Unexpected completion state');
	}

	/**
	 * Continue execution from a parent frame after a child activity completes
	 */
	private async continueFromParent(instanceId: string, completedFrame: ExecutionFrame): Promise<ProcessExecutionResult> {
		const instance = await this.processInstanceRepo.findById(instanceId);

		const processDefinition = await this.processDefinitionRepo.findById(instance.processId);
		if (!processDefinition) {
			return {
				instanceId,
				status: ProcessStatus.Failed,
				message: 'Process definition not found'
			};
		}

		const parentFrame = instance.executionContext.getCurrentFrame();
		logger.info(`ProcessEngine: continueFromParent - completedFrame: ${JSON.stringify(completedFrame)}, parentFrame: ${JSON.stringify(parentFrame)}`);
		
		if (!parentFrame) {
			// No parent frame, process should complete
			return await this.completeProcess(instanceId, 'No parent frame found');
		}

		// The parentFrame.activityId is the sequence/switch/branch that contains the completed activity
		const parentActivity = processDefinition.activities[parentFrame.activityId];
		if (!parentActivity) {
			return {
				instanceId,
				status: ProcessStatus.Failed,
				message: `Parent activity '${parentFrame.activityId}' not found`
			};
		}

		const parentActivityInstance = instance.activities[parentFrame.activityId];
		if (!parentActivityInstance) {
			return {
				instanceId,
				status: ProcessStatus.Failed,
				message: `Parent activity instance '${parentFrame.activityId}' not found`
			};
		}

		logger.info(`ProcessEngine: Parent activity type: ${parentActivity.type}, ID: ${parentActivity.id}`);

		// Use strategy pattern to handle continuation
		const strategy = this.continuationStrategies.get(parentActivity.type);
		if (!strategy) {
			return {
				instanceId,
				status: ProcessStatus.Failed,
				message: `No continuation strategy found for activity type '${parentActivity.type}'`
			};
		}

		const continuationResult = await strategy.continue(parentActivityInstance, completedFrame, this, instanceId);
		
		if (!continuationResult) {
			return {
				instanceId,
				status: ProcessStatus.Failed,
				message: 'Continuation strategy returned null'
			};
		}

		if (continuationResult.completed) {
			// Parent activity completed, mark it as completed and continue up the stack
			logger.info(`ProcessEngine: Parent activity '${parentActivity.id}' completed`);
			parentActivityInstance.status = ActivityStatus.Completed;
			parentActivityInstance.completedAt = new Date();
			await this.processInstanceRepo.save(instance);
			
			return await this.checkForProcessCompletion(instanceId, parentActivity.id!);
		} else if (continuationResult.nextActivityId) {
			// Execute next activity
			logger.info(`ProcessEngine: Continuing to next activity '${continuationResult.nextActivityId}'`);
			return await this.executeActivityInFrame(
				instanceId, 
				continuationResult.nextActivityId, 
				continuationResult.parentId!, 
				continuationResult.position
			);
		} else {
			return {
				instanceId,
				status: ProcessStatus.Failed,
				message: 'Continuation strategy returned invalid result'
			};
		}
	}

	/**
	 * Execute an activity within a frame context
	 */
	private async executeActivityInFrame(instanceId: string, activityId: string, parentId: string, position?: number): Promise<ProcessExecutionResult> {
		const instance = await this.processInstanceRepo.findById(instanceId);

		const processDefinition = await this.processDefinitionRepo.findById(instance.processId);
		if (!processDefinition) {
			return { instanceId, status: ProcessStatus.Failed, message: 'Process definition not found' };
		}

		const activity = processDefinition.activities[activityId];
		if (!activity) {
			return { instanceId, status: ProcessStatus.Failed, message: `Activity '${activityId}' not found` };
		}

		// Push new frame onto call stack
		instance.executionContext.pushFrame(activityId, parentId, position);
		await this.processInstanceRepo.save(instance);

		// Execute the activity
		return await this.executeActivity(instanceId, activity);
	}

	private async completeProcess(instanceId: string, reason: string, success: boolean = true): Promise<ProcessExecutionResult> {
		const instance = await this.processInstanceRepo.findById(instanceId);

		instance.status = success ? ProcessStatus.Completed : ProcessStatus.Failed;
		instance.completedAt = new Date();

		// Calculate aggregate pass/fail when process completes
		if (instance.status === ProcessStatus.Completed) {
			const passFailValues: PassFail[] = [];
			
			// Collect all non-undefined passFail values from activities
			Object.values(instance.activities).forEach(activity => {
				if (activity.passFail !== undefined && activity.passFail !== null) {
					passFailValues.push(activity.passFail);
				}
			});

			// Set aggregate based on collected values
			if (passFailValues.length > 0) {
				if (passFailValues.some(pf => pf === PassFail.Fail)) {
					instance.aggregatePassFail = AggregatePassFail.AnyFail;
				} else if (passFailValues.every(pf => pf === PassFail.Pass)) {
					instance.aggregatePassFail = AggregatePassFail.AllPass;
				}
				// If neither all pass nor any fail (shouldn't happen with current enum), leave undefined
			}
		}

		await this.processInstanceRepo.save(instance);

		return {
			instanceId,
			status: instance.status,
			message: reason
		};
	}



	private initializeVariables(variables: Variable[]): { [key: string]: any } {
		const result: { [key: string]: any } = {};
		variables.forEach(variable => {
			result[variable.name] = variable.defaultValue;
		});
		return result;
	}

	private initializeActivities(activities: { [key: string]: Activity }): { [key: string]: ActivityInstance } {
		const result: { [key: string]: ActivityInstance } = {};

		Object.entries(activities).forEach(([activityKey, activity]) => {
			// Ensure activity has an ID (derived from map key if not set)
			const normalizedActivity = {
				...activity,
				id: activity.id || activityKey
			};

			const activityInstance: ActivityInstance = {
				...normalizedActivity,
				status: ActivityStatus.Pending
			};

		// For human activities, initialize variables from inputs definition
		if (normalizedActivity.type === ActivityType.Human) {
			const humanActivity = normalizedActivity as HumanActivity;
			if (humanActivity.inputs) {
				activityInstance.variables = humanActivity.inputs.map(field => ({
					name: field.name,
					label: field.label,
					hint: field.hint,
					type: field.type,
					value: field.defaultValue,
					defaultValue: field.defaultValue,
					description: field.description,
					required: field.required,
					options: field.options,
					min: field.min,
					max: field.max,
					units: field.units,
					pattern: field.pattern,
					patternDescription: field.patternDescription,
					fileSpec: field.fileSpec
				}));
				
				// Remove inputs from runtime instance to prevent redundant state
				// Only variables should exist at runtime
				delete (activityInstance as any).inputs;
			}
		}			result[activityKey] = activityInstance;
		});

		return result;
	}

	// Repository management methods
	async getRunningInstances(): Promise<ProcessInstance[]> {
		return await this.processInstanceRepo.findRunningInstances();
	}

	async getInstancesByProcessId(processId: string): Promise<ProcessInstanceFlyweight[]> {
		return await this.processInstanceRepo.findByProcessId(processId);
	}


	/**
	 * Run An instance picking up at the first incomplete activity
	 * Completed activities are left as-is
	 * Failed or Incomplete activities are reset to Pending
	 * @param instanceId 
	 * @returns 
	 */
	async resumeInstance(instanceId: string): Promise<ProcessExecutionResult> {
		// Get the existing instance
		const instance = await this.processInstanceRepo.findById(instanceId);
		logger.info(`ProcessEngine: Re-running instance '${instanceId}'`, {
			processId: instance.processId,
			previousStatus: instance.status
		});

		// Get the process definition to find the start activity
		const processDefinition = await this.processDefinitionRepo.findById(instance.processId);
		if (!processDefinition) {
			throw new Error(`Process definition '${instance.processId}' not found`);
		}

		const startActivityId = extractActivityId(processDefinition.start);

		// Reset the instance state to re-run from the beginning
		// Keep all activity data (including field values) - just reset statuses
		instance.status = ProcessStatus.Running;
		instance.completedAt = undefined;
		
		// First, fix the activity statuses (preserve completed activities)
		for (const activityId in instance.activities) {
			const activity = instance.activities[activityId];
			// Only reset activities that weren't completed
			// Check for completion using completedAt timestamp as well as status
			const isCompleted = activity.status === ActivityStatus.Completed || activity.completedAt;
			if (!isCompleted) {
				activity.status = ActivityStatus.Pending;
				activity.startedAt = undefined;
				activity.completedAt = undefined;
				activity.error = undefined;
			} else {
				// Ensure completed activities have the correct status
				activity.status = ActivityStatus.Completed;
			}
			// NOTE: We deliberately keep activity-specific fields with their values
			// so they can be displayed when re-running
		}
		
		// Now clear call stack and start fresh from the beginning
		instance.executionContext.clearCallStack();
		
		// Always start from the beginning - the execution engine will naturally
		// skip completed activities and find the first incomplete one while
		// building the proper call stack structure
		
		instance.executionContext.pushFrame(startActivityId);
		logger.info(`ProcessEngine: Re-run will start from beginning '${startActivityId}' and skip completed activities`);
		
		// No need to manually find the first incomplete activity - let the
		// execution engine handle this during normal flow processing

		logger.info(`ProcessEngine: Reset instance '${instanceId}' for re-run`, {
			currentActivity: instance.executionContext.currentActivity,
			activitiesCount: Object.keys(instance.activities).length
		});

		// Save the reset instance
		await this.processInstanceRepo.save(instance);

		// Check if the first incomplete activity is a human task that needs user input
		const currentActivity = instance.executionContext.currentActivity;
		if (currentActivity) {
			const activityDef = processDefinition.activities[currentActivity];
			if (activityDef?.type === ActivityType.Human) {
				const humanActivity = activityDef as HumanActivity;
				const activityInstance = instance.activities[currentActivity] as HumanActivityInstance;
				
				// Create fields with preserved values using the activity instance variables
				const fieldsForUI: FieldValue[] = activityInstance.variables?.map(variable => ({
					name: variable.name,
					type: variable.type,
					value: variable.value,
					defaultValue: variable.defaultValue,
					description: variable.description,
					required: variable.required,
					options: variable.options,
					min: variable.min,
					max: variable.max,
					units: variable.units,
					pattern: variable.pattern,
					patternDescription: variable.patternDescription,
					fileSpec: variable.fileSpec
				})) || [];

				const humanTaskData: HumanTaskData = {
					activityId: currentActivity,
					prompt: humanActivity.prompt,
					fields: fieldsForUI
				};
				
				return {
					instanceId,
					status: ProcessStatus.Running,
					currentActivity: currentActivity,
					humanTask: humanTaskData,
					message: `Resumed at incomplete activity: ${humanActivity.name || currentActivity}`
				};
			}
		}

		// Execute from the current position (either start or first incomplete)
		return await this.executeNextStep(instanceId);
	}



	/**
	 * Reset Execution to the start of an activity.  This initializwes the 
	 * callstack and sets all activities as status Pending
	 * Existing values are retained for all Activities
	 */
	async restartInstance(instanceId: string): Promise<ProcessExecutionResult> {
		logger.info(`ProcessEngine: Navigate to start - instance '${instanceId}'`);

		const instance = await this.processInstanceRepo.findById(instanceId);

		const process = await this.processDefinitionRepo.findById(instance.processId);

		instance.status = ProcessStatus.Running;
		instance.completedAt = undefined;

		// Init a brand new execution context
		const executionContext = this.initExecutionContextAtStart(process);
		logger.info(`ProcessEngine: Initialized execution context for navigation to start`, executionContext);

		instance.executionContext = executionContext;

		// init all activity states to Pending (or undefined?)
		for (const activityId in instance.activities) {
			let activity = instance.activities[activityId];
			activity.status = ActivityStatus.Pending;
		}

		// persist the reset instance
		await this.processInstanceRepo.save(instance);

		// and go...
		return await this.executeNextStep(instanceId);
	}



	/**
	 * Return Stats about processes and instances
	 * TODO: Currently not exposed to API
	 * @returns
	 */
	async getProcessStatistics(): Promise<{ [key: string]: number }> {
		const [
			totalProcesses,
			totalInstances,
			runningInstances,
			completedInstances,
			failedInstances
		] = await Promise.all([
			this.processDefinitionRepo.count(),
			this.processInstanceRepo.count(),
			this.processInstanceRepo.countByStatus(ProcessStatus.Running),
			this.processInstanceRepo.countByStatus(ProcessStatus.Completed),
			this.processInstanceRepo.countByStatus(ProcessStatus.Failed)
		]);

		return {
			totalProcesses,
			totalInstances,
			runningInstances,
			completedInstances,
			failedInstances
		};
	}


	/**
	 * Load a process definition - This is only used by Tests to inject process definitions
	 * TODO: This should go away and the Test should load processes via the Repo
	 * @param processDefinition
	 */
	async loadProcess(processDefinition: ProcessDefinition): Promise<void> {
		logger.info(`ProcessEngine: Loading process definition`, {
			id: processDefinition.id,
			name: processDefinition.name,
			start: processDefinition.start,
			activitiesCount: Object.keys(processDefinition.activities || {}).length
		});

		if (!processDefinition.id) {
			logger.error('ProcessEngine: Process definition missing required id field');
			throw new Error('Process definition must have an id');
		}

		if (!processDefinition.name) {
			logger.error('ProcessEngine: Process definition missing required name field');
			throw new Error('Process definition must have a name');
		}

		if (!processDefinition.start) {
			logger.warn('ProcessEngine: Process definition missing start activity reference', {
				processId: processDefinition.id,
				name: processDefinition.name,
				start: processDefinition.start
			});
		}

		// Validate and normalize the incoming process definition
		const validation = ProcessLoader.validate(processDefinition);
		if (!validation.valid) {
			// ProcessNormalizer already logs individual AJV schema diagnostics at ERROR.
			logger.error('ProcessEngine: Process definition validation failed', { errors: validation.errors });
			throw new Error(`Process definition validation failed: ${validation.errors.join('; ')}`);
		}
		if (validation.warnings && validation.warnings.length) {
			logger.warn('ProcessEngine: Process definition validation warnings', { warnings: validation.warnings });
		}
		ProcessLoader.normalize(processDefinition);

		await this.processDefinitionRepo.save(processDefinition);
		logger.info(`ProcessEngine: Process definition '${processDefinition.id}' loaded successfully`);
	}

	/**
	 * Get the FileService instance for direct file operations
	 * @returns FileService instance
	 */
	getFileService(): FileService {
		return this.fileService;
	}

	/**
	 * Create file variables for an activity (useful for compute activities generating files)
	 * @param instanceId Process instance ID
	 * @param activityId Activity ID
	 * @param files Array of file data to create variables for
	 * @param baseVariableName Base name for the file variables
	 * @returns Array of created file variables
	 */
	async createFileVariablesForActivity(
		instanceId: string,
		activityId: string,
		files: { filename: string; mimeType: string; content: Buffer; description?: string }[],
		baseVariableName: string = 'generatedFile'
	): Promise<{ [key: string]: any }> {
		logger.info(`ProcessEngine: Creating file variables for activity '${activityId}' in instance '${instanceId}'`, {
			fileCount: files.length,
			baseVariableName
		});

		const instance = await this.processInstanceRepo.findById(instanceId);
		const activityInstance = instance.activities[activityId];
		
		if (!activityInstance) {
			throw new Error(`Activity '${activityId}' not found in instance '${instanceId}'`);
		}

		if (!activityInstance.variables) {
			activityInstance.variables = [];
		}

		// Create file variables using the file service
		const fileVariables = await this.fileService.createVariablesFromUploads(
			files, 
			baseVariableName,
			instanceId,
			activityId,
			instance.processId
		);
		
		// Add to activity's variables
		this.fileService.updateVariablesWithFiles(activityInstance.variables, fileVariables);

		// Save the updated instance
		await this.processInstanceRepo.save(instance);

		// Return a simplified object for use in compute activities
		const result: { [key: string]: any } = {};
		fileVariables.forEach((variable: Variable) => {
			result[variable.name] = variable.value;
		});

		logger.info(`ProcessEngine: Created ${fileVariables.length} file variables for activity '${activityId}'`, {
			variableNames: fileVariables.map((v: Variable) => v.name)
		});

		return result;
	}

	/**
	 * Get file data from a variable in an activity
	 * @param instanceId Process instance ID
	 * @param activityId Activity ID
	 * @param variableName Name of the file variable
	 * @returns File data or null if not found
	 */
	async getFileFromActivityVariable(instanceId: string, activityId: string, variableName: string) {
		const instance = await this.processInstanceRepo.findById(instanceId);
		const activityInstance = instance.activities[activityId];
		
		if (!activityInstance || !activityInstance.variables) {
			return null;
		}

		const variable = activityInstance.variables.find(v => v.name === variableName);
		if (!variable) {
			return null;
		}

		return await this.fileService.downloadFromVariable(variable);
	}
}



/**
 * Result of activity continuation logic
 */
interface ContinuationResult {
	nextActivityId?: string;
	parentId?: string;
	position?: number;
	completed?: boolean; // If true, the parent activity is complete
}

/**
 * Strategy interface for handling activity continuation
 */
interface ActivityContinuationStrategy {
	continue(
		activity: ActivityInstance,
		completedFrame: ExecutionFrame,
		processEngine: ProcessEngine,
		instanceId: string
	): Promise<ContinuationResult | null>;
}

/**
 * Continuation strategy for sequence activities
 */
class SequenceContinuationStrategy implements ActivityContinuationStrategy {
	async continue(
		activity: ActivityInstance,
		completedFrame: ExecutionFrame,
		processEngine: ProcessEngine,
		instanceId: string
	): Promise<ContinuationResult | null> {
		const sequence = activity as SequenceActivityInstance;
		const currentPosition = completedFrame.position || 0;
		const nextPosition = currentPosition + 1;

		// Check if there are more activities in the sequence
		if (nextPosition < sequence.activities.length) {
			// Execute next activity in sequence
			const nextActivityRef = sequence.activities[nextPosition];
			const nextActivityId = extractActivityId(nextActivityRef);
			
			return {
				nextActivityId,
				parentId: sequence.id!,
				position: nextPosition
			};
		} else {
			// Sequence completed
			return { completed: true };
		}
	}
}

/**
 * Continuation strategy for switch activities
 */
class SwitchContinuationStrategy implements ActivityContinuationStrategy {
	async continue(
		activity: ActivityInstance,
		completedFrame: ExecutionFrame,
		processEngine: ProcessEngine,
		instanceId: string
	): Promise<ContinuationResult | null> {
		// Switch activities complete when their selected branch completes
		return { completed: true };
	}
}

/**
 * Continuation strategy for branch activities
 */
class BranchContinuationStrategy implements ActivityContinuationStrategy {
	async continue(
		activity: ActivityInstance,
		completedFrame: ExecutionFrame,
		processEngine: ProcessEngine,
		instanceId: string
	): Promise<ContinuationResult | null> {
		// Branch activities complete when their path completes
		return { completed: true };
	}
}

/**
 * Default continuation strategy for simple activities (Human, Compute, API, Terminate)
 */
class DefaultContinuationStrategy implements ActivityContinuationStrategy {
	async continue(
		activity: ActivityInstance,
		completedFrame: ExecutionFrame,
		processEngine: ProcessEngine,
		instanceId: string
	): Promise<ContinuationResult | null> {
		// Simple activities complete when their child completes
		return { completed: true };
	}
}
