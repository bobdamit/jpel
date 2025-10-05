import { ProcessDefinition, ProcessTemplateFlyweight } from '../types';
import { ProcessDefinitionRepository } from './process-definition-repository';
import fs from 'fs';
import path from 'path';
import { logger } from '../logger';

// using centralized logger

/**
 * In-memory implementation of ProcessDefinitionRepository
 * Good for development, testing, and small deployments
 */
export class InMemoryProcessDefinitionRepository implements ProcessDefinitionRepository {
	private processes = new Map<string, ProcessDefinition>();
	private samplesDir: string;

	constructor() {
		this.samplesDir = path.join(process.cwd(), 'samples');
		logger.info('Initializing in-memory process definition repository');
	}

	/**
	 * List available process templates without loading them into memory
	 */
	async listAvailableTemplates(): Promise<ProcessTemplateFlyweight[]> {
		try {
			// Check if samples directory exists
			if (!fs.existsSync(this.samplesDir)) {
				logger.warn('Samples directory not found', { samplesDir: this.samplesDir });
				return [];
			}

			// Read all .json files from the samples directory
			const files = fs.readdirSync(this.samplesDir)
				.filter((file: string) => file.endsWith('.json'))
				.map((file: string) => path.join(this.samplesDir, file));

			const templates: ProcessTemplateFlyweight[] = [];

			// Load just the metadata from each file (flyweight pattern)
			for (const filePath of files) {
				try {
					const fileContent = fs.readFileSync(filePath, 'utf8');
					const processDefinition: ProcessDefinition = JSON.parse(fileContent);

					// Validate basic structure
					if (!processDefinition.id || !processDefinition.name) {
						logger.warn('Skipping invalid process definition (missing id or name)', { filePath });
						continue;
					}

					// Create flyweight with just essential metadata
					templates.push({
						id: processDefinition.id,
						name: processDefinition.name,
						description: processDefinition.description,
						version: processDefinition.version
					});

				} catch (error) {
					logger.error('Failed to read process template metadata', {
						filePath,
						error: error instanceof Error ? error.message : String(error)
					});
				}
			}

			logger.info(`Found ${templates.length} available process templates`);
			return templates;

		} catch (error) {
			logger.error('Failed to list available templates', {
				error: error instanceof Error ? error.message : String(error)
			});
			return [];
		}
	}

	/**
	 * Find the file path for a process ID by scanning the samples directory
	 */
	private async findFilePathForProcess(processId: string): Promise<string | null> {
		try {
			if (!fs.existsSync(this.samplesDir)) {
				return null;
			}

			const files = fs.readdirSync(this.samplesDir)
				.filter((file: string) => file.endsWith('.json'))
				.map((file: string) => path.join(this.samplesDir, file));

			// Find the file that contains this process ID
			for (const filePath of files) {
				try {
					const fileContent = fs.readFileSync(filePath, 'utf8');
					const processDefinition: ProcessDefinition = JSON.parse(fileContent);

					if (processDefinition.id === processId) {
						return filePath;
					}
				} catch (error) {
					// Skip files that can't be parsed
					continue;
				}
			}

			return null;
		} catch (error) {
			logger.error('Failed to find file path for process', {
				processId,
				error: error instanceof Error ? error.message : String(error)
			});
			return null;
		}
	}

	/**
	 * Load a process definition from file on-demand
	 */
	private async loadProcessFromFile(filePath: string): Promise<ProcessDefinition | null> {
		try {
			const fileContent = fs.readFileSync(filePath, 'utf8');
			const processDefinition: ProcessDefinition = JSON.parse(fileContent);

			// Validate basic structure
			if (!processDefinition.id || !processDefinition.name) {
				logger.warn('Invalid process definition loaded from file', { filePath });
				return null;
			}

			// No normalization here - ProcessEngine will normalize after loading from repo

			return processDefinition;
		} catch (error) {
			logger.error('Failed to load process from file', {
				filePath,
				error: error instanceof Error ? error.message : String(error)
			});
			return null;
		}
	}

	async save(processDefinition: ProcessDefinition): Promise<void> {
		logger.info(`Saving process definition`, {
			id: processDefinition.id,
			name: processDefinition.name,
			version: processDefinition.version,
			activitiesCount: Object.keys(processDefinition.activities || {}).length
		});

		// Create a versioned key if version is specified
		const key = processDefinition.version
			? `${processDefinition.id}:${processDefinition.version}`
			: processDefinition.id;

		const existedBefore = this.processes.has(key);
		this.processes.set(key, { ...processDefinition });

		// Also store as latest version without version suffix
		this.processes.set(processDefinition.id, { ...processDefinition });

		logger.debug(`Process definition stored with keys: ['${key}', '${processDefinition.id}']`, {
			operation: existedBefore ? 'update' : 'create',
			totalProcesses: this.processes.size
		});
	}

	async findById(processId: string): Promise<ProcessDefinition | null> {
		logger.debug(`Looking up process definition by ID: '${processId}'`);

		// First check if it's already loaded in memory
		let result = this.processes.get(processId) || null;

		if (!result) {
			// Try to find a template with this ID and load it on-demand
			const templates = await this.listAvailableTemplates();
			const template = templates.find(t => t.id === processId);

			if (template) {
				const filePath = await this.findFilePathForProcess(processId);
				if (filePath) {
					logger.debug(`Loading process definition from file on-demand`, { processId, filePath });
					result = await this.loadProcessFromFile(filePath);

					if (result) {
						// Cache it in memory for future use
						await this.save(result);
					}
				}
			}
		}

		if (result) {
			logger.debug(`Found process definition`, {
				id: result.id,
				name: result.name,
				version: result.version
			});
		} else {
			logger.warn(`Process definition not found for ID: '${processId}'`);
		}

		return result;
	}

	async findAll(): Promise<ProcessDefinition[]> {
		logger.debug('Retrieving all process definitions');

		// Get all available templates first
		const templates = await this.listAvailableTemplates();

		// Load any that aren't already in memory
		for (const template of templates) {
			if (!this.processes.has(template.id)) {
				const filePath = await this.findFilePathForProcess(template.id);
				if (filePath) {
					const process = await this.loadProcessFromFile(filePath);
					if (process) {
						await this.save(process);
					}
				}
			}
		}

		// Return only the latest versions (without version suffix in key)
		const result: ProcessDefinition[] = [];
		const seen = new Set<string>();

		for (const [key, process] of this.processes.entries()) {
			if (!key.includes(':') && !seen.has(process.id)) {
				result.push({ ...process });
				seen.add(process.id);
			}
		}

		logger.info(`Retrieved ${result.length} process definitions`, {
			processIds: result.map(p => p.id),
			totalStoredKeys: this.processes.size
		});

		return result;
	}

	async delete(processId: string): Promise<boolean> {
		const existed = this.processes.has(processId);

		// Delete all versions of this process
		const keysToDelete: string[] = [];
		for (const key of this.processes.keys()) {
			if (key === processId || key.startsWith(`${processId}:`)) {
				keysToDelete.push(key);
			}
		}

		keysToDelete.forEach(key => this.processes.delete(key));

		return existed;
	}

	async exists(processId: string): Promise<boolean> {
		// Check if it's in memory first
		if (this.processes.has(processId)) {
			return true;
		}

		// Check if it exists as a template
		const templates = await this.listAvailableTemplates();
		return templates.some(t => t.id === processId);
	}

	async findByName(name: string): Promise<ProcessDefinition[]> {
		// First ensure all processes are loaded
		await this.findAll();

		const result: ProcessDefinition[] = [];

		for (const process of this.processes.values()) {
			if (process.name.toLowerCase().includes(name.toLowerCase())) {
				result.push({ ...process });
			}
		}

		return result;
	}

	async findByVersion(processId: string, version: string): Promise<ProcessDefinition | null> {
		const key = `${processId}:${version}`;
		return this.processes.get(key) || null;
	}

	async findAllVersions(processId: string): Promise<ProcessDefinition[]> {
		// First ensure the process is loaded
		await this.findById(processId);

		const result: ProcessDefinition[] = [];

		for (const [key, process] of this.processes.entries()) {
			if (key === processId || key.startsWith(`${processId}:`)) {
				result.push({ ...process });
			}
		}

		// Sort by version (latest first)
		return result.sort((a, b) => {
			const versionA = a.version || '0.0.0';
			const versionB = b.version || '0.0.0';
			return versionB.localeCompare(versionA);
		});
	}

	async findLatestVersion(processId: string): Promise<ProcessDefinition | null> {
		const versions = await this.findAllVersions(processId);
		return versions.length > 0 ? versions[0] : null;
	}

	async count(): Promise<number> {
		const templates = await this.listAvailableTemplates();
		return templates.length;
	}

	async clear(): Promise<void> {
		this.processes.clear();
	}
}