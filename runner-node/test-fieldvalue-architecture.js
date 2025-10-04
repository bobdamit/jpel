// Test script to verify FieldValue architecture fix
const http = require('http');

function makeRequest(options, postData = null) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve(data);
                }
            });
        });
        
        req.on('error', (err) => {
            reject(err);
        });
        
        if (postData) {
            req.write(JSON.stringify(postData));
        }
        req.end();
    });
}

async function testFieldValueArchitecture() {
    try {
        console.log('=== Testing FieldValue Architecture Fix ===\n');
        
        // 1. Create a new instance
        console.log('1. Creating new process instance...');
        const createOptions = {
            hostname: 'localhost',
            port: 3002,
            path: '/api/processes/hello-world/instances',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        };
        
        const createResult = await makeRequest(createOptions);
        if (!createResult.success) {
            console.error('Failed to create instance:', createResult.error);
            return;
        }
        
        const instanceId = createResult.data.instanceId;
        console.log(`✅ Instance created: ${instanceId}\n`);
        
        // 2. Get current task (should show FieldValue with undefined/default value)
        console.log('2. Getting initial human task...');
        const taskOptions = {
            hostname: 'localhost',
            port: 3002,
            path: `/api/instances/${instanceId}/current-task`,
            method: 'GET'
        };
        
        const initialTask = await makeRequest(taskOptions);
        console.log('Initial task fields:');
        if (initialTask.data?.humanTask?.fields) {
            initialTask.data.humanTask.fields.forEach(field => {
                console.log(`  - ${field.name}: ${JSON.stringify({
                    type: field.type,
                    hasValue: 'value' in field,
                    value: field.value
                })}`);
            });
        }
        console.log();
        
        // 3. Submit form data
        console.log('3. Submitting form data...');
        const submitOptions = {
            hostname: 'localhost',
            port: 3002,
            path: `/api/instances/${instanceId}/activities/getUserName/submit`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        };
        
        const submitData = { userName: 'John Doe' };
        const submitResult = await makeRequest(submitOptions, submitData);
        console.log(`✅ Form submitted with data:`, submitData);
        console.log(`   Status: ${submitResult.data?.status}\n`);
        
        // 4. Re-run the instance
        console.log('4. Re-running instance...');
        const rerunOptions = {
            hostname: 'localhost',
            port: 3002,
            path: `/api/instances/${instanceId}/rerun`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        };
        
        const rerunResult = await makeRequest(rerunOptions);
        if (!rerunResult.success) {
            console.error('Failed to re-run:', rerunResult.error);
            return;
        }
        
        const newInstanceId = rerunResult.data.instanceId;
        console.log(`✅ Re-run created new instance: ${newInstanceId}\n`);
        
        // 5. Get current task from re-run (should show FieldValue with previous value)
        console.log('5. Getting re-run human task (should have previous values)...');
        const rerunTaskOptions = {
            hostname: 'localhost',
            port: 3002,
            path: `/api/instances/${newInstanceId}/current-task`,
            method: 'GET'
        };
        
        const rerunTask = await makeRequest(rerunTaskOptions);
        console.log('Re-run task fields:');
        if (rerunTask.data?.humanTask?.fields) {
            rerunTask.data.humanTask.fields.forEach(field => {
                console.log(`  - ${field.name}: ${JSON.stringify({
                    type: field.type,
                    hasValue: 'value' in field,
                    value: field.value,
                    expectedValue: 'John Doe'
                })}`);
                
                // Verify the field has the correct structure
                if ('value' in field) {
                    console.log(`    ✅ Field has 'value' property`);
                    if (field.value === 'John Doe') {
                        console.log(`    ✅ Value correctly preserved from previous run`);
                    } else {
                        console.log(`    ❌ Value not preserved (expected 'John Doe', got '${field.value}')`);
                    }
                } else {
                    console.log(`    ❌ Field missing 'value' property - still Field, not FieldValue!`);
                }
            });
        }
        
        console.log('\n=== Test Complete ===');
        
    } catch (error) {
        console.error('Test failed:', error);
    }
}

testFieldValueArchitecture();