package net.rockscience.jpel.model;

import lombok.Getter;
import net.rockscience.util.enumz.StableOrderEnum.HasStableCode;

public enum ActivityState implements HasStableCode {
	Pending(0),
	InProgress(1),
	Completed(2),
	Failed(3),
	Cancelled(4),
	TimedOut(5);

	@Getter
	private Integer stableCode;
	private ActivityState(int c ){
		this.stableCode = c;
	}


}
