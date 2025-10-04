import { v4 as uuidv4 } from 'uuid';
import {
  ProcessDefinition,
  ProcessInstance,
  ProcessStatus,
  Activity,
  ActivityInstance,
  ActivityStatus,
  ActivityType,
  PassFail,
  HumanActivity,
  ComputeActivity,
  APIActivity,
  SequenceActivity,
  ParallelActivity,
  BranchActivity,
  SwitchActivity,
  TerminateActivity,
  ProcessExecutionResult,
  HumanTaskData
} from './types';
import { ExpressionEvaluator } from './expression-evaluator';
import { APIExecutor } from './api-executor';
import { FieldValidator } from './field-validator';
import { RepositoryFactory } from './repositories/repository-factory';
import { ProcessDefinitionRepository } from './repositories/process-definition-repository';
import { ProcessInstanceRepository } from './repositories/process-instance-repository';

// Logger setup
const logger = {
  info: (message: string, data?: any) => console.log(`[INFO] ${new Date().toISOString()} - ${message}`, data || ''),
  warn: (message: string, data?: any) => console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, data || ''),
  error: (message: string, data?: any) => console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, data || ''),
  debug: (message: string, data?: any) => console.log(`[DEBUG] ${new Date().toISOString()} - ${message}`, data || '')
};

export class ProcessEngine {
  private processDefinitionRepo: ProcessDefinitionRepository;
  private processInstanceRepo: ProcessInstanceRepository;
  private expressionEvaluator: ExpressionEvaluator;
  private apiExecutor: APIExecutor;

  constructor() {
    logger.info('ProcessEngine: Initializing...');
    this.processDefinitionRepo = RepositoryFactory.getProcessDefinitionRepository();
    this.processInstanceRepo = RepositoryFactory.getProcessInstanceRepository();
    this.expressionEvaluator = new ExpressionEvaluator();
    this.apiExecutor = new APIExecutor();
    logger.info('ProcessEngine: Initialization complete');
  }

  // Load a process definition
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
      logger.warn('ProcessEngine: Process definition missing start activity reference', processDefinition);
    }
    
    await this.processDefinitionRepo.save(processDefinition);
    logger.info(`ProcessEngine: Process definition '${processDefinition.id}' loaded successfully`);
  }

  // Get all loaded processes
  async getProcesses(): Promise<ProcessDefinition[]> {
    return await this.processDefinitionRepo.findAll();
  }

  // Get a specific process definition
  async getProcess(processId: string): Promise<ProcessDefinition | null> {
    return await this.processDefinitionRepo.findById(processId);
  }

  // Create a new process instance
  async createInstance(processId: string): Promise<ProcessExecutionResult> {
    logger.info(`ProcessEngine: Creating instance for process '${processId}'`);
    
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
      start: processDefinition.start,
      activitiesKeys: Object.keys(processDefinition.activities || {})
    });

    if (!processDefinition.start) {
      logger.error(`ProcessEngine: Process definition '${processId}' has no start activity defined`, processDefinition);
      return {
        instanceId: '',
        status: ProcessStatus.Failed,
        message: `Process definition '${processId}' has no start activity defined`
      };
    }

    const instanceId = uuidv4();
    logger.info(`ProcessEngine: Generated instance ID '${instanceId}'`);

    let startActivityId: string;
    try {
      startActivityId = this.extractActivityId(processDefinition.start);
      logger.info(`ProcessEngine: Extracted start activity ID '${startActivityId}' from '${processDefinition.start}'`);
    } catch (error) {
      logger.error(`ProcessEngine: Failed to extract start activity ID from '${processDefinition.start}'`, error);
      return {
        instanceId: '',
        status: ProcessStatus.Failed,
        message: `Invalid start activity reference: ${processDefinition.start}`
      };
    }

    const instance: ProcessInstance = {
      instanceId,
      processId,
      status: ProcessStatus.Running,
      startedAt: new Date(),
      currentActivity: startActivityId,
      variables: this.initializeVariables(processDefinition.variables || []),
      activities: this.initializeActivities(processDefinition.activities)
    };

    logger.debug(`ProcessEngine: Created instance object`, {
      instanceId,
      processId,
      currentActivity: startActivityId,
      variableCount: Object.keys(instance.variables).length,
      activityCount: Object.keys(instance.activities).length
    });

    await this.processInstanceRepo.save(instance);
    logger.info(`ProcessEngine: Instance '${instanceId}' saved to repository`);
    
    return await this.executeNextStep(instanceId);
  }

  // Get process instance
  async getInstance(instanceId: string): Promise<ProcessInstance | null> {
    return await this.processInstanceRepo.findById(instanceId);
  }

  // Execute the next step in a process instance
  async executeNextStep(instanceId: string): Promise<ProcessExecutionResult> {
    logger.info(`ProcessEngine: Executing next step for instance '${instanceId}'`);
    
    const instance = await this.processInstanceRepo.findById(instanceId);
    if (!instance) {
      logger.error(`ProcessEngine: Instance '${instanceId}' not found`);
      return {
        instanceId,
        status: ProcessStatus.Failed,
        message: 'Process instance not found'
      };
    }

    logger.debug(`ProcessEngine: Found instance`, {
      instanceId,
      status: instance.status,
      currentActivity: instance.currentActivity
    });

    if (instance.status !== ProcessStatus.Running) {
      logger.warn(`ProcessEngine: Instance '${instanceId}' is not running (status: ${instance.status})`);
      return {
        instanceId,
        status: instance.status,
        message: `Process is ${instance.status}`
      };
    }

    if (!instance.currentActivity) {
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

    const activity = processDefinition.activities[instance.currentActivity];
    if (!activity) {
      logger.error(`ProcessEngine: Activity '${instance.currentActivity}' not found in process '${instance.processId}'`);
      return {
        instanceId,
        status: ProcessStatus.Failed,
        message: `Activity '${instance.currentActivity}' not found`
      };
    }

    logger.info(`ProcessEngine: Executing activity '${instance.currentActivity}' of type '${activity.type}'`);
    return await this.executeActivity(instanceId, activity);
  }

  // Submit data for a human task
  async submitHumanTask(instanceId: string, activityId: string, data: any, files?: any[]): Promise<ProcessExecutionResult> {
    logger.info(`ProcessEngine: Submitting human task for instance '${instanceId}', activity '${activityId}'`, {
      dataKeys: Object.keys(data || {}),
      hasFiles: !!(files && files.length > 0)
    });
    
    const instance = await this.processInstanceRepo.findById(instanceId);
    if (!instance) {
      logger.error(`ProcessEngine: Instance '${instanceId}' not found during human task submission`);
      return {
        instanceId,
        status: ProcessStatus.Failed,
        message: 'Process instance not found'
      };
    }

    logger.debug(`ProcessEngine: Found instance for human task submission`, {
      instanceId,
      currentActivity: instance.currentActivity,
      status: instance.status
    });

    const activityInstance = instance.activities[activityId];
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

    // Store the submitted data
    activityInstance.data = activityInstance.data || {};
    
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
    
    Object.assign(activityInstance.data, data);
    if (files) {
      activityInstance.data._files = files;
    }
    
    logger.debug(`ProcessEngine: Stored human task data`, {
      activityId,
      dataStored: activityInstance.data
    });
    
    // Complete the human task
    activityInstance.status = ActivityStatus.Completed;
    activityInstance.completedAt = new Date();

    // Save the updated instance
    await this.processInstanceRepo.save(instance);
    
    logger.info(`ProcessEngine: Human task '${activityId}' completed, continuing execution for instance '${instanceId}'`);

    // Continue execution
    return await this.continueExecution(instanceId);
  }

  private async executeActivity(instanceId: string, activity: Activity): Promise<ProcessExecutionResult> {
    logger.info(`ProcessEngine: Executing activity '${activity.id}' of type '${activity.type}' for instance '${instanceId}'`);
    
    const instance = await this.processInstanceRepo.findById(instanceId);
    if (!instance) {
      logger.error(`ProcessEngine: Instance '${instanceId}' not found during activity execution`);
      return {
        instanceId,
        status: ProcessStatus.Failed,
        message: 'Process instance not found'
      };
    }

    const activityInstance = instance.activities[activity.id];
    if (!activityInstance) {
      logger.error(`ProcessEngine: Activity instance '${activity.id}' not found in instance '${instanceId}'`);
      return {
        instanceId,
        status: ProcessStatus.Failed,
        message: `Activity instance '${activity.id}' not found`
      };
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
          break;
        
        case ActivityType.Compute:
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
        
        case ActivityType.Parallel:
          logger.info(`ProcessEngine: Executing parallel activity '${activity.id}'`);
          result = await this.executeParallelActivity(instanceId, activity as ParallelActivity);
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
      if (updatedInstance) {
        await this.processInstanceRepo.save(updatedInstance);
        logger.debug(`ProcessEngine: Saved updated instance '${instanceId}' after activity execution`);
      }

      logger.info(`ProcessEngine: Activity '${activity.id}' execution completed with status '${result.status}'`);
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
    const humanTaskData: HumanTaskData = {
      activityId: activity.id,
      prompt: activity.prompt,
      fields: activity.inputs || [],
      fileUploads: activity.fileUploads,
      attachments: activity.attachments
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
    if (!instance) {
      return {
        instanceId,
        status: ProcessStatus.Failed,
        message: 'Process instance not found'
      };
    }

    const activityInstance = instance.activities[activity.id];

    try {
      // Execute JavaScript code
      const result = this.expressionEvaluator.executeCode(activity.code, instance, activity.id);
      
      // Store any results
      if (result) {
        activityInstance.data = result;
      }

      // Complete the activity
      activityInstance.status = ActivityStatus.Completed;
      activityInstance.completedAt = new Date();

      await this.processInstanceRepo.save(instance);
      return await this.continueExecution(instanceId);
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
    if (!instance) {
      return {
        instanceId,
        status: ProcessStatus.Failed,
        message: 'Process instance not found'
      };
    }

    const activityInstance = instance.activities[activity.id];

    try {
      const response = await this.apiExecutor.execute(activity, instance);
      
      activityInstance.data = response;
      activityInstance.status = ActivityStatus.Completed;
      activityInstance.completedAt = new Date();

      await this.processInstanceRepo.save(instance);
      return await this.continueExecution(instanceId);
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
    const instance = await this.processInstanceRepo.findById(instanceId);
    if (!instance) {
      return {
        instanceId,
        status: ProcessStatus.Failed,
        message: 'Process instance not found'
      };
    }
    
    // For sequence activities, we execute the first child activity
    if (activity.activities.length > 0) {
      const firstActivity = this.extractActivityId(activity.activities[0]);
      instance.currentActivity = firstActivity;
      
      // Store sequence state for continuation
      const activityInstance = instance.activities[activity.id];
      activityInstance.data = {
        sequenceIndex: 0,
        activities: activity.activities
      };
      
      await this.processInstanceRepo.save(instance);
      return await this.executeNextStep(instanceId);
    } else {
      // Empty sequence completes immediately
      const activityInstance = instance.activities[activity.id];
      activityInstance.status = ActivityStatus.Completed;
      activityInstance.completedAt = new Date();
      
      await this.processInstanceRepo.save(instance);
      return await this.continueExecution(instanceId);
    }
  }

  private async executeParallelActivity(instanceId: string, activity: ParallelActivity): Promise<ProcessExecutionResult> {
    // For now, we'll execute parallel activities sequentially
    // In a full implementation, you'd want true parallel execution
    return await this.executeSequenceActivity(instanceId, {
      ...activity,
      type: ActivityType.Sequence
    } as SequenceActivity);
  }

  private async executeBranchActivity(instanceId: string, activity: BranchActivity): Promise<ProcessExecutionResult> {
    const instance = await this.processInstanceRepo.findById(instanceId);
    if (!instance) {
      return {
        instanceId,
        status: ProcessStatus.Failed,
        message: 'Process instance not found'
      };
    }

    const activityInstance = instance.activities[activity.id];

    try {
      const conditionResult = this.expressionEvaluator.evaluateCondition(activity.condition, instance);
      
      const nextActivity = conditionResult ? activity.then : activity.else;
      if (nextActivity) {
        instance.currentActivity = this.extractActivityId(nextActivity);
        
        activityInstance.status = ActivityStatus.Completed;
        activityInstance.completedAt = new Date();
        activityInstance.data = { conditionResult, nextActivity };
        
        await this.processInstanceRepo.save(instance);
        return await this.executeNextStep(instanceId);
      } else {
        // No else branch, continue to next activity
        activityInstance.status = ActivityStatus.Completed;
        activityInstance.completedAt = new Date();
        
        await this.processInstanceRepo.save(instance);
        return await this.continueExecution(instanceId);
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
    if (!instance) {
      return {
        instanceId,
        status: ProcessStatus.Failed,
        message: 'Process instance not found'
      };
    }

    const activityInstance = instance.activities[activity.id];
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
        throw new Error(`No matching case found for value '${switchValue}' and no default case provided`);
      }
      
      // Set next activity and complete this one
      instance.currentActivity = this.extractActivityId(nextActivity);
      
      activityInstance.status = ActivityStatus.Completed;
      activityInstance.completedAt = new Date();
      activityInstance.data = { 
        expressionValue: switchValue, 
        matchedCase: activity.cases[switchValue] ? switchValue : 'default',
        nextActivity 
      };
      
      await this.processInstanceRepo.save(instance);
      return await this.executeNextStep(instanceId);
    } catch (error) {
      activityInstance.status = ActivityStatus.Failed;
      activityInstance.error = error instanceof Error ? error.message : String(error);
      
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
    if (!instance) {
      return {
        instanceId,
        status: ProcessStatus.Failed,
        message: 'Process instance not found'
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
    if (!instance) {
      logger.error(`ProcessEngine: Instance '${instanceId}' not found during continue execution`);
      return {
        instanceId,
        status: ProcessStatus.Failed,
        message: 'Process instance not found'
      };
    }

    if (!instance.currentActivity) {
      logger.warn(`ProcessEngine: No current activity for instance '${instanceId}', completing process`);
      return await this.completeProcess(instanceId, 'Process completed - no current activity');
    }

    const currentActivityInstance = instance.activities[instance.currentActivity];
    if (!currentActivityInstance) {
      logger.error(`ProcessEngine: Current activity '${instance.currentActivity}' not found in instance '${instanceId}'`);
      return await this.completeProcess(instanceId, 'Current activity not found', false);
    }

    logger.debug(`ProcessEngine: Current activity '${instance.currentActivity}' status: ${currentActivityInstance.status}`);
    
    // Get process definition for sequence and next property handling
    const processDefinition = await this.processDefinitionRepo.findById(instance.processId);
    
    // Check if we're in a sequence and need to continue
    if (processDefinition) {
      for (const [activityId, activityDef] of Object.entries(processDefinition.activities)) {
        if (activityDef.type === ActivityType.Sequence) {
          const sequenceActivity = activityDef as SequenceActivity;
          const sequenceInstance = instance.activities[activityId];
          
          // Check if this sequence contains our current activity and has sequence data
          if (sequenceInstance?.data?.sequenceIndex !== undefined && 
              sequenceActivity.activities.some(a => this.extractActivityId(a) === instance.currentActivity)) {
            
            logger.debug(`ProcessEngine: Found parent sequence '${activityId}' for current activity '${instance.currentActivity}'`);
            const sequenceData = sequenceInstance.data;
            const nextIndex = sequenceData.sequenceIndex + 1;
            
            if (nextIndex < sequenceData.activities.length) {
              // Continue with next activity in sequence
              sequenceData.sequenceIndex = nextIndex;
              const nextActivity = this.extractActivityId(sequenceData.activities[nextIndex]);
              instance.currentActivity = nextActivity;
              
              logger.info(`ProcessEngine: Continuing sequence '${activityId}' - moving to activity '${nextActivity}' (index ${nextIndex})`);
              await this.processInstanceRepo.save(instance);
              return await this.executeNextStep(instanceId);
            } else {
              // Sequence completed
              logger.info(`ProcessEngine: Sequence '${activityId}' completed for instance '${instanceId}'`);
              sequenceInstance.status = ActivityStatus.Completed;
              sequenceInstance.completedAt = new Date();
              await this.processInstanceRepo.save(instance);
              break; // Exit the loop and continue with normal 'next' property handling
            }
          }
        }
      }
    }

    // Check if the current activity has a 'next' property
    if (processDefinition && processDefinition.activities) {
      logger.debug(`ProcessEngine: Looking for 'next' property in activity '${instance.currentActivity}'`);
      const activityDefinition = processDefinition.activities[instance.currentActivity];
      
      if (activityDefinition) {
        logger.debug(`ProcessEngine: Found activity definition`, {
          activityId: activityDefinition.id,
          activityType: activityDefinition.type,
          hasNext: !!(activityDefinition as any).next,
          nextValue: (activityDefinition as any).next
        });
        
        if ((activityDefinition as any).next) {
          const nextActivityRef = (activityDefinition as any).next;
          const nextActivityId = this.extractActivityId(nextActivityRef);
          
          logger.info(`ProcessEngine: Found 'next' property - moving to activity '${nextActivityId}' for instance '${instanceId}'`);
          instance.currentActivity = nextActivityId;
          await this.processInstanceRepo.save(instance);
          return await this.executeNextStep(instanceId);
        } else {
          logger.warn(`ProcessEngine: Activity '${instance.currentActivity}' has no 'next' property - should complete process`);
        }
      } else {
        logger.error(`ProcessEngine: Activity definition not found for '${instance.currentActivity}'`, {
          availableActivities: Object.keys(processDefinition.activities || {})
        });
      }
    } else {
      logger.error(`ProcessEngine: Process definition or activities not found for process '${instance.processId}'`);
    }

    // No next activity found - process completed
    logger.info(`ProcessEngine: No next activity found, completing process for instance '${instanceId}'`);
    return await this.completeProcess(instanceId, 'Process completed successfully');
  }

  private async completeProcess(instanceId: string, reason: string, success: boolean = true): Promise<ProcessExecutionResult> {
    const instance = await this.processInstanceRepo.findById(instanceId);
    if (!instance) {
      return {
        instanceId,
        status: ProcessStatus.Failed,
        message: 'Process instance not found'
      };
    }
    
    instance.status = success ? ProcessStatus.Completed : ProcessStatus.Failed;
    instance.completedAt = new Date();
    instance.currentActivity = undefined;

    await this.processInstanceRepo.save(instance);

    return {
      instanceId,
      status: instance.status,
      message: reason
    };
  }

  private extractActivityId(activityRef: string | undefined): string {
    logger.debug(`ProcessEngine: Extracting activity ID from reference '${activityRef}'`);
    
    if (!activityRef) {
      logger.error('ProcessEngine: Activity reference is undefined or null');
      throw new Error('Activity reference is undefined or null');
    }
    
    // Remove 'a:' prefix if present
    const result = activityRef.startsWith('a:') ? activityRef.substring(2) : activityRef;
    logger.debug(`ProcessEngine: Extracted activity ID '${result}' from '${activityRef}'`);
    return result;
  }

  private initializeVariables(variables: any[]): { [key: string]: any } {
    const result: { [key: string]: any } = {};
    variables.forEach(variable => {
      result[variable.name] = variable.defaultValue;
    });
    return result;
  }

  private initializeActivities(activities: { [key: string]: Activity }): { [key: string]: ActivityInstance } {
    const result: { [key: string]: ActivityInstance } = {};
    
    Object.values(activities).forEach(activity => {
      result[activity.id] = {
        ...activity,
        status: ActivityStatus.Pending
      };
    });
    
    return result;
  }

  // Repository management methods
  async getRunningInstances(): Promise<ProcessInstance[]> {
    return await this.processInstanceRepo.findRunningInstances();
  }

  async getInstancesByProcessId(processId: string): Promise<ProcessInstance[]> {
    return await this.processInstanceRepo.findByProcessId(processId);
  }

  async getInstancesWaitingForHumanTask(): Promise<ProcessInstance[]> {
    return await this.processInstanceRepo.findInstancesWaitingForHumanTask();
  }

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
}