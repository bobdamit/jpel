package net.rockscience.qonfident.model;

import lombok.Data;
import java.util.List;

@Data
public class FileUpload {
    private String name;
    private String description;
    private List<String> allowedTypes;
    private int maxBytes;
    private int minCount;
    private int maxCount;
}
