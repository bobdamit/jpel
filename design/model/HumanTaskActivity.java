package net.rockscience.qonfident.model;

import lombok.Data;
import java.util.List;

@Data
public class HumanTaskActivity extends Activity {
    private String subject;
    private List<Value> inputs;
    private List<FieldSet> fieldSets;
    private List<FileUpload> fileUploads;
    private List<Attachment> attachments;
}
