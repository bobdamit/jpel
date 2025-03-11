package net.rockscience.jpel.api;

import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController()
@RequestMapping(value = "run/v1")
public class RunController {


    // verbs
    /*
     * GET List workflows thumbnails of all workflows
     * POST Initiate Activities (wf id) - snapshots workflow as a run instance
     * GET top activity (runid) returns first activity
     * GET prev activity (runid) return previous step if any
     * GET latest activity (runid) returns currently executing activity and percent-done status
     * POST update activity (body activity state) for interactive activity - saves collected data
     * 
     */


}
