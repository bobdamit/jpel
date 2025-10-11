import { ProcessInstance } from '../models/instance-types';
import { ACTIVITY_VAR_PATTERN, ACTIVITY_FIELD_PATTERN, PROCESS_VAR_PATTERN, mapVariablesArray } from './patterns';

/**
 * Resolve inline template tokens inside a string, e.g. "a:act.v:var" or "process.name".
 * Pure helper that does not depend on ExpressionEvaluator state.
 */
export function resolveInlineTemplate(text: string, instance: ProcessInstance): string {
    if (!text) return text;
    let result = text;

    result = result.replace(ACTIVITY_VAR_PATTERN, (match, activityId, variableName) => {
        const activity = instance.activities[activityId];
        const activityData = mapVariablesArray(activity as any);
        if (activityData && activityData[variableName] !== undefined) return String(activityData[variableName]);
        return match;
    });

    result = result.replace(ACTIVITY_FIELD_PATTERN, (match, activityId, fieldName) => {
        const activity = instance.activities[activityId];
        const activityData = mapVariablesArray(activity as any);
        if (activityData && activityData[fieldName] !== undefined) return String(activityData[fieldName]);
        return match;
    });

    result = result.replace(PROCESS_VAR_PATTERN, (match, variableName) => {
        if (instance.variables && instance.variables[variableName] !== undefined) return String(instance.variables[variableName]);
        return match;
    });

    return result;
}

/**
 * Substitute tokens inside a string using ExpressionEvaluator.resolveInlineTemplate.
 */
export function substituteStringTemplate(text: string, instance: ProcessInstance): string {
    return resolveInlineTemplate(text, instance);
}

/**
 * Substitute tokens inside all string values of an object.
 * Returns a new object with substituted values.
 */
export function substituteObjectVariables(obj: { [key: string]: string }, instance: ProcessInstance): { [key: string]: string } {
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, resolveInlineTemplate(v, instance)]));
}

export default { substituteStringTemplate, substituteObjectVariables };
