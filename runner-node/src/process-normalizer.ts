import { ProcessDefinition } from './types';
import { logger } from './logger';

export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

export class ProcessNormalizer {
    validate(processDefinition: ProcessDefinition): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        if (!processDefinition) {
            errors.push('Process definition is empty');
            return { valid: false, errors, warnings };
        }

        if (!processDefinition.id) errors.push('Missing required field: id');
        if (!processDefinition.name) errors.push('Missing required field: name');

        if (processDefinition.activities) {
            for (const [key, activity] of Object.entries(processDefinition.activities)) {
                if (!activity.type) {
                    errors.push(`Activity '${key}' missing required field: type`);
                    continue;
                }

                // check for common mistakes: using 'checkbox' instead of 'boolean' for fields
                if ((activity as any).inputs && Array.isArray((activity as any).inputs)) {
                    for (const f of (activity as any).inputs) {
                        if (f && f.type === 'checkbox') {
                            warnings.push(`Activity '${key}' field '${f.name}' uses deprecated type 'checkbox' (use 'boolean')`);
                        }
                    }
                }

                // Validate field references in compute activity code
                if (activity.type === 'compute' && (activity as any).code) {
                    const codeLines = (activity as any).code as string[];
                    for (const line of codeLines) {
                        const fieldRefs = this.extractFieldReferences(line);
                        for (const ref of fieldRefs) {
                            const validationError = this.validateFieldReference(ref, processDefinition);
                            if (validationError) {
                                errors.push(`Activity '${key}' code: ${validationError}`);
                            }
                        }
                    }
                }
            }
        }

        // Cross-reference checks (start, sequence/parallel lists, branch/switch targets)
        const activityKeys = new Set(Object.keys(processDefinition.activities || {}));

        function extractRef(ref?: string): string | null {
            if (!ref) return null;
            return ref.startsWith('a:') ? ref.substring(2) : ref;
        }

        // start reference
        const startRef = extractRef(processDefinition.start);
        if (!startRef || !activityKeys.has(startRef)) {
            errors.push(`Start activity reference '${processDefinition.start}' does not point to a valid activity`);
        }

        for (const [key, activity] of Object.entries(processDefinition.activities || {})) {
            switch (activity.type) {
                case 'sequence':
                case 'parallel':
                    const arr = (activity as any).activities as string[] | undefined;
                    if (!arr || !Array.isArray(arr) || arr.length === 0) {
                        errors.push(`Activity '${key}' of type '${activity.type}' must have a non-empty 'activities' array`);
                    } else {
                        for (const r of arr) {
                            const id = extractRef(r);
                            if (!id || !activityKeys.has(id)) {
                                errors.push(`Activity '${key}' references unknown activity '${r}'`);
                            }
                        }
                    }
                    break;

                case 'branch':
                    const thenRef = extractRef((activity as any).then);
                    const elseRef = extractRef((activity as any).else);
                    if (!thenRef || !activityKeys.has(thenRef)) {
                        errors.push(`Activity '${key}' branch 'then' reference '${(activity as any).then}' is invalid`);
                    }
                    if (elseRef && !activityKeys.has(elseRef)) {
                        errors.push(`Activity '${key}' branch 'else' reference '${(activity as any).else}' is invalid`);
                    }
                    break;

                case 'switch':
                    const cases = (activity as any).cases as { [k: string]: string } | undefined;
                    if (!cases || typeof cases !== 'object' || Object.keys(cases).length === 0) {
                        errors.push(`Activity '${key}' of type 'switch' must have a non-empty 'cases' object`);
                    } else {
                        for (const [caseKey, caseRef] of Object.entries(cases || {})) {
                            const id = extractRef(caseRef);
                            if (!id || !activityKeys.has(id)) {
                                errors.push(`Activity '${key}' switch case '${caseKey}' references unknown activity '${caseRef}'`);
                            }
                        }
                    }
                    const defaultRef = extractRef((activity as any).default);
                    if (defaultRef && !activityKeys.has(defaultRef)) {
                        errors.push(`Activity '${key}' switch default reference '${(activity as any).default}' is invalid`);
                    }
                    break;
            }
        }

        return { valid: errors.length === 0, errors, warnings };
    }

    /**
     * Extract field references from a line of code
     * Looks for patterns like a:activityId.f:fieldName
     */
    private extractFieldReferences(codeLine: string): string[] {
        const fieldRefPattern = /a:([a-zA-Z0-9_-]+)\.f:([a-zA-Z0-9_-]+)/g;
        const references: string[] = [];
        let match;
        
        while ((match = fieldRefPattern.exec(codeLine)) !== null) {
            references.push(`a:${match[1]}.f:${match[2]}`);
        }
        
        return references;
    }

    /**
     * Validate a field reference against the process definition
     * Returns error message if invalid, null if valid
     */
    private validateFieldReference(fieldRef: string, processDefinition: ProcessDefinition): string | null {
        const match = fieldRef.match(/^a:([a-zA-Z0-9_-]+)\.f:([a-zA-Z0-9_-]+)$/);
        if (!match) {
            return `Invalid field reference format: ${fieldRef}`;
        }

        const [, activityId, fieldName] = match;
        
        // Check if activity exists
        const activity = processDefinition.activities?.[activityId];
        if (!activity) {
            return `Field reference '${fieldRef}' references unknown activity '${activityId}'`;
        }

        // Check if activity has inputs (only human activities have field inputs)
        if (activity.type !== 'human') {
            return `Field reference '${fieldRef}' references activity '${activityId}' which is not a human activity and has no input fields`;
        }

        // Check if field exists in the activity's inputs
        const inputs = (activity as any).inputs as any[] | undefined;
        if (!inputs || !Array.isArray(inputs)) {
            return `Field reference '${fieldRef}' references activity '${activityId}' which has no input fields defined`;
        }

        const fieldExists = inputs.some(input => input && input.name === fieldName);
        if (!fieldExists) {
            const availableFields = inputs.map(input => input?.name || 'unnamed').join(', ');
            return `Field reference '${fieldRef}' references unknown field '${fieldName}' in activity '${activityId}'. Available fields: ${availableFields}`;
        }

        return null; // Valid reference
    }

    normalize(processDefinition: ProcessDefinition): void {
        if (!processDefinition || !processDefinition.activities) return;

        for (const [activityKey, activity] of Object.entries(processDefinition.activities)) {
            if (!activity.id) {
                activity.id = activityKey;
            } else if (activity.id !== activityKey) {
                logger.warn(`ProcessNormalizer: Activity map key '${activityKey}' does not match activity.id '${activity.id}' - using map key`, {
                    processId: processDefinition.id
                });
                activity.id = activityKey;
            }

            // Normalize fields: checkbox -> boolean
            if ((activity as any).inputs && Array.isArray((activity as any).inputs)) {
                for (const f of (activity as any).inputs) {
                    if (f && f.type === 'checkbox') {
                        f.type = 'boolean';
                    }
                }
            }
        }
    }
}

export default new ProcessNormalizer();
