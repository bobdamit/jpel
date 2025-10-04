import { ProcessDefinition } from '../types';
import { ProcessDefinitionRepository } from './process-definition-repository';

// Logger setup
const logger = {
  info: (message: string, data?: any) => console.log(`[INFO] ${new Date().toISOString()} - ProcessDefinitionRepo: ${message}`, data || ''),
  warn: (message: string, data?: any) => console.warn(`[WARN] ${new Date().toISOString()} - ProcessDefinitionRepo: ${message}`, data || ''),
  error: (message: string, data?: any) => console.error(`[ERROR] ${new Date().toISOString()} - ProcessDefinitionRepo: ${message}`, data || ''),
  debug: (message: string, data?: any) => console.log(`[DEBUG] ${new Date().toISOString()} - ProcessDefinitionRepo: ${message}`, data || '')
};

/**
 * In-memory implementation of ProcessDefinitionRepository
 * Good for development, testing, and small deployments
 */
export class InMemoryProcessDefinitionRepository implements ProcessDefinitionRepository {
  private processes = new Map<string, ProcessDefinition>();

  constructor() {
    logger.info('Initializing in-memory process definition repository');
    this.loadSampleProcesses();
  }

  /**
   * Load all process JSON files from the /samples directory
   */
  private async loadSampleProcesses(): Promise<void> {
    try {
      const fs = require('fs');
      const path = require('path');
      
      // Get the samples directory path (relative to the project root)
      const samplesDir = path.join(process.cwd(), 'samples');
      
      logger.debug('Loading sample processes from directory', { samplesDir });
      
      // Check if samples directory exists
      if (!fs.existsSync(samplesDir)) {
        logger.warn('Samples directory not found, skipping sample process loading', { samplesDir });
        return;
      }
      
      // Read all .json files from the samples directory
      const files = fs.readdirSync(samplesDir)
        .filter((file: string) => file.endsWith('.json'))
        .map((file: string) => path.join(samplesDir, file));
      
      logger.info(`Found ${files.length} sample process files`);
      
      // Load each process file
      for (const filePath of files) {
        try {
          const fileContent = fs.readFileSync(filePath, 'utf8');
          const processDefinition: ProcessDefinition = JSON.parse(fileContent);
          
          // Validate basic structure
          if (!processDefinition.id || !processDefinition.name) {
            logger.warn('Skipping invalid process definition (missing id or name)', { filePath });
            continue;
          }
          
          // Save the process
          await this.save(processDefinition);
          logger.info('Loaded sample process', {
            id: processDefinition.id,
            name: processDefinition.name,
            file: path.basename(filePath)
          });
          
        } catch (error) {
          logger.error('Failed to load sample process file', {
            filePath,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
      
      logger.info('Sample process loading completed', { totalLoaded: this.processes.size });
      
    } catch (error) {
      logger.error('Failed to load sample processes', {
        error: error instanceof Error ? error.message : String(error)
      });
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
    
    const result = this.processes.get(processId) || null;
    
    if (result) {
      logger.debug(`Found process definition`, {
        id: result.id,
        name: result.name,
        version: result.version
      });
    } else {
      logger.warn(`Process definition not found for ID: '${processId}'`, {
        availableKeys: Array.from(this.processes.keys())
      });
    }
    
    return result;
  }

  async findAll(): Promise<ProcessDefinition[]> {
    logger.debug('Retrieving all process definitions');
    
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
    return this.processes.has(processId);
  }

  async findByName(name: string): Promise<ProcessDefinition[]> {
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
    // Count only unique process IDs (not versions)
    const uniqueIds = new Set<string>();
    for (const [key] of this.processes.entries()) {
      if (!key.includes(':')) {
        uniqueIds.add(key);
      }
    }
    return uniqueIds.size;
  }

  async clear(): Promise<void> {
    this.processes.clear();
  }
}