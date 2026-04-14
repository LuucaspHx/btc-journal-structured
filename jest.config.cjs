/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/*.test.js',
    '**/*.spec.js',
    '**/*.test.mjs',
    '**/*.spec.mjs'
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
