package net.rockscience.jpel.model;

import lombok.Data;

@Data
public class ValueObject {
	private Object value;
	private ValueType type;

	public enum ValueType {
		String,
		Number,
		Boolean,
		Enum,
		Object,
		Array,
		URL

	}
}
