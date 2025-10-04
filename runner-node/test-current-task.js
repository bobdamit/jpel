// Test script to check current-task endpoint
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
            req.write(postData);
        }
        req.end();
    });
}

async function test() {
    try {
        console.log('1. Creating process instance...');
        
        const createOptions = {
            hostname: 'localhost',
            port: 3001,
            path: '/api/processes/hello-world/instances',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        };
        
        const createResult = await makeRequest(createOptions);
        console.log('Create result:', JSON.stringify(createResult, null, 2));
        
        if (createResult.success && createResult.data) {
            const instanceId = createResult.data.instanceId;
            console.log('\n2. Getting current task for instance:', instanceId);
            
            const taskOptions = {
                hostname: 'localhost',
                port: 3001,
                path: `/api/instances/${instanceId}/current-task`,
                method: 'GET'
            };
            
            const taskResult = await makeRequest(taskOptions);
            console.log('Current task result:', JSON.stringify(taskResult, null, 2));
            
            // Check if fields have value property
            if (taskResult.success && taskResult.data && taskResult.data.humanTask && taskResult.data.humanTask.fields) {
                const fields = taskResult.data.humanTask.fields;
                console.log('\n3. Analyzing fields:');
                fields.forEach((field, index) => {
                    console.log(`Field ${index}:`, {
                        name: field.name,
                        type: field.type,
                        hasValue: 'value' in field,
                        value: field.value
                    });
                });
            }
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

test();