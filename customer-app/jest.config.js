module.exports = {
  testEnvironment: 'node',
  globals: { __DEV__: false },
  moduleNameMapper: {
    '^expo-constants$': '<rootDir>/test/expo-constants-mock.js',
    '^react-native$': '<rootDir>/test/react-native-mock.js',
  },
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(\\.pnpm|expo|@expo|expo-modules-core|@unimodules)/)',
  ],
};
