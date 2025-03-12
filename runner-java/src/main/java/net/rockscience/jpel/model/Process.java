package net.rockscience.jpel.model;

import java.util.List;

import lombok.Data;
import net.rockscience.util.date.MultizoneDateTime;

@Data
public class Process {
	private String pid;
	private String name;
	private String description;
	private ProcessMetadata metadata;
	private List<Variable> variables;
	private List<Variable> outputs;

	private List<? extends BaseActivity> activities;

	@Data
	public static class ProcessMetadata {
		private String version;
		private String createUserId;
		private MultizoneDateTime createTime;
	}
}
