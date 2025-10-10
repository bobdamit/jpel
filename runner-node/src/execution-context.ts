import { logger } from './logger';


/**
 * Execution Context for the process engine
 * This maintains call stack frames
 */
export class ExecutionContext {
	private callStack: ExecutionFrame[] = [];

	public get currentActivity(): string | undefined {
		const topFrame = this.getCurrentFrame();
		return topFrame ? topFrame.activityId : undefined;
	}

	public isAtRoot(): boolean {
		return this.callStack.length === 0;
	}

	/**
	 * Push a new execution frame onto the call stack
	 * @param activityId The activity being entered
	 * @param parentId The parent container activity (sequence, switch, etc.)
	 * @param position Current position in parent (for sequences, switch cases, etc.)
	 */
	public pushFrame(
		activityId: string,
		parentId?: string,
		position?: number
	): void {
		const frame: ExecutionFrame = {
			activityId,
			parentId,
			position,
		};
		logger.info(`ExecutionContext: Pushing frame: ${JSON.stringify(frame)}`);	
		this.callStack.push(frame);
	}

	/**
	 * Pop the current frame and return to the caller
	 * @returns The parent frame information for continuation, or null if at root
	 */
	public popFrame(): ExecutionFrame | null {
		if (this.callStack.length === 0) {
			return null; // Already at root
		}

		const completedFrame = this.callStack.pop()!;
		return completedFrame;
	}

	/**
	 * Get the current frame without removing it
	 */
	public getCurrentFrame(): ExecutionFrame | null {
		return this.callStack.length > 0
			? this.callStack[this.callStack.length - 1]
			: null;
	}

	/**
	 * Check if the call stack has any frames
	 */
	public hasCallStack(): boolean {
		return this.callStack.length > 0;
	}

	/**
	 * Get the first frame (bottom of stack) without removing it
	 */
	public getFirstFrame(): ExecutionFrame | null {
		return this.callStack.length > 0 ? this.callStack[0] : null;
	}

	/**
	 * Clear the entire call stack (for process rerun)
	 */
	public clearCallStack(): void {
		this.callStack = [];
	}

	/**
	 * Get the parent frame information for determining next steps
	 */
	public getParentFrame(): ExecutionFrame | null {
		return this.callStack.length > 1
			? this.callStack[this.callStack.length - 2]
			: null;
	}
}

/**
 * Represents a frame in the execution call stack
 */
export interface ExecutionFrame {
	activityId: string;
	parentId?: string; // The container activity that called this one
	position?: number; // Position within parent (sequence index, switch case, etc.)
	metadata?: any; // Additional context data
}