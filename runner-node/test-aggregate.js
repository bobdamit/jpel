const { ProcessEngine, InMemoryRepositories } = require('./dist/src/index.js');

async function testAggregatePassFail() {
    console.log('Testing aggregate passFail calculation...');
    
    // Initialize engine
    const repositories = InMemoryRepositories();
    const engine = new ProcessEngine(repositories.processDefinitionRepo, repositories.processInstanceRepo);
    
    // Test 1: Process with all PASS activities
    const allPassProcess = {
        id: 'all-pass-test',
        version: '1.0.0',
        name: 'All Pass Test',
        description: 'Test with all activities passing',
        start: 'a:step1',
        activities: {
            step1: {
                type: 'compute',
                code: 'activity.passFail = "pass"; activity.value = "step1 complete";',
                sequence: { next: 'a:step2' }
            },
            step2: {
                type: 'compute', 
                code: 'activity.passFail = "pass"; activity.value = "step2 complete";'
            }
        }
    };
    
    await engine.loadProcessDefinition(allPassProcess);
    const allPassInstance = await engine.createInstance('all-pass-test');
    await engine.executeNext(allPassInstance.id);
    
    const completedAllPass = await engine.getProcessInstance(allPassInstance.id);
    console.log('All Pass Result:', {
        status: completedAllPass.status,
        aggregatePassFail: completedAllPass.aggregatePassFail,
        activities: Object.keys(completedAllPass.activities).map(k => ({
            id: k,
            passFail: completedAllPass.activities[k].passFail
        }))
    });
    
    // Test 2: Process with mixed PASS/FAIL activities 
    const mixedProcess = {
        id: 'mixed-test',
        version: '1.0.0',
        name: 'Mixed Test',
        description: 'Test with mixed pass/fail',
        start: 'a:step1',
        activities: {
            step1: {
                type: 'compute',
                code: 'activity.passFail = "pass"; activity.value = "step1 complete";',
                sequence: { next: 'a:step2' }
            },
            step2: {
                type: 'compute',
                code: 'activity.passFail = "fail"; activity.value = "step2 failed";',
                sequence: { next: 'a:step3' }
            },
            step3: {
                type: 'compute',
                code: 'activity.value = "step3 complete (no passFail set)";'
            }
        }
    };
    
    await engine.loadProcessDefinition(mixedProcess);
    const mixedInstance = await engine.createInstance('mixed-test');
    await engine.executeNext(mixedInstance.id);
    
    const completedMixed = await engine.getProcessInstance(mixedInstance.id);
    console.log('Mixed Result:', {
        status: completedMixed.status,
        aggregatePassFail: completedMixed.aggregatePassFail,
        activities: Object.keys(completedMixed.activities).map(k => ({
            id: k,
            passFail: completedMixed.activities[k].passFail
        }))
    });
    
    // Test 3: Process with no passFail values set
    const noPassFailProcess = {
        id: 'no-passfail-test',
        version: '1.0.0',
        name: 'No PassFail Test',
        description: 'Test with no passFail values',
        start: 'a:step1',
        activities: {
            step1: {
                type: 'compute',
                code: 'activity.value = "step1 complete";'
            }
        }
    };
    
    await engine.loadProcessDefinition(noPassFailProcess);
    const noPassFailInstance = await engine.createInstance('no-passfail-test');
    await engine.executeNext(noPassFailInstance.id);
    
    const completedNoPassFail = await engine.getProcessInstance(noPassFailInstance.id);
    console.log('No PassFail Result:', {
        status: completedNoPassFail.status,
        aggregatePassFail: completedNoPassFail.aggregatePassFail,
        activities: Object.keys(completedNoPassFail.activities).map(k => ({
            id: k,
            passFail: completedNoPassFail.activities[k].passFail
        }))
    });
    
    console.log('Test complete!');
}

testAggregatePassFail().catch(console.error);