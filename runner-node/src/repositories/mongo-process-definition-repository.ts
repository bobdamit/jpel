import { ProcessDefinition, ProcessTemplateFlyweight } from '../models/process-types';
import { ProcessDefinitionRepository } from './process-definition-repository';
import { logger } from '../logger';

/**
 * MongoDB implementation of ProcessDefinitionRepository
 * Requires MongoDB connection and mongoose/mongodb driver
 * 
 * Example usage:
 * const mongoRepo = new MongoProcessDefinitionRepository(mongoConnection);
 */
export class MongoProcessDefinitionRepository implements ProcessDefinitionRepository {
	private collection: any; // MongoDB collection - would be properly typed with MongoDB driver

	constructor(database: any, collectionName: string = 'processDefinitions') {
		logger.info('Initializing MongoProcessDefinitionRepository', {
			repositoryType: 'mongodb',
			entityType: 'process-definition',
			collectionName,
			databaseConnected: !!database
		});

		this.collection = database.collection(collectionName);

		// Create indexes for better performance
		this.createIndexes();
	}

	private async createIndexes(): Promise<void> {
		try {
			logger.debug('Creating MongoDB indexes for process definitions');

			await this.collection.createIndex({ id: 1 }, { unique: true });
			await this.collection.createIndex({ name: 1 });
			await this.collection.createIndex({ 'id': 1, 'version': 1 }, { unique: true });
			await this.collection.createIndex({ createdAt: -1 });

			logger.info('MongoDB indexes created successfully', {
				indexes: ['id', 'name', 'id+version', 'createdAt']
			});
		} catch (error) {
			logger.warn('Failed to create MongoDB indexes', {
				error: error instanceof Error ? error.message : String(error)
			});
		}
	}

	async save(processDefinition: ProcessDefinition): Promise<void> {
		logger.debug(`Saving process definition to MongoDB`, {
			id: processDefinition.id,
			name: processDefinition.name,
			version: processDefinition.version,
			activitiesCount: processDefinition.activities ? Object.keys(processDefinition.activities).length : 0,
			variablesCount: processDefinition.variables ? processDefinition.variables.length : 0
		});

		const document = {
			...processDefinition,
			createdAt: new Date(),
			updatedAt: new Date()
		};

		try {
			const result = await this.collection.replaceOne(
				{
					id: processDefinition.id,
					version: processDefinition.version || null
				},
				document,
				{ upsert: true }
			);

			logger.info(`Process definition saved to MongoDB`, {
				id: processDefinition.id,
				name: processDefinition.name,
				version: processDefinition.version,
				operation: result.upsertedId ? 'created' : 'updated',
				matchedCount: result.matchedCount,
				modifiedCount: result.modifiedCount
			});
		} catch (error) {
			logger.error(`Failed to save process definition to MongoDB`, {
				id: processDefinition.id,
				error: error instanceof Error ? error.message : String(error)
			});
			throw error;
		}
	}

	/**
	 * List available process templates without loading them into memory
	 */
	async listAvailableTemplates(): Promise<ProcessTemplateFlyweight[]> {
		try {
			logger.debug('Listing available process templates from MongoDB');

			// Group by process ID and get the latest version for each
			const pipeline = [
				{
					$group: {
						_id: '$id',
						latestDoc: { $first: '$$ROOT' },
						versions: { $push: '$version' }
					}
				},
				{
					$replaceRoot: { newRoot: '$latestDoc' }
				}
			];

			const results = await this.collection.aggregate(pipeline).toArray();

			const templates: ProcessTemplateFlyweight[] = results.map((doc: any) => ({
				id: doc.id,
				name: doc.name,
				description: doc.description,
				version: doc.version
			}));

			logger.info(`Found ${templates.length} available process templates in MongoDB`);
			return templates;

		} catch (error) {
			logger.error('Failed to list available templates from MongoDB', {
				error: error instanceof Error ? error.message : String(error)
			});
			return [];
		}
	}

	async findById(processId: string): Promise<ProcessDefinition | null> {
		logger.debug(`Looking up process definition in MongoDB by ID: '${processId}'`);

		try {
			const document = await this.collection.findOne(
				{ id: processId },
				{ sort: { version: -1 } } // Get latest version
			);

			const result = document ? this.documentToProcessDefinition(document) : null;

			if (result) {
				logger.debug(`Found process definition in MongoDB`, {
					id: result.id,
					name: result.name,
					version: result.version
				});
			} else {
				logger.warn(`Process definition not found in MongoDB for ID: '${processId}'`);
			}

			return result;
		} catch (error) {
			logger.error(`Failed to find process definition in MongoDB`, {
				processId,
				error: error instanceof Error ? error.message : String(error)
			});
			throw error;
		}
	}

	async findAll(): Promise<ProcessDefinition[]> {
		logger.debug('Retrieving all process definitions from MongoDB');

		try {
			// Aggregate to get only the latest version of each process
			const documents = await this.collection.aggregate([
				{
					$sort: { id: 1, version: -1 }
				},
				{
					$group: {
						_id: '$id',
						doc: { $first: '$$ROOT' }
					}
				},
				{
					$replaceRoot: { newRoot: '$doc' }
				},
				{
					$sort: { name: 1 }
				}
			]).toArray();

			const result = documents.map((doc: any) => this.documentToProcessDefinition(doc));

			logger.info(`Retrieved ${result.length} process definitions from MongoDB`, {
				processIds: result.map((p: ProcessDefinition) => p.id),
				totalDocuments: documents.length
			});

			return result;
		} catch (error) {
			logger.error(`Failed to retrieve process definitions from MongoDB`, {
				error: error instanceof Error ? error.message : String(error)
			});
			throw error;
		}
	}

	async delete(processId: string): Promise<boolean> {
		const result = await this.collection.deleteMany({ id: processId });
		return result.deletedCount > 0;
	}

	async exists(processId: string): Promise<boolean> {
		const count = await this.collection.countDocuments({ id: processId });
		return count > 0;
	}

	async findByName(name: string): Promise<ProcessDefinition[]> {
		const documents = await this.collection.find({
			name: { $regex: name, $options: 'i' }
		}).toArray();

		return documents.map((doc: any) => this.documentToProcessDefinition(doc));
	}

	async findByVersion(processId: string, version: string): Promise<ProcessDefinition | null> {
		const document = await this.collection.findOne({
			id: processId,
			version: version
		});

		return document ? this.documentToProcessDefinition(document) : null;
	}

	async findAllVersions(processId: string): Promise<ProcessDefinition[]> {
		const documents = await this.collection.find(
			{ id: processId },
			{ sort: { version: -1 } }
		).toArray();

		return documents.map((doc: any) => this.documentToProcessDefinition(doc));
	}

	async findLatestVersion(processId: string): Promise<ProcessDefinition | null> {
		const document = await this.collection.findOne(
			{ id: processId },
			{ sort: { version: -1 } }
		);

		return document ? this.documentToProcessDefinition(document) : null;
	}

	async count(): Promise<number> {
		// Count distinct process IDs
		const distinctIds = await this.collection.distinct('id');
		return distinctIds.length;
	}

	async clear(): Promise<void> {
		await this.collection.deleteMany({});
	}

	private documentToProcessDefinition(document: any): ProcessDefinition {
		const { _id, createdAt, updatedAt, ...processDefinition } = document;
		return processDefinition as ProcessDefinition;
	}
}

/**
 * Example MongoDB connection factory
 */
export class MongoConnectionFactory {
	static async createConnection(connectionString: string): Promise<any> {
		// This would use the actual MongoDB driver
		// const { MongoClient } = require('mongodb');
		// const client = new MongoClient(connectionString);
		// await client.connect();
		// return client.db();

		throw new Error('MongoDB driver not implemented - install mongodb package');
	}
}