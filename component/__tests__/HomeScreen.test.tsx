/* eslint-disable @typescript-eslint/no-explicit-any */
// Setup all mocks BEFORE any imports
jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn().mockResolvedValue(undefined),
  getStringAsync: jest.fn().mockResolvedValue(''),
}));

// Mock expo-secure-store (native module used by Security)
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../Core/Security', () => ({
  encrypt: jest.fn().mockResolvedValue('encrypted-value'),
  decrypt: jest.fn().mockResolvedValue('decrypted-value'),
  getRSAKeys: jest.fn().mockResolvedValue({
    public: 'public-key',
    private: 'private-key',
  }),
}));

const mockLogEvent = jest.fn().mockResolvedValue(undefined);
jest.mock('@react-native-firebase/analytics', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    logEvent: mockLogEvent,
  })),
}));

const mockCreateUserSettings = jest
  .fn()
  .mockResolvedValue({ userId: 'test', backup: 'DAILY', membership: 'FREE' });
const mockAddTimestampToItems = jest.fn().mockResolvedValue([]);

jest.mock('../Core/Storage', () => ({
  ...jest.requireActual('../Core/Storage'),
  createUserSettings: (...args: any[]) => mockCreateUserSettings(...args),
  addTimestampToItems: (...args: any[]) => mockAddTimestampToItems(...args),
}));

import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import HomeScreen from '../HomeScreen';

const Stack = createNativeStackNavigator();

const renderHomeScreen = (params: any) =>
  render(
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen name="Home" component={HomeScreen} initialParams={params} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );

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
  const mockAnonymousUser = { uid: 'anon-user', isAnonymous: true };

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

    renderHomeScreen({ user: mockUser, itemsReload: 0 });

    await waitFor(() => {
      expect(screen.getByText('item1')).toBeTruthy();
    });
  });

  it('renders empty state when no items exist', async () => {
    renderHomeScreen({ user: mockUser, itemsReload: 0 });

    await waitFor(() => {
      expect(screen.getByText(/to add a new item/)).toBeTruthy();
    });
  });

  it('renders with anonymous user', async () => {
    renderHomeScreen({ user: mockAnonymousUser, itemsReload: 0 });

    await waitFor(() => {
      expect(screen.getByText(/to add a new item/)).toBeTruthy();
    });
  });

  it('filters items with search text', async () => {
    mockAsyncStorageWithItems([
      { name: 'apple', value: 'v1', timestamp: 1, encrypted: false },
      { name: 'banana', value: 'v2', timestamp: 2, encrypted: false },
    ]);

    renderHomeScreen({ user: mockUser, itemsReload: 0 });

    await waitFor(() => {
      expect(screen.getByText('apple')).toBeTruthy();
    });

    const searchInput = screen.getByPlaceholderText('Search...');
    fireEvent.changeText(searchInput, 'apple');

    // Mock filtered results
    (AsyncStorage.multiGet as jest.Mock).mockImplementation((keys) =>
      Promise.resolve(
        keys
          .filter((k: string) => k.includes('apple'))
          .map((k: string) => [
            k,
            JSON.stringify({ name: 'apple', value: 'v1', timestamp: 1, encrypted: false }),
          ])
      )
    );

    await waitFor(() => {
      expect(screen.getByText('apple')).toBeTruthy();
    });
  });

  it('clears search text', async () => {
    mockAsyncStorageWithItems([{ name: 'apple', value: 'v1', timestamp: 1, encrypted: false }]);

    renderHomeScreen({ user: mockUser, itemsReload: 0 });

    await waitFor(() => {
      expect(screen.getByText('apple')).toBeTruthy();
    });

    const searchInput = screen.getByPlaceholderText('Search...');
    fireEvent.changeText(searchInput, 'test');

    fireEvent.changeText(searchInput, '');

    await waitFor(() => {
      expect(screen.getByText('apple')).toBeTruthy();
    });
  });

  it('opens add item modal via FAB button', async () => {
    renderHomeScreen({ user: mockUser, itemsReload: 0 });

    await waitFor(() => {
      expect(screen.getByText(/to add a new item/)).toBeTruthy();
    });

    fireEvent.press(screen.getAllByTestId('add-circle')[1]!);

    await waitFor(() => {
      expect(screen.getByText('Save')).toBeTruthy();
    });
  });

  it('removes an item via confirmation modal', async () => {
    mockAsyncStorageWithItems([{ name: 'item1', value: 'value1', timestamp: 1, encrypted: false }]);

    renderHomeScreen({ user: mockUser, itemsReload: 0 });

    await waitFor(() => {
      expect(screen.getByText('item1')).toBeTruthy();
    });

    // Press the delete icon on the item
    fireEvent.press(screen.getByTestId('trash-outline'));

    await waitFor(() => {
      expect(screen.getByText('Yes')).toBeTruthy();
    });

    // Clear storage to simulate item being removed
    (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([]);
    (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([]);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);

    fireEvent.press(screen.getByText('Yes'));

    await waitFor(() => {
      expect(screen.getByText(/to add a new item/)).toBeTruthy();
    });
  });

  it('cancels item removal via confirmation modal', async () => {
    mockAsyncStorageWithItems([{ name: 'item1', value: 'value1', timestamp: 1, encrypted: false }]);

    renderHomeScreen({ user: mockUser, itemsReload: 0 });

    await waitFor(() => {
      expect(screen.getByText('item1')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('trash-outline'));

    await waitFor(() => {
      expect(screen.getByText('No')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('No'));

    await waitFor(() => {
      expect(screen.getByText('item1')).toBeTruthy();
    });
  });

  it('opens edit modal when edit icon is pressed', async () => {
    mockAsyncStorageWithItems([{ name: 'item1', value: 'value1', timestamp: 1, encrypted: false }]);

    renderHomeScreen({ user: mockUser, itemsReload: 0 });

    await waitFor(() => {
      expect(screen.getByText('item1')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('create-outline'));

    await waitFor(() => {
      expect(screen.getByText('Save')).toBeTruthy();
    });
  });

  it('saves a new item and logs add_item analytics event', async () => {
    renderHomeScreen({ user: mockUser, itemsReload: 0 });

    await waitFor(() => {
      expect(screen.getByText(/to add a new item/)).toBeTruthy();
    });

    fireEvent.press(screen.getAllByTestId('add-circle')[1]!);

    await waitFor(() => {
      expect(screen.getByText('Save')).toBeTruthy();
    });

    fireEvent.changeText(screen.getByPlaceholderText('Name'), 'new-item');
    fireEvent.changeText(screen.getByPlaceholderText('Value'), 'new-value');

    mockAsyncStorageWithItems([
      { name: 'new-item', value: 'new-value', timestamp: 1, encrypted: false },
    ]);

    await act(async () => {
      fireEvent.press(screen.getByText('Save'));
    });

    await waitFor(() => {
      expect(mockLogEvent).toHaveBeenCalledWith('add_item', { name: 'new-item' });
    });
  });

  it('edits an existing item and logs edit_item analytics event', async () => {
    mockAsyncStorageWithItems([{ name: 'item1', value: 'value1', timestamp: 1, encrypted: false }]);

    renderHomeScreen({ user: mockUser, itemsReload: 0 });

    await waitFor(() => {
      expect(screen.getByText('item1')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('create-outline'));

    await waitFor(() => {
      expect(screen.getByText('Save')).toBeTruthy();
    });

    fireEvent.changeText(screen.getByPlaceholderText('Value'), 'updated-value');

    mockAsyncStorageWithItems([
      { name: 'item1', value: 'updated-value', timestamp: 1, encrypted: false },
    ]);

    await act(async () => {
      fireEvent.press(screen.getByText('Save'));
    });

    await waitFor(() => {
      expect(mockLogEvent).toHaveBeenCalledWith('edit_item', { name: 'item1' });
    });
  });

  it('clears search via backspace icon', async () => {
    mockAsyncStorageWithItems([
      { name: 'apple', value: 'v1', timestamp: 1, encrypted: false },
      { name: 'banana', value: 'v2', timestamp: 2, encrypted: false },
    ]);

    renderHomeScreen({ user: mockUser, itemsReload: 0 });

    await waitFor(() => {
      expect(screen.getByText('apple')).toBeTruthy();
    });

    const searchInput = screen.getByPlaceholderText('Search...');
    fireEvent.changeText(searchInput, 'test');

    await waitFor(() => {
      expect(screen.getByTestId('backspace-outline')).toBeTruthy();
    });

    mockAsyncStorageWithItems([
      { name: 'apple', value: 'v1', timestamp: 1, encrypted: false },
      { name: 'banana', value: 'v2', timestamp: 2, encrypted: false },
    ]);

    fireEvent.press(screen.getByTestId('backspace-outline'));

    await waitFor(() => {
      expect(screen.getByText('apple')).toBeTruthy();
    });
  });

  it('renders confirmation modal with item name', async () => {
    mockAsyncStorageWithItems([{ name: 'item1', value: 'value1', timestamp: 1, encrypted: false }]);

    renderHomeScreen({ user: mockUser, itemsReload: 0 });

    await waitFor(() => {
      expect(screen.getByText('item1')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('trash-outline'));

    await waitFor(() => {
      expect(screen.getByText(/Are you sure you wish to delete item1/)).toBeTruthy();
    });
  });

  it('renders multiple items in list', async () => {
    mockAsyncStorageWithItems([
      { name: 'item1', value: 'value1', timestamp: 1, encrypted: false },
      { name: 'item2', value: 'value2', timestamp: 2, encrypted: false },
      { name: 'item3', value: 'value3', timestamp: 3, encrypted: false },
    ]);

    renderHomeScreen({ user: mockUser, itemsReload: 0 });

    await waitFor(() => {
      expect(screen.getByText('item1')).toBeTruthy();
      expect(screen.getByText('item2')).toBeTruthy();
      expect(screen.getByText('item3')).toBeTruthy();
    });
  });

  it('shows search bar when items exist', async () => {
    mockAsyncStorageWithItems([{ name: 'item1', value: 'value1', timestamp: 1, encrypted: false }]);

    renderHomeScreen({ user: mockUser, itemsReload: 0 });

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search...')).toBeTruthy();
    });
  });

  it('calls createUserSettings for logged-in non-anonymous user on mount', async () => {
    renderHomeScreen({ user: mockUser, itemsReload: 0 });

    await waitFor(() => {
      expect(mockCreateUserSettings).toHaveBeenCalledWith(mockUser.uid);
    });
  });

  it('does not call createUserSettings for anonymous user', async () => {
    renderHomeScreen({ user: mockAnonymousUser, itemsReload: 0 });

    await waitFor(() => {
      expect(mockAddTimestampToItems).toHaveBeenCalled();
    });

    expect(mockCreateUserSettings).not.toHaveBeenCalled();
  });

  it('calls addTimestampToItems on mount', async () => {
    renderHomeScreen({ user: mockUser, itemsReload: 0 });

    await waitFor(() => {
      expect(mockAddTimestampToItems).toHaveBeenCalled();
    });
  });

  it('does not call createUserSettings or addTimestampToItems after oneOffCorrections completes', async () => {
    renderHomeScreen({ user: mockUser, itemsReload: 0 });

    await waitFor(() => {
      expect(mockAddTimestampToItems).toHaveBeenCalledTimes(1);
    });

    // After oneOffCorrections is set to true by addTimestampToItems resolving,
    // the useEffect should not call these again
    mockCreateUserSettings.mockClear();
    mockAddTimestampToItems.mockClear();

    // Wait a bit to ensure no more calls happen
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(mockCreateUserSettings).not.toHaveBeenCalled();
    expect(mockAddTimestampToItems).not.toHaveBeenCalled();
  });

  it('handles createUserSettings rejection gracefully', async () => {
    mockCreateUserSettings.mockRejectedValueOnce(new Error('settings error'));

    renderHomeScreen({ user: mockUser, itemsReload: 0 });

    await waitFor(() => {
      expect(mockCreateUserSettings).toHaveBeenCalledWith(mockUser.uid);
      expect(mockAddTimestampToItems).toHaveBeenCalled();
    });
  });

  it('handles addTimestampToItems rejection gracefully', async () => {
    mockAddTimestampToItems.mockRejectedValueOnce(new Error('timestamp error'));

    renderHomeScreen({ user: mockUser, itemsReload: 0 });

    await waitFor(() => {
      expect(mockAddTimestampToItems).toHaveBeenCalled();
    });
  });

  it('does not call createUserSettings when user is null', async () => {
    renderHomeScreen({ user: null, itemsReload: 0 });

    await waitFor(() => {
      expect(mockAddTimestampToItems).toHaveBeenCalled();
    });

    expect(mockCreateUserSettings).not.toHaveBeenCalled();
  });
});
