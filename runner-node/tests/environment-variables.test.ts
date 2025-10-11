import { resolveInlineTemplate } from '../src/utils/substitution';
import { ProcessInstance } from '../src/models/instance-types';
import { ProcessStatus, FieldType } from '../src/models/process-types';

describe('Environment Variable Substitution', () => {
    let mockInstance: ProcessInstance;

    beforeEach(() => {
        // Set up a mock process instance
        mockInstance = {
            instanceId: 'test-instance',
            processId: 'test-process',
            status: ProcessStatus.Running,
            startedAt: new Date(),
            executionContext: {} as any,
            variables: {
                testVar: 'process-value'
            },
            activities: {
                testActivity: {
                    id: 'testActivity',
                    name: 'Test Activity',
                    type: 'human' as any,
                    status: 'completed' as any,
                    variables: [
                        { name: 'activityVar', value: 'activity-value', type: FieldType.Text }
                    ]
                }
            }
        };

        // Set up test environment variables
        process.env.TEST_API_KEY = 'secret-key-123';
        process.env.TEST_BASE_URL = 'https://api.example.com';
    });

    afterEach(() => {
        // Clean up environment variables
        delete process.env.TEST_API_KEY;
        delete process.env.TEST_BASE_URL;
    });

    test('should substitute environment variables using env: pattern', () => {
        const template = 'API Key: env:TEST_API_KEY, Base URL: env:TEST_BASE_URL';
        const result = resolveInlineTemplate(template, mockInstance);
        
        expect(result).toBe('API Key: secret-key-123, Base URL: https://api.example.com');
    });

    test('should preserve placeholder for missing environment variables', () => {
        const template = 'Missing: env:MISSING_VAR, Existing: env:TEST_API_KEY';
        const result = resolveInlineTemplate(template, mockInstance);
        
        expect(result).toBe('Missing: env:MISSING_VAR, Existing: secret-key-123');
    });

    test('should work with mixed variable types', () => {
        const template = 'Process: process.testVar, Activity: a:testActivity.v:activityVar, Env: env:TEST_API_KEY';
        const result = resolveInlineTemplate(template, mockInstance);
        
        expect(result).toBe('Process: process-value, Activity: activity-value, Env: secret-key-123');
    });

    test('should handle environment variables in API configuration', () => {
        const apiUrl = 'env:TEST_BASE_URL/users/a:testActivity.v:activityVar';
        const result = resolveInlineTemplate(apiUrl, mockInstance);
        
        expect(result).toBe('https://api.example.com/users/activity-value');
    });

    test('should handle environment variables in headers', () => {
        const authHeader = 'Bearer env:TEST_API_KEY';
        const result = resolveInlineTemplate(authHeader, mockInstance);
        
        expect(result).toBe('Bearer secret-key-123');
    });
});