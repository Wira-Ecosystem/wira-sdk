module.exports = {
  overrides: [
    {
      exclude: /\/node_modules\//,
      presets: ['module:react-native-builder-bob/babel-preset'],
      plugins: [
        ['babel-plugin-transform-import-meta', { module: 'ES6' }], // transform import.meta in wira-sdk code
      ],
    },
    {
      include: /\/node_modules\//,
      presets: ['module:@react-native/babel-preset'],
    },
  ],
};
