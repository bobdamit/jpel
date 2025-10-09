import { ProcessInstance, ProcessInstanceFlyweight } from '@/models/instance-types';
import { ProcessStatus } from '../models/process-types';

/**
 * Repository interface for process runtime instances
 * Supports CRUD operations, querying, and performance monitoring
 */
export interface ProcessInstanceRepository {
	// Basic CRUD operations
	save(instance: ProcessInstance): Promise<void>;
	findById(instanceId: string): Promise<ProcessInstance | null>;
	findAll(): Promise<ProcessInstance[]>;
	delete(instanceId: string): Promise<boolean>;
	exists(instanceId: string): Promise<boolean>;

	// Query by status
	findByStatus(status: ProcessStatus): Promise<ProcessInstance[]>;
	findRunningInstances(): Promise<ProcessInstance[]>;
	findCompletedInstances(): Promise<ProcessInstance[]>;
	findFailedInstances(): Promise<ProcessInstance[]>;

	// Query by process definition
	findByProcessId(processId: string): Promise<ProcessInstanceFlyweight[]>;
	findByProcessIdAndStatus(processId: string, status: ProcessStatus): Promise<ProcessInstance[]>;

	// Time-based queries
	findByDateRange(startDate: Date, endDate: Date): Promise<ProcessInstance[]>;
	findActiveInstancesOlderThan(date: Date): Promise<ProcessInstance[]>;

	// Activity-specific queries
	findInstancesWaitingForHumanTask(): Promise<ProcessInstance[]>;
	findInstancesByCurrentActivity(activityId: string): Promise<ProcessInstance[]>;

	// Performance and monitoring
	count(): Promise<number>;
	countByStatus(status: ProcessStatus): Promise<number>;
	countByProcessId(processId: string): Promise<number>;
	getAverageExecutionTime(processId?: string): Promise<number>;

	// Cleanup operations
	deleteCompletedOlderThan(date: Date): Promise<number>;
	clear(): Promise<void>;
}