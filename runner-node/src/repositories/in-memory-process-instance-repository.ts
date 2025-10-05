import { ProcessInstance, ProcessStatus } from '../types';
import { ProcessInstanceRepository } from './process-instance-repository';
import { logger } from '../logger';

// using centralized logger

/**
 * In-memory implementation of ProcessInstanceRepository
 * Good for development, testing, and small deployments
 * Stores instances in memory only (not persisted to disk)
 */
export class InMemoryProcessInstanceRepository implements ProcessInstanceRepository {
	private instances = new Map<string, ProcessInstance>();

	constructor() {
		logger.info('Initialized InMemoryProcessInstanceRepository', {
			repositoryType: 'in-memory',
			entityType: 'process-instance',
			initialSize: this.instances.size
		});
	}

	async save(instance: ProcessInstance): Promise<void> {
		const operation = this.instances.has(instance.instanceId) ? 'update' : 'create';


		// Enhanced logging with field values including human task form data
		const variableValues = instance.variables ? Object.entries(instance.variables).reduce((acc, [key, value]) => {
			acc[key] = value;
			return acc;
		}, {} as any) : {};

		const activityStatuses = instance.activities ? Object.entries(instance.activities).reduce((acc, [key, activity]) => {
			acc[key] = {
				type: activity.type,
				status: activity.status,
				startedAt: activity.startedAt,
				completedAt: activity.completedAt,
				// Include error if present
				...(activity.error ? { error: activity.error } : {}),
				// Include pass/fail status
				...(activity.passFail ? { passFail: activity.passFail } : {})
			};
			return acc;
		}, {} as any) : {};

		// Extract all form field values from human activities
		const stepFieldValues: any = {};
		if (instance.activities) {
			Object.entries(instance.activities).forEach(([activityId, activity]) => {
				if (activity.type === 'human' && (activity as any).formData) {
					stepFieldValues[activityId] = (activity as any).formData;
				}
			});
		}

		logger.debug(`Saving process instance`, {
			operation,
			instanceId: instance.instanceId,
			processId: instance.processId,
			status: instance.status,
			currentActivity: instance.currentActivity || null,
			variablesCount: instance.variables ? Object.keys(instance.variables).length : 0,
			activitiesCount: instance.activities ? Object.keys(instance.activities).length : 0,
			startedAt: instance.startedAt,
			completedAt: instance.completedAt,
			processVariables: variableValues,
			stepFieldValues: stepFieldValues,
			activityStatuses
		});

		this.instances.set(instance.instanceId, { ...instance });

		logger.info(`Process instance ${operation}d successfully`, {
			instanceId: instance.instanceId,
			processId: instance.processId,
			status: instance.status,
			currentActivity: instance.currentActivity || null,
			totalInstances: this.instances.size
		});
	}

	async findById(instanceId: string): Promise<ProcessInstance | null> {
		logger.debug(`Looking up process instance by ID: '${instanceId}'`);

		const instance = this.instances.get(instanceId);
		const result = instance ? { ...instance } : null;

		if (result) {
			logger.debug(`Found process instance`, {
				instanceId: result.instanceId,
				processId: result.processId,
				status: result.status,
				currentActivity: result.currentActivity
			});
		} else {
			logger.warn(`Process instance not found for ID: '${instanceId}'`, {
				availableInstanceIds: Array.from(this.instances.keys()).slice(0, 10) // Limit output for readability
			});
		}

		return result;
	}

	async findAll(): Promise<ProcessInstance[]> {
		logger.debug('Retrieving all process instances');

		const result = Array.from(this.instances.values()).map(instance => ({ ...instance }));

		logger.info(`Retrieved ${result.length} process instances`, {
			statuses: result.reduce((acc: any, inst) => {
				acc[inst.status] = (acc[inst.status] || 0) + 1;
				return acc;
			}, {}),
			totalStored: this.instances.size
		});

		return result;
	}

	async delete(instanceId: string): Promise<boolean> {
		logger.debug(`Attempting to delete process instance: '${instanceId}'`);

		const existed = this.instances.has(instanceId);
		const deleted = this.instances.delete(instanceId);

		if (deleted) {
			logger.info(`Process instance deleted successfully`, {
				instanceId,
				remainingInstances: this.instances.size
			});
		} else {
			logger.warn(`Failed to delete process instance - not found`, {
				instanceId,
				availableInstanceIds: Array.from(this.instances.keys()).slice(0, 10)
			});
		}

		return deleted;
	}

	async exists(instanceId: string): Promise<boolean> {
		return this.instances.has(instanceId);
	}

	async findByStatus(status: ProcessStatus): Promise<ProcessInstance[]> {
		const result: ProcessInstance[] = [];

		for (const instance of this.instances.values()) {
			if (instance.status === status) {
				result.push({ ...instance });
			}
		}

		return result;
	}

	async findRunningInstances(): Promise<ProcessInstance[]> {
		return this.findByStatus(ProcessStatus.Running);
	}

	async findCompletedInstances(): Promise<ProcessInstance[]> {
		return this.findByStatus(ProcessStatus.Completed);
	}

	async findFailedInstances(): Promise<ProcessInstance[]> {
		return this.findByStatus(ProcessStatus.Failed);
	}

	async findByProcessId(processId: string): Promise<ProcessInstance[]> {
		const result: ProcessInstance[] = [];

		for (const instance of this.instances.values()) {
			if (instance.processId === processId) {
				result.push({ ...instance });
			}
		}

		return result;
	}

	async findByProcessIdAndStatus(processId: string, status: ProcessStatus): Promise<ProcessInstance[]> {
		const result: ProcessInstance[] = [];

		for (const instance of this.instances.values()) {
			if (instance.processId === processId && instance.status === status) {
				result.push({ ...instance });
			}
		}

		return result;
	}

	async findByDateRange(startDate: Date, endDate: Date): Promise<ProcessInstance[]> {
		const result: ProcessInstance[] = [];

		for (const instance of this.instances.values()) {
			if (instance.startedAt >= startDate && instance.startedAt <= endDate) {
				result.push({ ...instance });
			}
		}

		return result;
	}

	async findActiveInstancesOlderThan(date: Date): Promise<ProcessInstance[]> {
		const result: ProcessInstance[] = [];

		for (const instance of this.instances.values()) {
			if (instance.status === ProcessStatus.Running && instance.startedAt < date) {
				result.push({ ...instance });
			}
		}

		return result;
	}

	async findInstancesWaitingForHumanTask(): Promise<ProcessInstance[]> {
		const result: ProcessInstance[] = [];

		for (const instance of this.instances.values()) {
			if (instance.status === ProcessStatus.Running && instance.currentActivity) {
				const currentActivity = instance.activities[instance.currentActivity];
				if (currentActivity?.type === 'human' && currentActivity?.status === 'running') {
					result.push({ ...instance });
				}
			}
		}

		return result;
	}

	async findInstancesByCurrentActivity(activityId: string): Promise<ProcessInstance[]> {
		const result: ProcessInstance[] = [];

		for (const instance of this.instances.values()) {
			if (instance.currentActivity === activityId) {
				result.push({ ...instance });
			}
		}

		return result;
	}

	async count(): Promise<number> {
		return this.instances.size;
	}

	async countByStatus(status: ProcessStatus): Promise<number> {
		let count = 0;

		for (const instance of this.instances.values()) {
			if (instance.status === status) {
				count++;
			}
		}

		return count;
	}

	async countByProcessId(processId: string): Promise<number> {
		let count = 0;

		for (const instance of this.instances.values()) {
			if (instance.processId === processId) {
				count++;
			}
		}

		return count;
	}

	async getAverageExecutionTime(processId?: string): Promise<number> {
		const completedInstances: ProcessInstance[] = [];

		for (const instance of this.instances.values()) {
			if (instance.status === ProcessStatus.Completed &&
				instance.completedAt &&
				(!processId || instance.processId === processId)) {
				completedInstances.push(instance);
			}
		}

		if (completedInstances.length === 0) {
			return 0;
		}

		const totalTime = completedInstances.reduce((sum, instance) => {
			const duration = instance.completedAt!.getTime() - instance.startedAt.getTime();
			return sum + duration;
		}, 0);

		return totalTime / completedInstances.length;
	}

	async deleteCompletedOlderThan(date: Date): Promise<number> {
		let deletedCount = 0;
		const toDelete: string[] = [];

		for (const [instanceId, instance] of this.instances.entries()) {
			if (instance.status === ProcessStatus.Completed &&
				instance.completedAt &&
				instance.completedAt < date) {
				toDelete.push(instanceId);
			}
		}

		toDelete.forEach(instanceId => {
			this.instances.delete(instanceId);
			deletedCount++;
		});

		return deletedCount;
	}

	async clear(): Promise<void> {
		this.instances.clear();
	}
}