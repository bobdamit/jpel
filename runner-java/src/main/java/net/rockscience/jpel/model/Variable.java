package net.rockscience.jpel.model;

import lombok.Data;

@Data
public class Variable {
	private String name;
	private String vid;
	private String description;
	private ValueObject value;
	private VariableConstraint constraint;
	private VariablePresentation presentation;
}
