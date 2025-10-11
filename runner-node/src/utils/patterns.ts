import { ActivityInstance } from '../models/instance-types';

// Reusable regex patterns used across the codebase for inline token parsing
export const ACTIVITY_VAR_PATTERN = /a:([A-Za-z0-9_-]+)\.v:([A-Za-z0-9_-]+)/g;
export const ACTIVITY_FIELD_PATTERN = /a:([A-Za-z0-9_-]+)\.f:([A-Za-z0-9_-]+)/g;
export const ACTIVITY_PROP_PATTERN = /a:([A-Za-z0-9_-]+)\.(\w+)/g;
export const PROCESS_VAR_PATTERN = /process\.([A-Za-z0-9_-]+)/g;

/** Map activity.variables array to an object { name: value } */
export function mapVariablesArray(activity?: ActivityInstance): Record<string, any> {
    if (!activity) return {};
    if (activity.variables && Array.isArray(activity.variables)) {
        const out: Record<string, any> = {};
        activity.variables.forEach((v: any) => {
            out[v.name] = v.value;
        });
        return out;
    }
    return {};
}

export default { ACTIVITY_VAR_PATTERN, ACTIVITY_FIELD_PATTERN, ACTIVITY_PROP_PATTERN, PROCESS_VAR_PATTERN, mapVariablesArray };
