import axios, { AxiosResponse } from 'axios';
import { APIActivity, ProcessInstance } from './types';

export class APIExecutor {

	async execute(activity: APIActivity, instance: ProcessInstance): Promise<any> {
		try {
			// Substitute variables in URL, headers, queryParams, and body
			const url = this.substituteVariables(activity.url, instance);
			const headers = this.substituteObjectVariables(activity.headers || {}, instance);
			const queryParams = this.substituteObjectVariables(activity.queryParams || {}, instance);
			const body = activity.body ? this.substituteVariables(JSON.stringify(activity.body), instance) : undefined;

			// Make the HTTP request
			const response: AxiosResponse = await axios({
				method: activity.method,
				url,
				headers,
				params: queryParams,
				data: body ? JSON.parse(body) : undefined,
				timeout: (activity.timeout || 30) * 1000, // Convert to milliseconds
				validateStatus: () => true // Don't throw on HTTP error status
			});

			return {
				status: response.status,
				statusText: response.statusText,
				headers: response.headers,
				data: response.data
			};
		} catch (error: any) {
			if (error.isAxiosError) {
				throw new Error(`HTTP request failed: ${error.message}`);
			}
			throw error;
		}
	}

	private substituteVariables(text: string, instance: ProcessInstance): string {
		let result = text;

		// Replace a:activityId.f:fieldName references
		result = result.replace(/a:(\w+)\.f:(\w+)/g, (match, activityId, fieldName) => {
			const activity = instance.activities[activityId];
			if (activity?.data?.[fieldName] !== undefined) {
				return String(activity.data[fieldName]);
			}
			return match; // Return original if not found
		});

		// Replace process.variableName references
		result = result.replace(/process\.(\w+)/g, (match, variableName) => {
			if (instance.variables[variableName] !== undefined) {
				return String(instance.variables[variableName]);
			}
			return match; // Return original if not found
		});

		return result;
	}

	private substituteObjectVariables(obj: { [key: string]: string }, instance: ProcessInstance): { [key: string]: string } {
		const result: { [key: string]: string } = {};

		Object.entries(obj).forEach(([key, value]) => {
			result[key] = this.substituteVariables(value, instance);
		});

		return result;
	}
}