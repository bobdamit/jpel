// JPEL Demo Web Interface JavaScript
// Separated from HTML for CSP compliance

const API_BASE = window.location.origin + '/api';
let currentInstanceId = null;
let currentActivityId = null;

// Available processes will be loaded dynamically
let availableProcesses = {};
// Track previously-seen activity statuses per instance to detect completions
const instanceActivityState = {}; // { instanceId: { activityId: status, ... } }

function showStatus(message, type = 'info') {
    const resultDiv = document.getElementById('management-results');
    resultDiv.innerHTML = `<div class="status ${type}">${message}</div>`;
}

function showExecutionStatus(message, type = 'info') {
    const resultDiv = document.getElementById('execution-results');
    resultDiv.innerHTML = `<div class="status ${type}">${message}</div>`;
}

function showTaskStatus(message, type = 'info') {
    const resultDiv = document.getElementById('task-results');
    resultDiv.innerHTML = `<div class="status ${type}">${message}</div>`;
}

// Render process variables for a given instance object (original detailed view)
function renderInstanceVariables(instance) {
    const container = document.getElementById('instance-variables');
    if (!container) return;
    const vars = instance && instance.variables ? instance.variables : {};
    const rows = Object.keys(vars).map(k => `<div class="var-row"><strong>${k}</strong>: ${JSON.stringify(vars[k])}</div>`).join('');
    container.innerHTML = `<h4>Process Variables</h4>${rows || '<div class="empty">(no variables)</div>'}`;
}

// Called whenever there's a new snapshot of an instance; detects activity completions
function detectAndRenderFinishedActivities(instance) {
    if (!instance || !instance.instanceId || !instance.activities) return;
    const instId = instance.instanceId;
    if (!instanceActivityState[instId]) instanceActivityState[instId] = {};

    const finishedContainer = document.getElementById('finished-activities');
    if (!finishedContainer) return;

    // Ensure container has a list element
    let list = finishedContainer.querySelector('ul');
    if (!list) {
        finishedContainer.innerHTML = '<ul class="finished-list"></ul>';
        list = finishedContainer.querySelector('ul');
    }

    Object.entries(instance.activities).forEach(([actId, act]) => {
        const prev = instanceActivityState[instId][actId];
        const curr = act.status;
		  const type = act.type;
        // If previous state wasn't completed and now it is, append
        const terminal = ['completed', 'failed', 'cancelled', 'timeout'];
        if (prev !== curr && terminal.includes(curr)) {
            // Build a concise summary of variables set on this activity (name: value pairs)
            const vars = Array.isArray(act.variables) ? act.variables : [];
            let varsHtml = '<div class="empty">(no activity variables)</div>';
            if (vars.length > 0) {
                const pairs = vars.map(v => {
                    const value = (v && v.value !== undefined) ? v.value : (v && v.defaultValue !== undefined ? v.defaultValue : null);
                    // Format simple values inline, stringify objects modestly
                    const formatted = (value === null || value === undefined) ? '<em>(empty)</em>' : (
                        (typeof value === 'object') ? JSON.stringify(value) : String(value)
                    );
                    return `<div class="var-pair"><strong>${v.name}</strong>: ${formatted}</div>`;
                }).join('');
                varsHtml = `<div class="finished-vars-list">${pairs}</div>`;
            }

            const item = document.createElement('li');
            item.className = 'finished-item';
            const time = act.completedAt ? new Date(act.completedAt).toLocaleString() : '';
            const displayName = act.name || actId;
            // Pass/fail indicator (if set on the activity)
            const pf = act.passFail || null;
            const pfHtml = pf ? `<span class="pass-fail ${pf}">${String(pf).charAt(0).toUpperCase() + String(pf).slice(1)}</span>` : '';

            item.innerHTML = `
                <div class="finished-header">
					 <strong>${displayName}</strong> — 
					 <span class="type">${type}</span> 
					 ${pfHtml} ${time ? `<span class="time">@ ${time}</span>` : ''}
					 </div>
                ${varsHtml}
            `;

            // Prepend so newest finished appear at top
            list.insertBefore(item, list.firstChild);
        }

        // Update tracked state
        instanceActivityState[instId][actId] = curr;
    });
}

// Render simplified process variables for the right column
function renderProcessVariablesSimple(instance) {
    const container = document.getElementById('process-variables-simple');
    if (!container) return;
    
    if (!instance || !instance.variables || Object.keys(instance.variables).length === 0) {
        container.innerHTML = '<p style="color: #6c757d; font-style: italic;">No variables</p>';
        return;
    }

    const vars = instance.variables;
    const html = Object.entries(vars).map(([key, value]) => `
        <div class="variable-item">
            <div class="variable-name">${key}</div>
            <div class="variable-value">${JSON.stringify(value)}</div>
        </div>
    `).join('');
    
    container.innerHTML = `<div class="variables-grid">${html}</div>`;
}

// Render currently running activity or activities (original detailed view)
function renderRunningActivities(instance) {
    const container = document.getElementById('running-activities');
    if (!container) return;
    if (!instance) {
        container.innerHTML = '<div class="empty">(no instance)</div>';
        return;
    }

    // If instance.currentActivity is a sequence/parallel, there may be multiple running
    // activities encoded in instance.activities where status === 'running'
    const running = Object.entries(instance.activities || {}).filter(([id, a]) => a.status === 'running').map(([id, a]) => ({ id, a }));

    if (running.length === 0) {
        container.innerHTML = '<div class="empty">(no running activities)</div>';
        return;
    }

    const html = running.map(r => `
        <div class="running-activity">
            <div class="act-id">${r.id}</div>
            <div class="act-type">${r.a.type}</div>
            <div class="act-status">${r.a.status}</div>
            <div class="act-data"><pre>${JSON.stringify(r.a.f || r.a, null, 2)}</pre></div>
        </div>
    `).join('');

    container.innerHTML = `<h4>Running Activities (${running.length})</h4>${html}`;
}

// Render simplified current activities for the right column
function renderCurrentActivitiesSimple(instance) {
    const container = document.getElementById('current-activities-simple');
    if (!container) return;
    
    if (!instance || !instance.activities) {
        container.innerHTML = '<p style="color: #6c757d; font-style: italic;">No running instance</p>';
        return;
    }

    // Get all activities with their status
    const activities = Object.entries(instance.activities).map(([id, activity]) => ({
        id,
        name: activity.name || id,
        type: activity.type,
        status: activity.status
    }));

    // Separate running and completed activities
    const running = activities.filter(a => a.status === 'running');
    const completed = activities.filter(a => a.status === 'completed');

    let html = '';
    
    if (running.length > 0) {
        html += '<ul class="activity-list">';
        running.forEach(activity => {
            html += `
                <li class="activity-item running">
                    <div class="activity-name">${activity.name}</div>
                    <div class="activity-type">${activity.type}</div>
                </li>
            `;
        });
        html += '</ul>';
    }
    
    if (completed.length > 0 && running.length === 0) {
        // Show most recent completed activity if nothing is running
        const recent = completed[completed.length - 1];
        html += `
            <ul class="activity-list">
                <li class="activity-item completed">
                    <div class="activity-name">${recent.name}</div>
                    <div class="activity-type">${recent.type} (completed)</div>
                </li>
            </ul>
        `;
    }
    
    if (html === '') {
        html = '<p style="color: #6c757d; font-style: italic;">No activities</p>';
    }
    
    container.innerHTML = html;
}

// Render simplified instance status for the right column
function renderInstanceStatusSimple(instance) {
    const container = document.getElementById('instance-status-simple');
    if (!container) return;
    
    if (!instance) {
        container.innerHTML = '<p style="color: #6c757d; font-style: italic;">No running instance</p>';
        return;
    }

    const statusEmoji = {
        'running': '▶️',
        'completed': '✅',
        'failed': '❌',
        'cancelled': '⏹️'
    }[instance.status] || '❓';

    let aggregateHtml = '';
    if (instance.aggregatePassFail) {
        const aggregateDisplay = {
            'all_pass': '✅ All Pass',
            'any_fail': '❌ Contains Failures'
        }[instance.aggregatePassFail] || instance.aggregatePassFail;
        aggregateHtml = `<div class="aggregate-status ${instance.aggregatePassFail}" style="margin-top: 8px;">${aggregateDisplay}</div>`;
    }

    const html = `
        <div class="instance-summary">
            <div class="instance-status">${statusEmoji} ${instance.status}</div>
            <div class="instance-id">ID: ${instance.instanceId}</div>
            ${aggregateHtml}
        </div>
    `;
    
    container.innerHTML = html;
}

// Initialize the demo by loading available processes
async function initializeDemo() {
    try {
        await loadAvailableProcesses();
    } catch (error) {
        console.error('Failed to initialize demo:', error);
        showStatus('Failed to load processes. Please refresh the page.', 'error');
    }
}

// Load available processes from the API and populate the UI
async function loadAvailableProcesses() {
    try {
        const response = await fetch(`${API_BASE}/processes`);
        const result = await response.json();
        
        if (result.success) {
            const processes = result.data || [];
            availableProcesses = {};
            
            // Build process lookup map
            processes.forEach(process => {
                availableProcesses[process.id] = process;
            });
            
            // Generate process cards
            renderProcessCards(processes);
            
            // Update process select dropdown
            updateProcessSelect(processes);
            
            // Update instance process select dropdown
            updateInstanceProcessSelect();
            
            // loaded processes (quiet)
        } else {
            showStatus('Failed to load processes from server', 'error');
            renderProcessCards([]);
        }
    } catch (error) {
        console.error('Error loading processes:', error);
        showStatus('Error loading processes from server', 'error');
        renderProcessCards([]);
    }
}

// Render process cards dynamically
function renderProcessCards(processes) {
    const grid = document.getElementById('process-grid');
    const loading = document.getElementById('process-loading');
    
    if (processes.length === 0) {
        grid.innerHTML = '<div class="process-card"><p>No processes available. Check server logs for details.</p></div>';
        return;
    }
    
    // Get emoji for process type (you can expand this)
    const getProcessEmoji = (processId) => {
        const emojiMap = {
            'hello-world': '👋',
            'approval-workflow': '📋',
            'employee-onboarding': '👨‍💼',
            'user-registration-workflow': '📝'
        };
        return emojiMap[processId] || '⚙️';
    };
    
    const cardsHtml = processes.map(process => `
        <div class="process-card">
            <h3>${getProcessEmoji(process.id)} ${process.name}</h3>
            <p>${process.description || 'No description available'}</p>
            <button class="btn btn-secondary" data-action="view-process" data-process="${process.id}">View JSON</button>
        </div>
    `).join('');
    
    grid.innerHTML = cardsHtml;
}

async function viewProcess(processId) {
    try {
        showStatus('Loading full process definition...', 'info');

        // Load the complete process definition from the API
        const response = await fetch(`${API_BASE}/processes/${processId}`);
        const result = await response.json();

        if (!result.success) {
            showStatus(`❌ Failed to load process: ${result.error}`, 'error');
            return;
        }

        const processData = result.data;
        if (!processData) {
            showStatus(`❌ Process "${processId}" not found`, 'error');
            return;
        }

        const popup = window.open('', '_blank', 'width=800,height=600');
        popup.document.write(`
            <html>
                <head><title>Process: ${processData.name}</title></head>
                <body style="font-family: monospace; padding: 20px;">
                    <h2>${processData.name}</h2>
                    <pre>${JSON.stringify(processData, null, 2)}</pre>
                </body>
            </html>
        `);

        showStatus(`✅ Full process definition loaded for "${processData.name}"`, 'success');
    } catch (error) {
        showStatus(`❌ Error viewing process: ${error.message}`, 'error');
    }
}

async function listProcesses() {
    try {
        showStatus('Loading processes...', 'info');
        
        const response = await fetch(`${API_BASE}/processes`);
        const result = await response.json();
        
        if (result.success) {
            const processes = result.data || [];
            if (processes.length === 0) {
                showStatus('No processes loaded yet. Load a sample process first!', 'info');
            } else {
                        const processHtml = processes.map(p => `
                            <div class="instance-card">
                                <h4>${p.name} (${p.id})</h4>
                                <div class="meta">Version: ${p.version} | Description: ${p.description}</div>
                                <button class="btn" data-action="start-instance-by-id" data-process-id="${p.id}">Start Instance</button>
                            </div>
                        `).join('');                document.getElementById('management-results').innerHTML = `
                    <h3>Loaded Processes (${processes.length})</h3>
                    <div class="instance-list">${processHtml}</div>
                `;
            }
        } else {
            showStatus(`❌ Failed to list processes: ${result.error}`, 'error');
        }
    } catch (error) {
        showStatus(`❌ Error listing processes: ${error.message}`, 'error');
    }
}

async function listInstances() {
    const processId = document.getElementById('instance-process-select').value;
    if (!processId) {
        showStatus('Please select a process to list instances!', 'error');
        return;
    }

    try {
        showStatus('Loading instances...', 'info');

        const response = await fetch(`${API_BASE}/processes/${processId}/instances`);
        const result = await response.json();

        if (result.success) {
            const instances = result.data || [];
            renderInstanceList(instances, processId);
            showStatus(`Found ${instances.length} instances for process ${processId}`, 'success');
        } else {
            showStatus(`Failed to list instances: ${result.error}`, 'error');
            renderInstanceList([], processId);
        }
    } catch (error) {
        showStatus(`Error listing instances: ${error.message}`, 'error');
        renderInstanceList([], processId);
    }
}

async function updateProcessSelect(processes = null) {
    try {
        let processList = processes;
        
        if (!processList) {
            const response = await fetch(`${API_BASE}/processes`);
            const result = await response.json();
            processList = result.success ? result.data : [];
        }
        
        const select = document.getElementById('process-select');
        select.innerHTML = '<option value="">Select a loaded process...</option>';
        
        if (processList) {
            processList.forEach(process => {
                const option = document.createElement('option');
                option.value = process.id;
                option.textContent = `${process.name} (${process.id})`;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error updating process select:', error);
    }
}

function renderInstanceList(instances, processId) {
    const container = document.getElementById('instance-list');
    const processName = availableProcesses[processId]?.name || processId;

    if (instances.length === 0) {
        container.innerHTML = `<div class="instance-card">
            <p>No instances found for process "${processName}". Start a new instance to see it here.</p>
        </div>`;
        return;
    }

    const instancesHtml = instances.map(instance => {
        const statusEmoji = {
            'running': '▶️',
            'completed': '✅',
            'failed': '❌',
            'cancelled': '⏹️'
        }[instance.status] || '❓';

        const startedAt = new Date(instance.startedAt).toLocaleString();
        const completedAt = instance.completedAt ? new Date(instance.completedAt).toLocaleString() : 'Not completed';
        
        // Add aggregate pass/fail display
        let aggregateHtml = '';
        if (instance.aggregatePassFail) {
            const aggregateDisplay = {
                'all_pass': '✅ All Pass',
                'any_fail': '❌ Contains Failures'
            }[instance.aggregatePassFail] || instance.aggregatePassFail;
            aggregateHtml = `<div class="aggregate-status ${instance.aggregatePassFail}">Overall: ${aggregateDisplay}</div>`;
        }

        return `
            <div class="instance-card">
                <h4>${statusEmoji} Instance ${instance.instanceId}</h4>
                <div class="meta">
                    <div>Status: ${instance.status}</div>
                    <div>Started: ${startedAt}</div>
                    <div>Completed: ${completedAt}</div>
                    ${aggregateHtml}
                </div>
                <button class="btn btn-secondary" data-action="view-instance" data-instance="${instance.instanceId}">View Details</button>
                <button class="btn btn-primary" data-action="rerun-instance" data-instance="${instance.instanceId}">Re-run Process</button>
            </div>
        `;
    }).join('');

    container.innerHTML = `<h3>Instances for "${processName}"</h3>${instancesHtml}`;
}

function updateInstanceProcessSelect() {
    const select = document.getElementById('instance-process-select');
    select.innerHTML = '<option value="">Select a process...</option>';

    Object.values(availableProcesses).forEach(process => {
        const option = document.createElement('option');
        option.value = process.id;
        option.textContent = `${process.name} (${process.id})`;
        select.appendChild(option);
    });
}

async function viewInstance(instanceId) {
    try {
        showStatus('Loading instance details...', 'info');

        const response = await fetch(`${API_BASE}/instances/${instanceId}`);
        const result = await response.json();

        if (result.success) {
            const instance = result.data;
            const details = `
                <h4>Instance Details</h4>
                <pre>${JSON.stringify(instance, null, 2)}</pre>
            `;
            showStatus(details, 'info');
            // Render variables and running activities for the instance
            renderInstanceVariables(instance);
            renderRunningActivities(instance);
            // Also render simplified versions for the right column
            renderInstanceStatusSimple(instance);
            renderProcessVariablesSimple(instance);
            renderCurrentActivitiesSimple(instance);
                detectAndRenderFinishedActivities(instance);
        } else {
            showStatus(`Failed to load instance: ${result.error}`, 'error');
        }
    } catch (error) {
        console.error('Error loading instance', error);
        showStatus(`Error loading instance: ${error.message}`, 'error');
    }
}

async function rerunInstance(instanceId) {
    try {
        showStatus('Re-running process instance...', 'info');

        const response = await fetch(`${API_BASE}/instances/${instanceId}/rerun`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });

        const result = await response.json();

        if (result.success) {
            const newInstanceId = result.data.instanceId;
            showStatus(`✅ Process re-run successfully! New instance ID: ${newInstanceId}`, 'success');

            // Auto-execute until we hit a human task
            currentInstanceId = newInstanceId;
            await continueExecution();
        } else {
            console.error('Failed to re-run instance', result);
            showStatus(`❌ Failed to re-run instance: ${result.error}`, 'error');
        }
    } catch (error) {
        console.error('Error re-running instance', error);
        showStatus(`❌ Error re-running instance: ${error.message}`, 'error');
    }
}

async function navigateToStart() {
    if (!currentInstanceId) {
        showExecutionStatus('No active instance to navigate!', 'error');
        return;
    }

    try {
        showExecutionStatus('Navigating to start...', 'info');
        
        const response = await fetch(`${API_BASE}/instances/${currentInstanceId}/navigate/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });

        const result = await response.json();

        if (result.success) {
            showExecutionStatus(`✅ ${result.data.message}`, 'success');
            
            // Refresh the instance view
            const instanceResponse = await fetch(`${API_BASE}/instances/${currentInstanceId}`);
            const instanceResult = await instanceResponse.json();
            if (instanceResult.success && instanceResult.data) {
                renderInstanceStatusSimple(instanceResult.data);
                renderProcessVariablesSimple(instanceResult.data);
                renderCurrentActivitiesSimple(instanceResult.data);
                detectAndRenderFinishedActivities(instanceResult.data);
                
                // Check if the current activity is a human task and show the interface
                await checkAndShowHumanTask();
            }
        } else {
            showExecutionStatus(`❌ Navigation failed: ${result.error}`, 'error');
        }
    } catch (error) {
        console.error('Error navigating to start', error);
        showExecutionStatus(`❌ Error navigating to start: ${error.message}`, 'error');
    }
}

async function navigateToNextPending() {
    if (!currentInstanceId) {
        showExecutionStatus('No active instance to navigate!', 'error');
        return;
    }

    try {
        showExecutionStatus('Navigating to next pending...', 'info');
        
        const response = await fetch(`${API_BASE}/instances/${currentInstanceId}/navigate/next-pending`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });

        const result = await response.json();

        if (result.success) {
            if (result.data.status === 'completed') {
                showExecutionStatus(`✅ All activities completed!`, 'success');
            } else {
                showExecutionStatus(`✅ ${result.data.message}`, 'success');
            }
            
            // Refresh the instance view
            const instanceResponse = await fetch(`${API_BASE}/instances/${currentInstanceId}`);
            const instanceResult = await instanceResponse.json();
            if (instanceResult.success && instanceResult.data) {
                renderInstanceStatusSimple(instanceResult.data);
                renderProcessVariablesSimple(instanceResult.data);
                renderCurrentActivitiesSimple(instanceResult.data);
                detectAndRenderFinishedActivities(instanceResult.data);
                
                // Check if the current activity is a human task and show the interface
                await checkAndShowHumanTask();
            }
        } else {
            showExecutionStatus(`❌ Navigation failed: ${result.error}`, 'error');
        }
    } catch (error) {
        console.error('Error navigating to next pending', error);
        showExecutionStatus(`❌ Error navigating to next pending: ${error.message}`, 'error');
    }
}

// Helper function to check if current activity is a human task and show the interface
async function checkAndShowHumanTask() {
    if (!currentInstanceId) return;
    
    try {
        // Check for current human task
        const taskResponse = await fetch(`${API_BASE}/instances/${currentInstanceId}/current-task`);
        const taskResult = await taskResponse.json();
        
        if (taskResult.success && taskResult.data.humanTask) {
            // Show human task interface
            showHumanTask(taskResult.data.humanTask);
            if (taskResult.data.instance) {
                renderInstanceVariables(taskResult.data.instance);
                renderRunningActivities(taskResult.data.instance);
            }
        } else {
            // Hide human task interface if no human task
            hideHumanTaskInterface();
        }
    } catch (error) {
        console.error('Error checking for human task', error);
    }
}

async function startInstance() {
    const processId = document.getElementById('process-select').value;
    if (!processId) {
        showExecutionStatus('Please select a process first!', 'error');
        return;
    }
    
    await startInstanceById(processId);
}

async function startInstanceById(processId) {
    try {
        showExecutionStatus('Starting process instance...', 'info');
        
        const response = await fetch(`${API_BASE}/processes/${processId}/instances`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        
        const result = await response.json();
        
        if (result.success) {
            currentInstanceId = result.data.instanceId;
            showExecutionStatus(`✅ Instance started! ID: ${currentInstanceId}`, 'success');
            
            // Auto-execute until we hit a human task
            await continueExecution();
        } else {
            console.error('Failed to start instance', result);
            showExecutionStatus(`❌ Failed to start instance: ${result.error}`, 'error');
        }
    } catch (error) {
        console.error('Error starting instance', error);
        showExecutionStatus(`❌ Error starting instance: ${error.message}`, 'error');
    }
}

async function continueExecution() {
    if (!currentInstanceId) return;
    
    try {
        // Check for current human task first
        const taskResponse = await fetch(`${API_BASE}/instances/${currentInstanceId}/current-task`);
        const taskResult = await taskResponse.json();
        
        if (taskResult.success && taskResult.data.humanTask) {
            // Show human task interface
            showHumanTask(taskResult.data.humanTask);
            if (taskResult.data.instance) {
                renderInstanceVariables(taskResult.data.instance);
                renderRunningActivities(taskResult.data.instance);
                renderInstanceStatusSimple(taskResult.data.instance);
                renderProcessVariablesSimple(taskResult.data.instance);
                renderCurrentActivitiesSimple(taskResult.data.instance);
                    detectAndRenderFinishedActivities(taskResult.data.instance);
            }
            return;
        }
        
        // Execute next step
        const stepResponse = await fetch(`${API_BASE}/instances/${currentInstanceId}/step`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        
        const stepResult = await stepResponse.json();
        
    if (stepResult.success) {
            // step result processed (quiet)
            if (stepResult.data && stepResult.data.instance) {
                renderInstanceVariables(stepResult.data.instance);
                renderRunningActivities(stepResult.data.instance);
                renderInstanceStatusSimple(stepResult.data.instance);
                renderProcessVariablesSimple(stepResult.data.instance);
                renderCurrentActivitiesSimple(stepResult.data.instance);
                    detectAndRenderFinishedActivities(stepResult.data.instance);
            }
            if (stepResult.data.status === 'completed') {
                showExecutionStatus(`🎉 Process completed successfully!`, 'success');
                hideHumanTaskInterface();
            } else if (stepResult.data.status === 'failed') {
                showExecutionStatus(`❌ Process failed: ${stepResult.data.message}`, 'error');
                hideHumanTaskInterface();
            } else if (stepResult.data.status === 'waiting') {
                // Check for human task again
                setTimeout(() => continueExecution(), 500);
            } else {
                // unhandled step result status (quiet)
                showExecutionStatus(`📋 Step executed: ${stepResult.data.message || 'Unknown step'}`, 'info');
                // Continue execution
                setTimeout(() => continueExecution(), 500);
            }
        } else {
            console.error('Step execution error', stepResult);
            showExecutionStatus(`❌ Execution error: ${stepResult.error}`, 'error');
        }
    } catch (error) {
        console.error('Error during execution', error);
        showExecutionStatus(`❌ Error during execution: ${error.message}`, 'error');
    }
}

function showHumanTask(humanTask) {
    currentActivityId = humanTask.activityId;
    
    document.getElementById('task-title').textContent = `Human Task: ${humanTask.activityId}`;
    document.getElementById('task-prompt').textContent = humanTask.prompt || 'Please complete this task:';
    
    
    // Generate form inputs
    const inputsDiv = document.getElementById('task-inputs');
    const fields = humanTask.fields || [];
    
    inputsDiv.innerHTML = fields.map(field => {
        // Use field.value (runtime value from FieldValue interface)
        const fieldValue = field.value !== undefined ? field.value : '';
        
        if (field.type === 'select') {
            // field.options is ValueOption[]
            const options = field.options ? field.options.map(opt => {
                const val = opt.value;
                const label = opt.label !== undefined ? opt.label : String(opt.value);
                const selected = String(fieldValue) === String(val) ? 'selected' : '';
                return `<option value="${val}" ${selected}>${label}</option>`;
            }).join('') : '';
            return `
                <div class="form-group">
                    <label for="field-${field.name}" title="${field.hint || ''}">${field.label || field.name}:</label>
                    <select id="field-${field.name}" name="${field.name}" ${field.required ? 'required' : ''}>
                        <option value="">Select...</option>
                        ${options}
                    </select>
                    ${field.hint ? `<small class="field-hint">${field.hint}</small>` : ''}
                </div>
            `;
        } else if (field.type === 'boolean') {
            const selectedTrue = fieldValue === true || fieldValue === 'true';
            const selectedFalse = fieldValue === false || fieldValue === 'false';
            return `
                <div class="form-group">
                    <label for="field-${field.name}" title="${field.hint || ''}">${field.label || field.name}:</label>
                    <select id="field-${field.name}" name="${field.name}" data-original-type="boolean" ${field.required ? 'required' : ''}>
                        <option value="">choose</option>
                        <option value="true" ${selectedTrue ? 'selected' : ''}>true</option>
                        <option value="false" ${selectedFalse ? 'selected' : ''}>false</option>
                    </select>
                    ${field.hint ? `<small class="field-hint">${field.hint}</small>` : ''}
                </div>
            `;
        } else {
            // Add pattern attributes and description for text fields
            const patternAttr = field.pattern ? `pattern="${field.pattern}"` : '';
            const titleAttr = field.patternDescription ? `title="${field.patternDescription}"` : '';
            const description = field.patternDescription ? 
                `<small class="pattern-description">${field.patternDescription}</small>` : '';

            // For numeric inputs allow floating point values by setting step="any"
            const stepAttr = field.type === 'number' ? 'step="any"' : '';
            const minAttr = (field.min !== undefined && field.min !== null) ? `min="${field.min}"` : '';
            const maxAttr = (field.max !== undefined && field.max !== null) ? `max="${field.max}"` : '';

            return `
                <div class="form-group">
                    <label for="field-${field.name}" title="${field.hint || ''}">${field.label || field.name}:</label>
                    <input 
                        type="${field.type || 'text'}" 
                        id="field-${field.name}" 
                        name="${field.name}"
                        placeholder="${field.placeholder || ''}"
                        value="${fieldValue}"
                        ${field.required ? 'required' : ''}
                        ${stepAttr}
                        ${minAttr}
                        ${maxAttr}
                        ${patternAttr}
                        ${titleAttr}
                    >
                    ${description}
                    ${field.hint ? `<small class="field-hint">${field.hint}</small>` : ''}
                </div>
            `;
        }
    }).join('');
    
    document.getElementById('human-task-interface').classList.remove('hidden');
    showTaskStatus('Please complete the human task above and click Submit.', 'info');
}

function hideHumanTaskInterface() {
    document.getElementById('human-task-interface').classList.add('hidden');
    currentActivityId = null;
}

async function submitHumanTask(event) {
    event.preventDefault();
    
    if (!currentInstanceId || !currentActivityId) {
        showTaskStatus('No active task to submit!', 'error');
        return;
    }
    
    try {
        showTaskStatus('Submitting task...', 'info');
        
        // Collect form data
        const formData = new FormData(event.target);
        const taskData = {};
        
        for (const [key, value] of formData.entries()) {
            const input = document.getElementById(`field-${key}`);
            if (input) {
                if (input.tagName === 'INPUT' && input.type === 'checkbox') {
                    taskData[key] = input.checked;
                } else if (input.tagName === 'SELECT' && input.dataset.originalType === 'boolean') {
                    // Boolean select: 'true'->true, 'false'->false, ''->undefined
                    if (value === 'true') taskData[key] = true;
                    else if (value === 'false') taskData[key] = false;
                    else taskData[key] = undefined;
                } else {
                    taskData[key] = value;
                }
            } else {
                taskData[key] = value;
            }
        }
        
        const response = await fetch(`${API_BASE}/instances/${currentInstanceId}/activities/${currentActivityId}/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(taskData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showTaskStatus('✅ Task submitted successfully!', 'success');
            hideHumanTaskInterface();
            // If submission returned updated instance snapshot, render it
            if (result.data && result.data.instance) {
                renderInstanceVariables(result.data.instance);
                renderRunningActivities(result.data.instance);
                renderInstanceStatusSimple(result.data.instance);
                renderProcessVariablesSimple(result.data.instance);
                renderCurrentActivitiesSimple(result.data.instance);
                    detectAndRenderFinishedActivities(result.data.instance);
            }

            // Continue execution
            setTimeout(() => continueExecution(), 1000);
        } else {
            console.error('Human task submission failed', result);
            showTaskStatus(`❌ Failed to submit task: ${result.error}`, 'error');
        }
    } catch (error) {
        console.error('Error submitting human task', error);
        showTaskStatus(`❌ Error submitting task: ${error.message}`, 'error');
    }
}

function clearResults() {
    document.getElementById('management-results').innerHTML = '';
    document.getElementById('execution-results').innerHTML = '';
    document.getElementById('task-results').innerHTML = '';
    hideHumanTaskInterface();
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Set up event listeners
    document.getElementById('human-task-form').addEventListener('submit', submitHumanTask);
    // Copy variables button
    const copyBtn = document.getElementById('copy-vars-btn');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            const varsEl = document.getElementById('instance-variables');
            if (!varsEl) return;
            // Extract the JSON content from the panel (best-effort)
            try {
                // Attempt to build JSON from last known instance if available
                const pre = varsEl.querySelector('pre');
                if (pre) {
                    navigator.clipboard.writeText(pre.textContent || pre.innerText || '');
                } else {
                    // Fall back to concatenated var rows
                    const rows = Array.from(varsEl.querySelectorAll('.var-row')).map(r => r.textContent).join('\n');
                    navigator.clipboard.writeText(rows);
                }
                showStatus('✅ Variables copied to clipboard', 'success');
            } catch (err) {
                showStatus('❌ Failed to copy variables', 'error');
            }
        });
    }
    
    // Initialize the demo by loading processes
    initializeDemo();
    
    // Event delegation for data-action buttons (CSP compliance)
    document.addEventListener('click', function(event) {
        const button = event.target.closest('[data-action]');
        if (!button) return;
        
        const action = button.getAttribute('data-action');
        const process = button.getAttribute('data-process');
        const instance = button.getAttribute('data-instance');
        
        switch(action) {
            case 'view-process':
                if (process) viewProcess(process);
                break;
            case 'list-processes':
                listProcesses();
                break;
            case 'list-instances':
                listInstances();
                break;
            case 'clear-results':
                clearResults();
                break;
            case 'start-instance':
                startInstance();
                break;
            case 'start-instance-by-id':
                const processId = button.getAttribute('data-process-id');
                if (processId) startInstanceById(processId);
                break;
            case 'view-instance':
                if (instance) viewInstance(instance);
                break;
            case 'rerun-instance':
                if (instance) rerunInstance(instance);
                break;
            case 'continue-execution':
                continueExecution();
                break;
            case 'navigate-start':
                navigateToStart();
                break;
            case 'navigate-next-pending':
                navigateToNextPending();
                break;
        }
    });
});