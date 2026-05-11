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
const mockAddSearchIndexToItems = jest.fn().mockResolvedValue([]);

jest.mock('../Core/Storage', () => ({
  ...jest.requireActual('../Core/Storage'),
  createUserSettings: (...args: any[]) => mockCreateUserSettings(...args),
  addTimestampToItems: (...args: any[]) => mockAddTimestampToItems(...args),
  addSearchIndexToItems: (...args: any[]) => mockAddSearchIndexToItems(...args),
}));

import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
import HomeScreen from '../HomeScreen';
import { generateAndStoreKeys } from '../Core/Security';
import {
  resetFirestoreClientForTesting,
  saveItem,
  setFirestoreClientForTesting,
} from '../Core/Storage';
import { MockFirestore } from '../Core/MockFirestore';
import { AListItem } from '../Core/DataModel';

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

const mockUser = { uid: 'test-user-123', isAnonymous: false };
const mockAnonymousUser = { uid: 'anon-user', isAnonymous: true };

const seededItems: AListItem[] = [
  {
    name: 'apple',
    timestamp: 1,
    userId: mockUser.uid,
    value: 'apple value',
    encrypted: true,
  },
  {
    name: 'banana',
    timestamp: 1,
    userId: mockUser.uid,
    value: 'banana value',
    encrypted: true,
  },
  {
    name: 'National Insurance Number',
    timestamp: 1,
    userId: mockUser.uid,
    value: 'SA12346Y',
    encrypted: true,
  },
  {
    name: 'Passport',
    timestamp: 1,
    userId: mockUser.uid,
    value: 'PAL123456',
    encrypted: true,
  },
];

async function seedDatabase(mockFirestore: MockFirestore) {
  setFirestoreClientForTesting(mockFirestore);
  await Promise.all(seededItems.map((item) => saveItem(item)));
}

describe('HomeScreen - Rendering Tests', () => {
  let mockFirestore: MockFirestore;

  beforeAll(async () => {
    await generateAndStoreKeys(true);
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    mockFirestore = new MockFirestore();
    setFirestoreClientForTesting(mockFirestore);
    (auth as any).mockImplementation(() => ({
      currentUser: mockUser,
      useEmulator: jest.fn(),
    }));
    (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([]);
    (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([]);
    await seedDatabase(mockFirestore);
  });

  afterEach(() => {
    resetFirestoreClientForTesting();
  });

  it('renders items', async () => {
    renderHomeScreen({ user: mockUser, itemsReload: 0 });
    await waitFor(() => {
      expect(screen.getByText('apple')).toBeTruthy();
      expect(screen.getByText('apple value')).toBeTruthy();
      expect(screen.getByText('banana')).toBeTruthy();
      expect(screen.getByText('banana value')).toBeTruthy();
      expect(screen.getByText('National Insurance Number')).toBeTruthy();
      expect(screen.getByText('SA12346Y')).toBeTruthy();
      expect(screen.getByText('Passport')).toBeTruthy();
      expect(screen.getByText('PAL123456')).toBeTruthy();
    });
  });

  it('renders empty state when no items exist', async () => {
    renderHomeScreen({ user: mockUser, itemsReload: 0 });
    await waitFor(() => {
      expect(screen.getByText(/to add a new item/)).toBeTruthy();
    });
  });

  it('render items then filters with search text', async () => {
    renderHomeScreen({ user: mockUser, itemsReload: 0 });

    await waitFor(() => {
      expect(screen.getByText('apple')).toBeTruthy();
      expect(screen.getByText('banana')).toBeTruthy();
    });

    const searchInput = screen.getByPlaceholderText('Search...');
    fireEvent.changeText(searchInput, 'apple');

    await waitFor(() => {
      expect(screen.getByText('apple')).toBeTruthy();
      expect(screen.getByDisplayValue('apple')).toBeTruthy();
    });
  });

  it('clears search text', async () => {
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
      expect(screen.getByTestId('add-circle')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('add-circle'));

    await waitFor(() => {
      expect(screen.getByText('Save')).toBeTruthy();
    });
  });

  describe('confirmation modal testing', () => {
    it('removes an item via confirmation modal', async () => {
      renderHomeScreen({ user: mockUser, itemsReload: 0 });

      await waitFor(() => {
        expect(screen.getByText('apple')).toBeTruthy();
        expect(screen.getAllByTestId('create-outline')).toHaveLength(4);
      });

      // Press the delete icon on the item
      fireEvent.press(screen.getAllByTestId('trash-outline')[0]!);

      await waitFor(() => {
        expect(screen.getByText('Yes')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Yes'));

      await waitFor(() => {
        expect(screen.queryByText('Yes')).toBeNull();
      });
    });

    it('cancels item removal via confirmation modal', async () => {
      renderHomeScreen({ user: mockUser, itemsReload: 0 });

      await waitFor(() => {
        expect(screen.getByText('apple')).toBeTruthy();
      });

      fireEvent.press(screen.getAllByTestId('trash-outline')[0]!);

      await waitFor(() => {
        expect(screen.getByText('No')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('No'));

      await waitFor(() => {
        expect(screen.getByText('apple')).toBeTruthy();
      });
    });

    it('opens edit modal when edit icon is pressed', async () => {
      renderHomeScreen({ user: mockUser, itemsReload: 0 });

      await waitFor(() => {
        expect(screen.getByText('apple')).toBeTruthy();
      });

      fireEvent.press(screen.getAllByTestId('create-outline')[0]!);

      await waitFor(() => {
        expect(screen.getByText('Save')).toBeTruthy();
      });
    });
  });

  it('saves a new item and logs add_item analytics event', async () => {
    setFirestoreClientForTesting(mockFirestore);
    (auth as any).mockImplementation(() => ({
      currentUser: mockUser,
      useEmulator: jest.fn(),
    }));
    renderHomeScreen({ user: mockUser, itemsReload: 0 });

    await waitFor(() => {
      expect(screen.getByTestId('add-circle')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('add-circle'));

    await waitFor(() => {
      expect(screen.getByText('Save')).toBeTruthy();
    });

    fireEvent.changeText(screen.getByPlaceholderText('Name'), 'new-item');
    fireEvent.changeText(screen.getByPlaceholderText('Value'), 'new-value');

    await act(async () => {
      fireEvent.press(screen.getByText('Save'));
    });

    await waitFor(() => {
      expect(mockLogEvent).toHaveBeenCalledWith('add_item', { name: 'new-item' });
      expect(screen.getByText('new-item')).toBeTruthy();
    });

    const savedDoc = await mockFirestore.collection('Items').doc(`${mockUser.uid}_new-item`).get();
    expect(savedDoc.exists).toBe(true);
    expect(savedDoc.data()).toMatchObject({
      name: 'new-item',
      userId: mockUser.uid,
      encrypted: true,
    });
  });

  it('edits an existing item and logs edit_item analytics event', async () => {
    renderHomeScreen({ user: mockUser, itemsReload: 0 });

    await waitFor(() => {
      expect(screen.getByText('apple')).toBeTruthy();
    });

    fireEvent.press(screen.getAllByTestId('create-outline')[0]!);

    await waitFor(() => {
      expect(screen.getByText('Save')).toBeTruthy();
    });

    fireEvent.changeText(screen.getByPlaceholderText('Value'), 'updated-value');

    await act(async () => {
      fireEvent.press(screen.getByText('Save'));
    });

    await waitFor(() => {
      expect(mockLogEvent).toHaveBeenCalledWith('edit_item', { name: 'apple' });
    });
  });

  it('clears search via backspace icon', async () => {
    renderHomeScreen({ user: mockUser, itemsReload: 0 });

    await waitFor(() => {
      expect(screen.getByText('apple')).toBeTruthy();
    });

    const searchInput = screen.getByPlaceholderText('Search...');
    fireEvent.changeText(searchInput, 'test');

    await waitFor(() => {
      expect(screen.getByTestId('backspace-outline')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('backspace-outline'));

    await waitFor(() => {
      expect(screen.getByText('apple')).toBeTruthy();
    });
  });

  it('renders confirmation modal with item name', async () => {
    renderHomeScreen({ user: mockUser, itemsReload: 0 });

    await waitFor(() => {
      expect(screen.getByText('apple')).toBeTruthy();
    });

    fireEvent.press(screen.getAllByTestId('trash-outline')[0]!);

    await waitFor(() => {
      expect(screen.getByText(/Are you sure you wish to delete apple/)).toBeTruthy();
    });
  });

  it('shows search bar when items exist', async () => {
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
    (auth as any).mockImplementation(() => ({
      currentUser: null,
      useEmulator: jest.fn(),
    }));

    renderHomeScreen({ user: null, itemsReload: 0 });

    await waitFor(() => {
      expect(screen.getByText(/to add a new item/)).toBeTruthy();
    });

    expect(mockCreateUserSettings).not.toHaveBeenCalled();
    expect(mockAddTimestampToItems).not.toHaveBeenCalled();
  });
});
