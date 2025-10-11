import { describe, it, expect, beforeEach } from '@jest/globals';
import { ProcessEngine } from '../src/process-engine';
import { RepositoryFactory } from '../src/repositories/repository-factory';
import fs from 'fs';
import path from 'path';

describe('Country API Demo', () => {
  let engine: ProcessEngine;

  beforeEach(async () => {
    RepositoryFactory.initializeInMemory();
    engine = new ProcessEngine();
  });

  it('should load the country API demo process successfully', async () => {
    // Load the updated API demo process
    const processPath = path.join(__dirname, '..', 'samples', 'api-demo.json');
    const processContent = fs.readFileSync(processPath, 'utf8');
    const processDefinition = JSON.parse(processContent);

    // Verify the process is properly structured
    expect(processDefinition.id).toBe('api-demo');
    expect(processDefinition.name).toBe('Country Information API Demo');
    expect(processDefinition.activities.fetchCountryInfo).toBeDefined();
    expect(processDefinition.activities.fetchCountryInfo.url).toBe('https://restcountries.com/v3.1/name/a:getUserInput.v:country');

    // Load the process definition
    await engine.loadProcess(processDefinition);

    // Create process instance (will stop at first human activity)
    const createResult = await engine.createInstance('api-demo');
    const instance = await engine.getInstance(createResult.instanceId);

    expect(instance).not.toBeNull();
    if (!instance) return;

    expect(instance.status).toBe('running');
    expect(instance.activities.getUserInput.status).toBe('running');
  });

  it('should execute country API call and process response', async () => {
    // Load the API demo process
    const processPath = path.join(__dirname, '..', 'samples', 'api-demo.json');
    const processContent = fs.readFileSync(processPath, 'utf8');
    const processDefinition = JSON.parse(processContent);

    await engine.loadProcess(processDefinition);
    const createResult = await engine.createInstance('api-demo');

    // Submit data to the first human task
    await engine.submitHumanTask(createResult.instanceId, 'getUserInput', { 
      country: 'Japan', 
      infoType: 'general' 
    });

    // Wait for API call and processing to complete
    await new Promise(resolve => setTimeout(resolve, 3000));

    const instance = await engine.getInstance(createResult.instanceId);
    expect(instance).not.toBeNull();
    if (!instance) return;

    console.log('Process Status:', instance.status);
    console.log('Country Data Available:', !!instance.variables.countryData);
    console.log('Country Report Available:', !!instance.variables.countryReport);

    // Check that the process variables were set
    expect(instance.variables).toBeDefined();
    expect(instance.variables.countryData).toBeDefined();
    
    // Parse and verify the country data
    const countryData = JSON.parse(instance.variables.countryData);
    expect(countryData).toHaveProperty('name');
    expect(countryData).toHaveProperty('capital');
    expect(countryData).toHaveProperty('population');
    expect(countryData).toHaveProperty('area');
    expect(countryData.name.toLowerCase()).toContain('japan');
  }, 10000); // Longer timeout for API call
});