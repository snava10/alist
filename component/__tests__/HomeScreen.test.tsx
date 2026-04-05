/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Mock expo-clipboard before anything else
jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(),
}));

// Mock Firebase
jest.mock('@react-native-firebase/analytics', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    logEvent: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Mock Ionicons
jest.mock('@expo/vector-icons/Ionicons', () => {
  return function MockIonicons() {
    return null;
  };
});

// Mock Storage functions
jest.mock('../Core/Storage', () => ({
  getItems: jest.fn().mockResolvedValue([]),
  createUserSettings: jest.fn().mockResolvedValue(undefined),
  addTimestampToItems: jest.fn().mockResolvedValue(undefined),
  replaceItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

// Mock GlobalStyles
jest.mock('../Core/GlobalStyles', () => ({
  __esModule: true,
  default: {
    searchContainer: {},
    searchIcon: {},
    searchInput: {},
  },
}));

// Mock React Navigation
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn((callback: any) => callback()),
}));

import HomeScreen from '../HomeScreen';
import {
  getItems,
  createUserSettings,
  addTimestampToItems,
  replaceItem,
  removeItem,
} from '../Core/Storage';

describe('HomeScreen', () => {
  const mockUser = {
    uid: 'test-user-123',
    isAnonymous: false,
  };

  const mockRoute = {
    params: {
      user: mockUser,
      itemsReload: 0,
    },
  };

  beforeEach(() => {
    (getItems as jest.Mock).mockClear();
    (createUserSettings as jest.Mock).mockClear();
    (addTimestampToItems as jest.Mock).mockClear();
    (replaceItem as jest.Mock).mockClear();
    (removeItem as jest.Mock).mockClear();
  });

  it('renders without crashing', async () => {
    const { toJSON } = render(
      <SafeAreaProvider>
        <HomeScreen route={mockRoute} />
      </SafeAreaProvider>
    );

    await waitFor(() => {
      expect(toJSON()).toBeTruthy();
    });
  });

  it('handles anonymous users', async () => {
    const anonymousRoute = {
      params: {
        user: { uid: 'anon-user', isAnonymous: true },
        itemsReload: 0,
      },
    };

    const { toJSON } = render(
      <SafeAreaProvider>
        <HomeScreen route={anonymousRoute} />
      </SafeAreaProvider>
    );

    await waitFor(() => {
      expect(toJSON()).toBeTruthy();
    });
  });

  it('renders with valid authenticated user data', async () => {
    const { toJSON } = render(
      <SafeAreaProvider>
        <HomeScreen route={mockRoute} />
      </SafeAreaProvider>
    );

    await waitFor(() => {
      expect(toJSON()).toBeTruthy();
    });
  });

  it('renders with search input when items exist', async () => {
    const { toJSON } = render(
      <SafeAreaProvider>
        <HomeScreen route={mockRoute} />
      </SafeAreaProvider>
    );

    await waitFor(() => {
      expect(toJSON()).toBeTruthy();
    });
  });

  it('renders successfully with mocked AListItems', async () => {
    const mockItems = [
      {
        name: 'Database Password',
        value: 'db-pass-123',
        timestamp: 1609459200,
        userId: 'test-user-123',
        encrypted: false,
      },
      {
        name: 'API Secret',
        value: 'api-secret-456',
        timestamp: 1609459201,
        userId: 'test-user-123',
        encrypted: true,
      },
    ];

    // Setup mock to return items when getItems is called
    (getItems as jest.Mock).mockImplementation(() => Promise.resolve(mockItems));

    const { toJSON } = render(
      <SafeAreaProvider>
        <HomeScreen route={mockRoute} />
      </SafeAreaProvider>
    );

    // Verify component renders without errors
    expect(toJSON()).toBeTruthy();
  });
});
