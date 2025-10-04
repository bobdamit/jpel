// Simple Node.js demo script for JPEL Runner
// This script demonstrates the API capabilities using simple HTTP requests

const http = require('http');

const API_BASE = 'http://localhost:3000/api';

// Simple HTTP request helper
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve(parsed);
        } catch (e) {
          resolve({ success: false, error: 'Invalid JSON response' });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Demo process definition
const helloWorldProcess = {
  "id": "demo-hello-world",
  "name": "Demo Hello World Process", 
  "description": "A simple greeting process for demonstration",
  "version": "1.0.0",
  "variables": {
    "userName": {
      "type": "string",
      "required": true,
      "description": "The user's name"
    },
    "greeting": {
      "type": "string", 
      "required": false,
      "description": "The generated greeting message"
    }
  },
  "activities": {
    "start": {
      "id": "start",
      "name": "Start Process",
      "type": "sequence",
      "next": "getUserName"
    },
    "getUserName": {
      "id": "getUserName",
      "name": "Get User Name",
      "type": "human",
      "prompt": "Welcome to JPEL! Please tell us your name:",
      "inputs": [
        {
          "name": "userName",
          "type": "string",
          "label": "Your Name",
          "required": true,
          "placeholder": "Enter your full name"
        }
      ],
      "outputs": {
        "userName": "v:userName"
      },
      "next": "generateGreeting"
    },
    "generateGreeting": {
      "id": "generateGreeting", 
      "name": "Generate Greeting",
      "type": "compute",
      "expression": "Hello, a:getUserName.f:userName! Welcome to JPEL!",
      "outputs": {
        "greeting": "v:greeting"
      },
      "next": "end"
    },
    "end": {
      "id": "end",
      "name": "Process Complete",
      "type": "terminate"
    }
  },
  "startActivity": "start"
};

async function runDemo() {
  console.log('🚀 JPEL Runner API Demo');
  console.log('======================');
  console.log('');

  try {
    // Step 1: Check health
    console.log('📡 Checking server health...');
    const health = await makeRequest('GET', '/health');
    if (!health.success) {
      console.log('❌ Server is not running. Please start with: npm start');
      return;
    }
    console.log('✅ Server is running!');
    console.log('');

    // Step 2: Load process
    console.log('📋 Loading Hello World Process...');
    const loadResult = await makeRequest('POST', '/api/processes', helloWorldProcess);
    if (loadResult.success) {
      console.log('✅ Process loaded successfully!');
    } else {
      console.log('❌ Failed to load process:', loadResult.error);
      return;
    }
    console.log('');

    // Step 3: List processes
    console.log('📁 Listing loaded processes...');
    const processes = await makeRequest('GET', '/api/processes');
    if (processes.success) {
      console.log(`✅ Found ${processes.data.length} process(es)`);
      processes.data.forEach(p => {
        console.log(`   - ${p.name} (${p.id})`);
      });
    } else {
      console.log('❌ Failed to list processes:', processes.error);
    }
    console.log('');

    // Step 4: Start instance
    console.log('▶️ Starting process instance...');
    const instance = await makeRequest('POST', '/api/instances/demo-hello-world/start', {});
    if (instance.success && instance.data.instanceId) {
      console.log(`✅ Instance started: ${instance.data.instanceId}`);
      
      // Step 5: Check for human task
      console.log('👤 Checking for human task...');
      const task = await makeRequest('GET', `/api/instances/${instance.data.instanceId}/current-task`);
      if (task.success && task.data.humanTask) {
        console.log('🎯 Human task found:');
        console.log(`   Activity: ${task.data.humanTask.activityId}`);
        console.log(`   Prompt: ${task.data.humanTask.prompt}`);
        console.log('');
        
        // Step 6: Submit task data
        console.log('📝 Submitting task data...');
        const submitResult = await makeRequest('POST', 
          `/api/instances/${instance.data.instanceId}/activities/${task.data.humanTask.activityId}/submit`,
          { userName: 'JPEL Demo User' }
        );
        
        if (submitResult.success) {
          console.log('✅ Task submitted successfully!');
          
          // Wait and check final status
          setTimeout(async () => {
            const finalStatus = await makeRequest('GET', `/api/instances/${instance.data.instanceId}`);
            if (finalStatus.success) {
              console.log(`🏁 Final status: ${finalStatus.data.status}`);
            }
          }, 1000);
        } else {
          console.log('❌ Failed to submit task:', submitResult.error);
        }
      } else {
        console.log('❌ No human task found');
      }
    } else {
      console.log('❌ Failed to start instance:', instance.error);
    }

  } catch (error) {
    console.log('❌ Demo failed:', error.message);
  }

  console.log('');
  console.log('🎉 Demo Complete!');
  console.log('================');
  console.log('');
  console.log('🌐 Try the interactive web demo at: http://localhost:3000');
  console.log('📖 API documentation available in the README.md');
  console.log('');
  console.log('Happy building with JPEL! 🚀');
}

// Run the demo
runDemo().catch(console.error);