import { ProcessDefinition, ProcessTemplateFlyweight } from '../models/process-types';

/**
 * Repository interface for process definitions
 * Supports CRUD operations and querying
 */
export interface ProcessDefinitionRepository {
	// Basic CRUD operations
	save(processDefinition: ProcessDefinition): Promise<void>;
	findById(processId: string): Promise<ProcessDefinition | null>;
	findAll(): Promise<ProcessDefinition[]>;
	delete(processId: string): Promise<boolean>;
	exists(processId: string): Promise<boolean>;

	// Advanced querying
	findByName(name: string): Promise<ProcessDefinition[]>;
	findByVersion(processId: string, version: string): Promise<ProcessDefinition | null>;
	findAllVersions(processId: string): Promise<ProcessDefinition[]>;
	findLatestVersion(processId: string): Promise<ProcessDefinition | null>;

	// Metadata operations
	count(): Promise<number>;
	clear(): Promise<void>;

	// Template listing (flyweight pattern)
	listAvailableTemplates(): Promise<ProcessTemplateFlyweight[]>;
}