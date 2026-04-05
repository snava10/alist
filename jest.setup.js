// Add custom jest matchers or global setup here
// This file is loaded before all tests

import '@testing-library/jest-native/extend-expect';

// These two libraries depend on native code (Obj-C/Java) that doesn't exist
// in the Node.js test environment. Without these mocks:
// - SafeAreaProvider renders an empty <RNCSafeAreaProvider/> that swallows children
// - Native stack screens can't render without native UIViewController/Fragment

jest.mock('react-native-screens', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    enableScreens: jest.fn(),
    screensEnabled: jest.fn().mockReturnValue(true),
    Screen: ({ children }) => React.createElement(View, null, children),
    ScreenContainer: ({ children }) => React.createElement(View, null, children),
    ScreenStack: ({ children }) => React.createElement(View, null, children),
    NativeScreen: ({ children }) => React.createElement(View, null, children),
    NativeScreenContainer: ({ children }) => React.createElement(View, null, children),
    ScreenStackHeaderConfig: () => null,
    SearchBar: View,
  };
});

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { width: 320, height: 640, x: 0, y: 0 };
  const InsetsContext = React.createContext(insets);
  const FrameContext = React.createContext(frame);
  return {
    SafeAreaProvider: ({ children }) =>
      React.createElement(
        FrameContext.Provider,
        { value: frame },
        React.createElement(InsetsContext.Provider, { value: insets }, children)
      ),
    SafeAreaInsetsContext: InsetsContext,
    SafeAreaFrameContext: FrameContext,
    useSafeAreaInsets: () => insets,
    useSafeAreaFrame: () => frame,
    initialWindowMetrics: { frame, insets },
    SafeAreaView: ({ children }) =>
      React.createElement(require('react-native').View, null, children),
  };
});

jest.mock('@react-native-firebase/analytics', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    logEvent: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Mock AsyncStorage instead of Storage module to allow Storage functions to execute
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    getAllKeys: jest.fn().mockResolvedValue([]),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
    multiGet: jest.fn().mockResolvedValue([]),
    clear: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock Firebase Firestore
jest.mock('@react-native-firebase/firestore', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn().mockResolvedValue({ exists: false, data: () => ({}) }),
        set: jest.fn().mockResolvedValue(undefined),
        update: jest.fn().mockResolvedValue(undefined),
      })),
    })),
    useEmulator: jest.fn(),
  })),
}));

// Mock Firebase Auth
jest.mock('@react-native-firebase/auth', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    currentUser: null,
    useEmulator: jest.fn(),
  })),
}));

// Mock base64
jest.mock('react-native-base64', () => ({
  encode: jest.fn((text) => text),
  decode: jest.fn((text) => text),
}));
