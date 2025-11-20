module.exports = {
  preset: 'react-native',
  testEnvironment: 'node',
  transformIgnorePatterns: [
    'node_modules/(?!((react-native' +
      '|@react-native' +
      '|@react-native-community' +
      '|react-native-.*' +
      '|@noble/hashes' +
      '))/)',
  ],
  modulePathIgnorePatterns: [
    '<rootDir>/example/node_modules',
    '<rootDir>/lib/',
  ],
};
