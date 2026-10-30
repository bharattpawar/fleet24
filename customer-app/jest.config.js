module.exports = {
  testEnvironment: 'node',
  moduleNameMapper: {
    '^react-native$': '<rootDir>/test/react-native-mock.js',
  },
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },
};
