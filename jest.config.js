// ====================================
// AVENLO CORE - ROOT JEST CONFIG (v2.0)
// ts-jest powered, workspace-aware.
// ====================================

/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  testEnvironment: 'node',
  // Ensure a clean exit in CI even if a driver leaves a socket/timer open.
  forceExit: true,
  roots: ['<rootDir>/packages', '<rootDir>/services'],
  testMatch: ['**/*.test.ts', '**/*.spec.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/build/'],
  // mongodb-memory-server downloads a binary on first run; give it room.
  testTimeout: 120000,
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        isolatedModules: true,
        tsconfig: {
          module: 'commonjs',
          target: 'ES2022',
          lib: ['ES2022'],
          moduleResolution: 'node',
          esModuleInterop: true,
          resolveJsonModule: true,
          skipLibCheck: true,
          strict: true,
        },
      },
    ],
  },
};
