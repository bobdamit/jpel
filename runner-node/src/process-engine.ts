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
  TerminateActivity,
  ProcessExecutionResult,
  HumanTaskData
} from './types';
import { ExpressionEvaluator } from './expression-evaluator';
import { APIExecutor } from './api-executor';

export class ProcessEngine {
  private processes: Map<string, ProcessDefinition> = new Map();
  private instances: Map<string, ProcessInstance> = new Map();
  private expressionEvaluator: ExpressionEvaluator;
  private apiExecutor: APIExecutor;

  constructor() {
    this.expressionEvaluator = new ExpressionEvaluator();
    this.apiExecutor = new APIExecutor();
  }

  // Load a process definition
  loadProcess(processDefinition: ProcessDefinition): void {
    this.processes.set(processDefinition.id, processDefinition);
  }

  // Get all loaded processes
  getProcesses(): ProcessDefinition[] {
    return Array.from(this.processes.values());
  }

  // Get a specific process definition
  getProcess(processId: string): ProcessDefinition | undefined {
    return this.processes.get(processId);
  }

  // Create a new process instance
  async createInstance(processId: string): Promise<ProcessExecutionResult> {
    const processDefinition = this.processes.get(processId);
    if (!processDefinition) {
      return {
        instanceId: '',
        status: ProcessStatus.Failed,
        message: `Process definition '${processId}' not found`
      };
    }

    const instanceId = uuidv4();
    const instance: ProcessInstance = {
      instanceId,
      processId,
      status: ProcessStatus.Running,
      startedAt: new Date(),
      currentActivity: this.extractActivityId(processDefinition.start),
      variables: this.initializeVariables(processDefinition.variables || []),
      activities: this.initializeActivities(processDefinition.activities)
    };

    this.instances.set(instanceId, instance);
    return await this.executeNextStep(instanceId);
  }

  // Get process instance
  getInstance(instanceId: string): ProcessInstance | undefined {
    return this.instances.get(instanceId);
  }

  // Execute the next step in a process instance
  async executeNextStep(instanceId: string): Promise<ProcessExecutionResult> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      return {
        instanceId,
        status: ProcessStatus.Failed,
        message: 'Process instance not found'
      };
    }

    if (instance.status !== ProcessStatus.Running) {
      return {
        instanceId,
        status: instance.status,
        message: `Process is ${instance.status}`
      };
    }

    if (!instance.currentActivity) {
      return this.completeProcess(instanceId, 'No current activity');
    }

    const processDefinition = this.processes.get(instance.processId);
    if (!processDefinition) {
      return {
        instanceId,
        status: ProcessStatus.Failed,
        message: 'Process definition not found'
      };
    }

    const activity = processDefinition.activities[instance.currentActivity];
    if (!activity) {
      return {
        instanceId,
        status: ProcessStatus.Failed,
        message: `Activity '${instance.currentActivity}' not found`
      };
    }

    return await this.executeActivity(instanceId, activity);
  }

  // Submit data for a human task
  async submitHumanTask(instanceId: string, activityId: string, data: any, files?: any[]): Promise<ProcessExecutionResult> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      return {
        instanceId,
        status: ProcessStatus.Failed,
        message: 'Process instance not found'
      };
    }

    const activityInstance = instance.activities[activityId];
    if (!activityInstance || activityInstance.status !== ActivityStatus.Running) {
      return {
        instanceId,
        status: ProcessStatus.Failed,
        message: 'Activity not found or not waiting for input'
      };
    }

    // Store the submitted data
    activityInstance.data = activityInstance.data || {};
    Object.assign(activityInstance.data, data);
    if (files) {
      activityInstance.data._files = files;
    }
    
    // Complete the human task
    activityInstance.status = ActivityStatus.Completed;
    activityInstance.completedAt = new Date();

    // Continue execution
    return await this.continueExecution(instanceId);
  }

  private async executeActivity(instanceId: string, activity: Activity): Promise<ProcessExecutionResult> {
    const instance = this.instances.get(instanceId)!;
    const activityInstance = instance.activities[activity.id];

    // Mark activity as running
    activityInstance.status = ActivityStatus.Running;
    activityInstance.startedAt = new Date();

    try {
      switch (activity.type) {
        case ActivityType.Human:
          return this.executeHumanActivity(instanceId, activity as HumanActivity);
        
        case ActivityType.Compute:
          return await this.executeComputeActivity(instanceId, activity as ComputeActivity);
        
        case ActivityType.API:
          return await this.executeAPIActivity(instanceId, activity as APIActivity);
        
        case ActivityType.Sequence:
          return await this.executeSequenceActivity(instanceId, activity as SequenceActivity);
        
        case ActivityType.Parallel:
          return await this.executeParallelActivity(instanceId, activity as ParallelActivity);
        
        case ActivityType.Branch:
          return await this.executeBranchActivity(instanceId, activity as BranchActivity);
        
        case ActivityType.Terminate:
          return this.executeTerminateActivity(instanceId, activity as TerminateActivity);
        
        default:
          throw new Error(`Unknown activity type: ${activity.type}`);
      }
    } catch (error) {
      activityInstance.status = ActivityStatus.Failed;
      activityInstance.error = error instanceof Error ? error.message : String(error);
      
      return {
        instanceId,
        status: ProcessStatus.Failed,
        message: `Activity '${activity.id}' failed: ${activityInstance.error}`
      };
    }
  }

  private executeHumanActivity(instanceId: string, activity: HumanActivity): ProcessExecutionResult {
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
    const instance = this.instances.get(instanceId)!;
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

      return this.continueExecution(instanceId);
    } catch (error) {
      activityInstance.status = ActivityStatus.Failed;
      activityInstance.error = error instanceof Error ? error.message : String(error);
      
      return {
        instanceId,
        status: ProcessStatus.Failed,
        message: `Compute activity failed: ${activityInstance.error}`
      };
    }
  }

  private async executeAPIActivity(instanceId: string, activity: APIActivity): Promise<ProcessExecutionResult> {
    const instance = this.instances.get(instanceId)!;
    const activityInstance = instance.activities[activity.id];

    try {
      const response = await this.apiExecutor.execute(activity, instance);
      
      activityInstance.data = response;
      activityInstance.status = ActivityStatus.Completed;
      activityInstance.completedAt = new Date();

      return this.continueExecution(instanceId);
    } catch (error) {
      activityInstance.status = ActivityStatus.Failed;
      activityInstance.error = error instanceof Error ? error.message : String(error);
      
      return {
        instanceId,
        status: ProcessStatus.Failed,
        message: `API activity failed: ${activityInstance.error}`
      };
    }
  }

  private async executeSequenceActivity(instanceId: string, activity: SequenceActivity): Promise<ProcessExecutionResult> {
    const instance = this.instances.get(instanceId)!;
    
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
      
      return this.executeNextStep(instanceId);
    } else {
      // Empty sequence completes immediately
      const activityInstance = instance.activities[activity.id];
      activityInstance.status = ActivityStatus.Completed;
      activityInstance.completedAt = new Date();
      
      return this.continueExecution(instanceId);
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
    const instance = this.instances.get(instanceId)!;
    const activityInstance = instance.activities[activity.id];

    try {
      const conditionResult = this.expressionEvaluator.evaluateCondition(activity.condition, instance);
      
      const nextActivity = conditionResult ? activity.then : activity.else;
      if (nextActivity) {
        instance.currentActivity = this.extractActivityId(nextActivity);
        
        activityInstance.status = ActivityStatus.Completed;
        activityInstance.completedAt = new Date();
        activityInstance.data = { conditionResult, nextActivity };
        
        return await this.executeNextStep(instanceId);
      } else {
        // No else branch, continue to next activity
        activityInstance.status = ActivityStatus.Completed;
        activityInstance.completedAt = new Date();
        
        return await this.continueExecution(instanceId);
      }
    } catch (error) {
      activityInstance.status = ActivityStatus.Failed;
      activityInstance.error = error instanceof Error ? error.message : String(error);
      
      return {
        instanceId,
        status: ProcessStatus.Failed,
        message: `Branch condition evaluation failed: ${activityInstance.error}`
      };
    }
  }

  private executeTerminateActivity(instanceId: string, activity: TerminateActivity): ProcessExecutionResult {
    const instance = this.instances.get(instanceId)!;
    const activityInstance = instance.activities[activity.id];

    activityInstance.status = ActivityStatus.Completed;
    activityInstance.completedAt = new Date();

    const success = activity.result !== 'failure';
    return this.completeProcess(instanceId, activity.reason || 'Process terminated', success);
  }

  private async continueExecution(instanceId: string): Promise<ProcessExecutionResult> {
    const instance = this.instances.get(instanceId)!;
    
    // Check if we're in a sequence and need to continue
    const currentActivityInstance = instance.currentActivity ? 
      instance.activities[instance.currentActivity] : null;
    
    if (currentActivityInstance?.data?.sequenceIndex !== undefined) {
      const sequenceData = currentActivityInstance.data;
      const nextIndex = sequenceData.sequenceIndex + 1;
      
      if (nextIndex < sequenceData.activities.length) {
        // Continue with next activity in sequence
        sequenceData.sequenceIndex = nextIndex;
        const nextActivity = this.extractActivityId(sequenceData.activities[nextIndex]);
        instance.currentActivity = nextActivity;
        
        return await this.executeNextStep(instanceId);
      } else {
        // Sequence completed
        currentActivityInstance.status = ActivityStatus.Completed;
        currentActivityInstance.completedAt = new Date();
      }
    }

    // Process completed
    return this.completeProcess(instanceId, 'Process completed successfully');
  }

  private completeProcess(instanceId: string, reason: string, success: boolean = true): ProcessExecutionResult {
    const instance = this.instances.get(instanceId)!;
    
    instance.status = success ? ProcessStatus.Completed : ProcessStatus.Failed;
    instance.completedAt = new Date();
    instance.currentActivity = undefined;

    return {
      instanceId,
      status: instance.status,
      message: reason
    };
  }

  private extractActivityId(activityRef: string): string {
    // Remove 'a:' prefix if present
    return activityRef.startsWith('a:') ? activityRef.substring(2) : activityRef;
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
}