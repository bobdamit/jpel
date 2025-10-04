// Test API endpoints to verify FieldValue objects are returned correctly
const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3001/api';

async function testAPIEndpoints() {
    console.log('🔍 Testing API endpoints for FieldValue objects...');
    
    try {
        // 1. Create an instance
        console.log('\n1️⃣ Creating instance...');
        const createResponse = await fetch(`${API_BASE}/processes/hello-world/instances`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        const createResult = await createResponse.json();
        
        if (!createResult.success) {
            console.error('❌ Failed to create instance:', createResult.error);
            return;
        }
        
        const instanceId = createResult.data.instanceId;
        console.log('✅ Instance created:', instanceId);
        console.log('📋 Human task fields:');
        createResult.data.humanTask?.fields?.forEach(field => {
            console.log(`  - ${field.name}: value=${field.value} (type: ${typeof field.value})`);
        });
        
        // 2. Submit some data
        console.log('\n2️⃣ Submitting human task data...');
        const submitResponse = await fetch(`${API_BASE}/instances/${instanceId}/activities/${createResult.data.humanTask.activityId}/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userName: 'API Test User' })
        });
        const submitResult = await submitResponse.json();
        console.log('✅ Human task submitted:', submitResult.success);
        
        // 3. Test re-run
        console.log('\n3️⃣ Testing re-run...');
        const rerunResponse = await fetch(`${API_BASE}/instances/${instanceId}/rerun`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        const rerunResult = await rerunResponse.json();
        
        if (!rerunResult.success) {
            console.error('❌ Failed to re-run:', rerunResult.error);
            return;
        }
        
        console.log('✅ Re-run successful:', rerunResult.data.instanceId);
        console.log('📋 Re-run human task fields with values:');
        rerunResult.data.humanTask?.fields?.forEach(field => {
            console.log(`  - ${field.name}: value="${field.value}" (type: ${typeof field.value})`);
        });
        
        // 4. Test current-task endpoint
        console.log('\n4️⃣ Testing current-task endpoint...');
        const taskResponse = await fetch(`${API_BASE}/instances/${rerunResult.data.instanceId}/current-task`);
        const taskResult = await taskResponse.json();
        
        if (taskResult.success && taskResult.data.humanTask) {
            console.log('✅ Current task endpoint working');
            console.log('📋 Current task fields with values:');
            taskResult.data.humanTask.fields?.forEach(field => {
                console.log(`  - ${field.name}: value="${field.value}" (type: ${typeof field.value})`);
            });
        } else {
            console.log('ℹ️ No current human task');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testAPIEndpoints();