package net.rockscience.jpel.model;

import java.util.List;

import lombok.Data;

@Data
public class VariableConstraint {
	private List<ValueObject> allowedValues;
	private boolean required;
	private Double min;
	private Double max;
	private Integer minLength;
	private Integer maxLength;
	private String regexPattern;
	private String name;
}
