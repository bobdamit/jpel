// Jest test setup

// Mock console methods to reduce noise in tests
const originalConsole = global.console;
global.console = {
  ...originalConsole,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

// Mock process.stdout for tests
const mockStdout = {
  write: jest.fn(),
};
Object.defineProperty(process, 'stdout', {
  value: mockStdout,
  writable: true,
});

// Helper function to create mock process instances
export function createMockProcessInstance(overrides = {}) {
  return {
    instanceId: 'test-instance-123',
    processId: 'test-process',
    status: 'running',
    startedAt: new Date().toISOString(),
    currentActivity: 'test-activity',
    variables: {},
    activities: {},
    ...overrides,
  };
}

// Helper function to create mock process definitions
export function createMockProcessDefinition(overrides = {}) {
  return {
    id: 'test-process',
    name: 'Test Process',
    description: 'A test process',
    version: '1.0.0',
    start: 'a:testActivity',
    variables: [],
    activities: {
      testActivity: {
        id: 'testActivity',
        name: 'Test Activity',
        type: 'human',
        prompt: 'Test prompt',
        inputs: [],
      },
    },
    ...overrides,
  };
}

// Helper function to create mock activity instances
export function createMockActivityInstance(overrides = {}) {
  return {
    id: 'test-activity',
    type: 'human',
    status: 'completed',
    passFail: 'pass',
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    data: {},
    ...overrides,
  };
}