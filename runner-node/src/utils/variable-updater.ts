import { ActivityInstance } from '../models/instance-types';
import { FieldType } from '../models/common-types';

/**
 * Update an activity instance's variables array from submitted data.
 * - If a variable exists, update its value.
 * - If it doesn't exist, create a new variable entry with an inferred FieldType.
 */
export function updateActivityVariables(activityInstance: ActivityInstance, data: { [key: string]: any }): void {
	if (!activityInstance.variables) {
		activityInstance.variables = [];
	}

	Object.keys(data || {}).forEach(key => {
		const existing = activityInstance.variables!.find(v => v.name === key);
		if (existing) {
			existing.value = data[key];
		} else {
			const variable = {
				name: key,
				type: typeof data[key] === 'boolean' ? FieldType.Boolean :
					typeof data[key] === 'number' ? FieldType.Number : FieldType.Text,
				value: data[key]
			} as any;
			activityInstance.variables!.push(variable);
		}
	});
}
