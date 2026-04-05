/* eslint-disable @typescript-eslint/no-explicit-any */
// Setup all mocks BEFORE any imports
jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn().mockResolvedValue(undefined),
  getStringAsync: jest.fn().mockResolvedValue(''),
}));

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

// Mock expo-secure-store (native module used by Security)
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import HomeScreen from '../HomeScreen';

const Stack = createNativeStackNavigator();

const mockAsyncStorageWithItems = (items: any[]) => {
  // Keys must match getItems requirements: start with _ali_ and include name
  const keys = items.map((item) => `_ali_${item.name}`);
  (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue(keys);
  (AsyncStorage.multiGet as jest.Mock).mockImplementation((requestedKeys) => {
    return Promise.resolve(
      requestedKeys.map((key: string) => {
        const name = key.replace('_ali_', '');
        const item = items.find((i) => i.name === name);
        return [key, item ? JSON.stringify(item) : null];
      })
    );
  });
};

describe('HomeScreen - Rendering Tests', () => {
  const mockUser = { uid: 'test-user-123', isAnonymous: false };

  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([]);
    (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([]);
  });

  it('renders items', async () => {
    mockAsyncStorageWithItems([
      {
        name: 'item1',
        value: 'value1',
        timestamp: 1,
        userId: mockUser.uid,
        encrypted: false,
      },
    ]);

    render(
      <SafeAreaProvider>
        <NavigationContainer>
          <Stack.Navigator>
            <Stack.Screen
              name="Home"
              component={HomeScreen}
              initialParams={{ user: mockUser, itemsReload: 0 }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('item1')).toBeTruthy();
    });
  });
});
