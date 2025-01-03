package net.rockscience.qonfident.model;
    

import lombok.Data;

@Data
public class Attachment {
    private String name;
    private String objectUrl;
    private String previewUrl;
    private String mediaType;
    private int bytes;
}
