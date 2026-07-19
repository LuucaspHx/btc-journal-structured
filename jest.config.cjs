/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/*.test.js',
    '**/*.spec.js',
    '**/*.test.mjs',
    '**/*.spec.mjs'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/.claude/',
    '/coverage/',
    '/dist/',
  ],
  modulePathIgnorePatterns: [
    '<rootDir>/.claude/',
    '<rootDir>/coverage/',
    '<rootDir>/dist/',
  ],
  watchPathIgnorePatterns: [
    '/node_modules/',
    '/.claude/',
    '/coverage/',
    '/dist/',
  ],
  collectCoverageFrom: [
    'js/**/*.js',
    '!node_modules/**'
  ],
  coverageThreshold: {
    global: {
      statements: 14,
      branches: 14,
      functions: 20,
      lines: 15
    }
  }
};
