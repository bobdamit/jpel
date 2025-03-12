package net.rockscience.jpel.model;

import java.util.List;

import lombok.Data;

@Data
public class BaseActivity {
	private String description;
	private String aid;
	private ActivityRuntime runtime;
	private ActivityType type;
	private List<Variable> outputs;
}
