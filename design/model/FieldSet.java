package net.rockscience.qonfident.model;

import lombok.Data;
import java.util.List;

@Data
public class FieldSet {
    private String name;
    private List<Variable> variables;
}
