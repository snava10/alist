// Jest config for Firestore rules tests only. These tests need a
// running Firestore emulator and must not run under the main Jest
// config (whose React Native mocks would apply). Run them with
// `npm run test:rules` while the emulator is running; the tests upload
// firestore.rules to that emulator before running.
module.exports = {
  rootDir: __dirname,
  testEnvironment: 'node',
  testMatch: ['<rootDir>/firebase-emulator/firestore.rules.test.ts'],
  transform: {
    '^.+\\.[jt]sx?$': 'babel-jest',
  },
};
