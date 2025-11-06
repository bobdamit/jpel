/**
 * Common types shared between process definitions and runtime instances
 * These are fundamental building blocks with no opinion about definition vs runtime
 */

/**
 * Supported field/variable types
 */
export enum FieldType {
	Text = "text",
	Number = "number",
	Boolean = "boolean",
	Select = "select",
	Date = "date",
	File = "file",
}

/**
 * Option for select/enum fields with display label and actual value
 */
export interface ValueOption {
	label?: string;
	value: string | number | boolean;
}

/**
 * File specification for file upload fields
 * Defines allowed file types and extensions
 */
export interface FileSpec {
	extensions?: string[]; // e.g., ['.jpg', '.png', '.pdf']
	fileType?: string; // MIME type pattern, e.g., 'image/*', 'application/pdf'
}

/**
 * Configuration for auto-generated field values
 * References a DataGenerator defined in the process template
 */
export interface FieldDataGenerator {
	generatorId: string; // References a DataGenerator in ProcessDefinition.dataGenerators
	autoPopulate?: boolean; // If true, generate value automatically when form loads
	allowManualEdit?: boolean; // If true, user can override generated value
}
