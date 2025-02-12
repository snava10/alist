module.exports = {
  maxConcurrency: 10,
  preset: "jest-expo",
  testEnvironment: "node", // Keep the Node.js test environment
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|@gluestack-ui)",
  ],
  setupFiles: ["./jestSetup/jest.setup.ts"],
  // setupFiles: ["./jestSetup/jestSetup.js"],
  // testMatch: ["./__tests__/**/*.test.(tsx|ts|js)"],
  modulePaths: ["<rootDir>/src"], // Allow module resolution from `src`
};
