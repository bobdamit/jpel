package net.rockscience.jpel.model;

import lombok.Data;
import net.rockscience.util.date.MultizoneDateTime;

@Data
public class ActivityRuntime {
	private MultizoneDateTime startTime;
	private MultizoneDateTime endTime;
	private ActivityState state;
}
