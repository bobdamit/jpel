/**
 * Data Generator Types
 * 
 * Defines the structure for data generators that can automatically generate
 * values for form fields (serial numbers, random IDs, timestamps, etc.)
 */

/**
 * Available data generation strategies
 */
export type DataGeneratorStrategy = 'serial' | 'random' | 'uuid' | 'timestamp';

/**
 * Scope of the data generator
 * - tenant: Shared across all processes within a tenant
 * - process: Specific to a single process definition
 */
export type DataGeneratorScope = 'tenant' | 'process';

/**
 * Zero padding options for serial numbers
 */
export type ZeroPadding = 'left' | 'right' | 'none';

/**
 * Character sets for random string generation
 */
export type CharacterSet = 'alphanumeric' | 'numeric' | 'alphabetic' | 'hex';

/**
 * Parameters for configuring data generators
 * Different strategies use different parameter subsets
 */
export interface DataGeneratorParams {
	// Serial strategy parameters
	initial?: number;
	increment?: number; // Default: 1
	length?: number;
	zeroPad?: ZeroPadding;
	prefix?: string;
	suffix?: string;
	
	// Random strategy parameters
	characterSet?: CharacterSet;
	
	// Timestamp strategy parameters
	format?: string; // e.g., "YYYYMMDD-HHmmss"
	
	// Common parameter for random/uuid strategies
	// length is reused for random strings
}

/**
 * Data generator definition in a process template
 * This defines HOW values should be generated
 */
export interface DataGenerator {
	id: string;
	name?: string; // Friendly name for UI display
	strategy: DataGeneratorStrategy;
	scope?: DataGeneratorScope; // Default: 'tenant'
	parameters: DataGeneratorParams;
}

/**
 * Persisted state of a data generator in MongoDB
 * Tracks the current value and usage statistics
 */
export interface DataGeneratorState {
	_id: string; // generatorId
	tenantOrgId: string; // Tenant isolation
	processId?: string; // Present if scope is 'process'
	strategy: DataGeneratorStrategy;
	currentValue: number | string; // Current state (number for serial, string for others)
	lastUpdated: Date;
	generationCount: number; // How many times this generator has been invoked
	createdAt: Date;
}

/**
 * Result of a generation operation
 */
export interface GenerationResult {
	generatorId: string;
	value: string; // The generated value
	formattedValue: string; // Value with prefix/suffix/padding applied
	generationCount: number;
	timestamp: Date;
}
