const pathsToModuleNameMapper = require('ts-jest').pathsToModuleNameMapper
const tsConfig = require('./tsconfig.json')

const pathsFromTsconfig = tsConfig.compilerOptions.paths

module.exports = {
  restoreMocks: true,
  clearMocks: true,
  resetMocks: true,
  moduleNameMapper: {
    ...pathsToModuleNameMapper(pathsFromTsconfig, {
      prefix: '<rootDir>',
    }),
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '@standardnotes/toast': 'identity-obj-proxy',
    '@standardnotes/styles': 'identity-obj-proxy',
    '@simplewebauthn/browser': 'identity-obj-proxy',
  },
  globals: {
    __WEB_VERSION__: '1.0.0',
  },
  transform: {
    /**
     * Transpile only: type-checking every test's import graph made this suite take ~10 minutes
     * in CI. Types are still checked by `yarn tsc` (lint and build), which covers the specs too.
     */
    '^.+\\.(ts|tsx|js|jsx)?$': ['ts-jest', { isolatedModules: true, tsconfig: '<rootDir>/tsconfig.jest.json' }],
    '\\.svg$': 'svg-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-error-boundary)/)',
  ],
  testEnvironment: 'jsdom',
}
