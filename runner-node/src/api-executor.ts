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
import logger from './logger';

export class APIExecutor {

	async execute(activity: APIActivity, instance: ProcessInstance): Promise<any> {
		const maxRetries = activity.retries || 0;
		const expectedStatus = activity.expectedStatus || [200];
		
		let lastError: any;
		
		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			try {
				// Substitute variables in URL, headers, queryParams, and body
				const url = substituteStringTemplate(activity.url, instance);
				const headers = substituteObjectVariables(activity.headers || {}, instance);
				const queryParams = substituteObjectVariables(activity.queryParams || {}, instance);
				const body = activity.body ? substituteStringTemplate(JSON.stringify(activity.body), instance) : undefined;

				logger.info(`APIExecutor: Making ${activity.method} request to ${url} (attempt ${attempt + 1}/${maxRetries + 1})`);

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

				// Check if status is expected
				if (!expectedStatus.includes(response.status)) {
					throw new Error(`Unexpected HTTP status ${response.status}. Expected one of: ${expectedStatus.join(', ')}`);
				}

				logger.info(`APIExecutor: Request successful with status ${response.status}`);

				return {
					status: response.status,
					statusText: response.statusText,
					headers: response.headers,
					data: response.data
				};
			} catch (error: any) {
				lastError = error;
				logger.error(`APIExecutor: Request error on attempt ${attempt + 1}:`, error.message);
				if (attempt < maxRetries) {
					const delay = Math.pow(2, attempt) * 1000;
					logger.warn(`APIExecutor: Request failed (attempt ${attempt + 1}), retrying in ${delay}ms...`, error.message);
					// Wait before retry (exponential backoff)
					await new Promise(resolve => setTimeout(resolve, delay));
				} else {
					logger.error(`APIExecutor: Request failed after ${maxRetries + 1} attempts`, error.message);
				}
			}
		}
		
		// All retries exhausted
		if (lastError.isAxiosError) {
			throw new Error(`HTTP request failed after ${maxRetries + 1} attempts: ${lastError.message}`);
		}
		throw lastError;
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