package net.rockscience.jpel.engine;

import java.util.List;

import com.fasterxml.jackson.databind.JsonNode;

import net.rockscience.jpel.model.BaseActivity;
import net.rockscience.jpel.model.Process;
import net.rockscience.jpel.model.Variable;

public class JsonProcessBuilder {

	private JsonProcessBuilder() {
	}	


	public static Process build(JsonNode jsoProcess) {
		Process process = new Process();
		process.setPid(jsoProcess.get("pid").asText());
		process.setName(jsoProcess.get("name").asText());
		process.setDescription(jsoProcess.get("description").asText());
		process.setMetadata(buildMetadata(jsoProcess.get("metadata")));
		process.setVariables(buildVariables(jsoProcess.get("variables")));
		process.setOutputs(buildVariables(jsoProcess.get("outputs")));
		process.setActivities(buildActivities(jsoProcess.get("activities")));
		return process;
	}

	private static List<Variable> buildVariables(JsonNode jsonNode) {
		// TODO Auto-generated method stub
		return null;
	}

	private static Process.ProcessMetadata buildMetadata(JsonNode jsonNode) {
		Process.ProcessMetadata metadata = new Process.ProcessMetadata();
		metadata.setVersion(jsonNode.get("version").asText());
		metadata.setCreateUserId(jsonNode.get("createUserId").asText());
		return metadata;
	}

	private static List<? extends BaseActivity> buildActivities(JsonNode jsonNode) {
		// TODO Auto-generated method stub
		return null;
	}
}
