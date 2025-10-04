module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
      useESM: true
    }],
  },
  extensionsToTreatAsEsm: ['.ts'],
  // Transform ESM-only dependencies like `uuid` by excluding them from the ignore pattern
  transformIgnorePatterns: ['node_modules/(?!(uuid)/)'],
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json', useESM: true }],
    '^.+\\.js$': ['ts-jest', { tsconfig: 'tsconfig.json', useESM: true }]
  },
  globals: {
    'ts-jest': {
      useESM: true
    }
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/index.ts',
    '!src/**/*.d.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
};