import { ProcessDefinitionRepository } from './process-definition-repository';
import { ProcessInstanceRepository } from './process-instance-repository';
import { InMemoryProcessDefinitionRepository } from './in-memory-process-definition-repository';
import { InMemoryProcessInstanceRepository } from './in-memory-process-instance-repository';

// Logger instance for this factory
const logger = {
  info: (message: string, data?: any) => console.log(`[INFO] ${new Date().toISOString()} - RepositoryFactory: ${message}`, data || ''),
  warn: (message: string, data?: any) => console.warn(`[WARN] ${new Date().toISOString()} - RepositoryFactory: ${message}`, data || ''),
  error: (message: string, data?: any) => console.error(`[ERROR] ${new Date().toISOString()} - RepositoryFactory: ${message}`, data || ''),
  debug: (message: string, data?: any) => console.log(`[DEBUG] ${new Date().toISOString()} - RepositoryFactory: ${message}`, data || '')
};

/**
 * Configuration for repository implementations
 */
export interface RepositoryConfig {
  type: 'memory' | 'mongodb' | 'postgresql' | 'custom';
  connectionString?: string;
  options?: { [key: string]: any };
}

/**
 * Factory for creating repository instances
 * Supports different storage backends and easy switching
 */
export class RepositoryFactory {
  private static processDefinitionRepo: ProcessDefinitionRepository | null = null;
  private static processInstanceRepo: ProcessInstanceRepository | null = null;
  private static config: RepositoryConfig | null = null;

  /**
   * Initialize repositories with configuration
   */
  static async initialize(config: RepositoryConfig): Promise<void> {
    logger.info('Initializing repositories', {
      type: config.type,
      hasConnectionString: !!config.connectionString,
      hasOptions: !!config.options
    });

    this.config = config;

    try {
      switch (config.type) {
        case 'memory':
          logger.debug('Creating in-memory repositories');
          this.processDefinitionRepo = new InMemoryProcessDefinitionRepository();
          this.processInstanceRepo = new InMemoryProcessInstanceRepository();
          break;

        case 'mongodb':
          logger.debug('Attempting MongoDB repository initialization');
          if (!config.connectionString) {
            throw new Error('MongoDB connection string is required');
          }
          
          // TODO: Implement MongoDB repositories
          // const mongoDb = await MongoConnectionFactory.createConnection(config.connectionString);
          // this.processDefinitionRepo = new MongoProcessDefinitionRepository(mongoDb);
          // this.processInstanceRepo = new MongoProcessInstanceRepository(mongoDb);
          
          logger.warn('MongoDB implementation not yet available - using in-memory fallback');
          throw new Error('MongoDB implementation not yet available - using in-memory fallback');

        case 'postgresql':
          logger.debug('Attempting PostgreSQL repository initialization');
          if (!config.connectionString) {
            throw new Error('PostgreSQL connection string is required');
          }
          
          // TODO: Implement PostgreSQL repositories
          logger.warn('PostgreSQL implementation not yet available - using in-memory fallback');
          throw new Error('PostgreSQL implementation not yet available - using in-memory fallback');

        case 'custom':
          logger.debug('Using custom repository implementations');
          if (!config.options?.processDefinitionRepo || !config.options?.processInstanceRepo) {
            throw new Error('Custom repository implementations must be provided in options');
          }
          
          this.processDefinitionRepo = config.options.processDefinitionRepo;
          this.processInstanceRepo = config.options.processInstanceRepo;
          break;

        default:
          throw new Error(`Unsupported repository type: ${config.type}`);
      }

      logger.info('Repositories initialized successfully', {
        type: config.type,
        processDefinitionRepo: this.processDefinitionRepo?.constructor.name,
        processInstanceRepo: this.processInstanceRepo?.constructor.name
      });
    } catch (error) {
      logger.error('Failed to initialize repositories', {
        type: config.type,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get the process definition repository instance
   */
  static getProcessDefinitionRepository(): ProcessDefinitionRepository {
    logger.debug('Retrieving process definition repository');
    if (!this.processDefinitionRepo) {
      logger.error('Process definition repository not available - not initialized');
      throw new Error('Repository not initialized. Call RepositoryFactory.initialize() first.');
    }
    return this.processDefinitionRepo;
  }

  /**
   * Get the process instance repository instance
   */
  static getProcessInstanceRepository(): ProcessInstanceRepository {
    logger.debug('Retrieving process instance repository');
    if (!this.processInstanceRepo) {
      logger.error('Process instance repository not available - not initialized');
      throw new Error('Repository not initialized. Call RepositoryFactory.initialize() first.');
    }
    return this.processInstanceRepo;
  }

  /**
   * Get current configuration
   */
  static getConfig(): RepositoryConfig | null {
    return this.config;
  }

  /**
   * Check if repositories are initialized
   */
  static isInitialized(): boolean {
    return this.processDefinitionRepo !== null && this.processInstanceRepo !== null;
  }

  /**
   * Reset repositories (useful for testing)
   */
  static reset(): void {
    logger.info('Resetting repositories');
    this.processDefinitionRepo = null;
    this.processInstanceRepo = null;
    this.config = null;
    logger.debug('Repositories reset completed');
  }

  /**
   * Create repositories with default in-memory implementation
   * Useful for quick setup and testing
   */
  static async initializeInMemory(): Promise<void> {
    logger.info('Initializing in-memory repositories via convenience method');
    await this.initialize({ type: 'memory' });
  }

  /**
   * Create repositories with MongoDB implementation
   */
  static async initializeMongoDB(connectionString: string, options?: any): Promise<void> {
    logger.info('Initializing MongoDB repositories via convenience method', {
      hasConnectionString: !!connectionString,
      hasOptions: !!options
    });
    await this.initialize({
      type: 'mongodb',
      connectionString,
      options
    });
  }

  /**
   * Health check for repositories
   */
  static async healthCheck(): Promise<{ [key: string]: boolean }> {
    logger.debug('Starting repository health check');
    
    const health = {
      processDefinitionRepo: false,
      processInstanceRepo: false
    };

    try {
      if (this.processDefinitionRepo) {
        await this.processDefinitionRepo.count();
        health.processDefinitionRepo = true;
        logger.debug('Process definition repository health check passed');
      } else {
        logger.warn('Process definition repository not initialized for health check');
      }
    } catch (error) {
      logger.error('Process definition repository health check failed', {
        error: error instanceof Error ? error.message : String(error)
      });
    }

    try {
      if (this.processInstanceRepo) {
        await this.processInstanceRepo.count();
        health.processInstanceRepo = true;
        logger.debug('Process instance repository health check passed');
      } else {
        logger.warn('Process instance repository not initialized for health check');
      }
    } catch (error) {
      logger.error('Process instance repository health check failed', {
        error: error instanceof Error ? error.message : String(error)
      });
    }

    logger.info('Repository health check completed', health);
    return health;
  }
}