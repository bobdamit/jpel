import { describe, it, expect, beforeEach } from '@jest/globals';
import { ProcessEngine } from '../src/process-engine';
import { RepositoryFactory } from '../src/repositories/repository-factory';
import fs from 'fs';
import path from 'path';

describe('API Activity with Code Execution', () => {
  let engine: ProcessEngine;

  beforeEach(async () => {
    RepositoryFactory.initializeInMemory();
    engine = new ProcessEngine();
  });

  it('should execute API activity and set process variables', async () => {
    // Load the simple API demo process
    const processPath = path.join(__dirname, '..', 'samples', 'simple-api-demo.json');
    const processContent = fs.readFileSync(processPath, 'utf8');
    const processDefinition = JSON.parse(processContent);

    // Load the process definition
    await engine.loadProcess(processDefinition);

    // Create and run the process instance
    const createResult = await engine.createInstance('simple-api-demo');

    // Submit data to the human task to continue the process
    await engine.submitHumanTask(createResult.instanceId, 'getUserPrefs', { postId: '1' });

    // Wait for process to complete (API call + processing)
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Get the final instance state from the engine
    const instance = await engine.getInstance(createResult.instanceId);

    expect(instance).not.toBeNull();
    if (!instance) return;

    console.log('Process Status:', instance.status);
    console.log('Process Variables:', JSON.stringify(instance.variables, null, 2));

    // Check that the process variable was set
    expect(instance.variables).toBeDefined();
    expect(instance.variables.quoteData).toBeDefined();
    
    // Parse the JSON string to verify the data structure
    let parsedData;
    try {
      parsedData = JSON.parse(instance.variables.quoteData);
    } catch (e) {
      // If it's already an object, use it directly
      parsedData = instance.variables.quoteData;
    }
    
    // Verify the quoteData has expected structure from jsonplaceholder
    expect(parsedData).toHaveProperty('userId');
    expect(parsedData).toHaveProperty('id');
    expect(parsedData).toHaveProperty('title');
    expect(parsedData).toHaveProperty('body');
    expect(parsedData).toHaveProperty('fetchedAt');
  });
});