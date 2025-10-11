import axios, { AxiosResponse } from 'axios';
import { APIActivity, ActivityType } from './models/process-types';
import {
	ProcessInstance,
	ActivityInstance,
	HumanActivityInstance,
	APIActivityInstance,
	ComputeActivityInstance,
	SequenceActivityInstance,
	ParallelActivityInstance,
	BranchActivityInstance,
	SwitchActivityInstance,
} from './models/instance-types';
import { ExpressionEvaluator } from './expression-evaluator';
import { substituteStringTemplate, substituteObjectVariables } from './utils/substitution';

export class APIExecutor {

	async execute(activity: APIActivity, instance: ProcessInstance): Promise<any> {
		try {
			// Substitute variables in URL, headers, queryParams, and body
			const url = substituteStringTemplate(activity.url, instance);
			const headers = substituteObjectVariables(activity.headers || {}, instance);
			const queryParams = substituteObjectVariables(activity.queryParams || {}, instance);
			const body = activity.body ? substituteStringTemplate(JSON.stringify(activity.body), instance) : undefined;

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
		// Delegate token replacement to the expression evaluator's helper
		return this.evaluator.resolveInlineTemplate(text, instance);
	}

	/**
	 * Extracts data from typed activity instances for variable substitution
	 */
	private evaluator = new ExpressionEvaluator();

	private getActivityData(activity: ActivityInstance | undefined): Record<string, any> {
		return this.evaluator.getActivityVariableState(activity);
	}

}