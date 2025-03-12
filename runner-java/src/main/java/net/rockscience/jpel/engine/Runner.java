package net.rockscience.jpel.engine;



import java.util.UUID;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonMappingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.json.JsonMapper;

import net.rockscience.jpel.model.Process;

/**
 * This is what does the stuff with the thing.  
 */
public class Runner {
	private static final Logger s_logger = LogManager.getLogger(Runner.class);	

	private Process process;
	private String runInstanceId;

	public void initialize(String json) throws JsonMappingException, JsonProcessingException {
		JsonNode jso = JsonMapper.builder().build().readTree(json);
		initialize(jso);
	}

	public void initialize(JsonNode jsoProcess) {
		s_logger.info("Initializing Process");
		this.runInstanceId = UUID.randomUUID().toString();
		process = JsonProcessBuilder.build(jsoProcess);
	}

}
