/* eslint-disable @typescript-eslint/no-explicit-any */
jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn().mockResolvedValue(undefined),
}));

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import auth from '@react-native-firebase/auth';
import HomeScreen from '../HomeScreen';
import { MockFirestore } from '../Core/MockFirestore';
import {
  setFirestoreClientForTesting,
  resetFirestoreClientForTesting,
  saveItem,
} from '../Core/Storage';
import { generateAndStoreKeys } from '../Core/Security';

const Stack = createNativeStackNavigator();

const mockUser = {
  uid: 'u1',
  isAnonymous: false,
  displayName: 'Test User',
  providerData: [{ displayName: 'Test User', providerId: 'google.com' }],
  providerId: 'google.com',
};

function renderHomeScreen() {
  return render(
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen name="Home" component={HomeScreen} initialParams={{ user: mockUser }} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

/**
 * Firestore client whose one-shot `get()` always returns stale (empty)
 * data, while `onSnapshot` delivers the real data. A screen that reloads
 * with `get()` after saving never sees the new item through this client;
 * a screen driven by the subscription does.
 */
class SnapshotOnlyFirestore {
  constructor(private inner: MockFirestore) {}

  collection(name: string) {
    const innerCollection = this.inner.collection(name);
    const wrapQuery = (query: any): any => ({
      where: (field: string, op: string, value: unknown) =>
        wrapQuery(query.where(field, op, value)),
      get: async () => ({ empty: true, docs: [] }),
      onSnapshot: (onNext: any, onError?: any) => query.onSnapshot(onNext, onError),
    });
    return {
      doc: (id: string) => innerCollection.doc(id),
      where: (field: string, op: string, value: unknown) =>
        wrapQuery(innerCollection.where(field as any, op as any, value)),
    };
  }
}

async function addItem(name: string, value: string) {
  fireEvent.press(screen.getByTestId('add-item-button'));
  fireEvent.changeText(screen.getByPlaceholderText('Name'), name);
  fireEvent.changeText(screen.getByPlaceholderText('Value'), value);
  fireEvent.press(screen.getByText('Save'));
}

describe('HomeScreen', () => {
  let mockFirestore: MockFirestore;

  beforeAll(async () => {
    await generateAndStoreKeys(true);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (auth as unknown as jest.Mock).mockReturnValue({
      currentUser: mockUser,
      useEmulator: jest.fn(),
    });
    mockFirestore = new MockFirestore();
    setFirestoreClientForTesting(mockFirestore as any);
  });

  afterAll(() => {
    resetFirestoreClientForTesting();
  });

  it('shows a newly added item without navigating away and back', async () => {
    renderHomeScreen();
    await waitFor(() => {
      expect(screen.queryByText('my-item')).toBeNull();
    });

    await addItem('my-item', 'my-value');

    await waitFor(
      () => {
        expect(screen.getByText('my-item')).toBeTruthy();
        expect(screen.getByText('my-value')).toBeTruthy();
      },
      { timeout: 3000 }
    );
  });

  it('shows a newly added item even when one-shot reads return stale data', async () => {
    const staleBacked = new MockFirestore();
    setFirestoreClientForTesting(new SnapshotOnlyFirestore(staleBacked) as any);
    renderHomeScreen();
    await waitFor(() => {
      expect(screen.queryByText('stale-item')).toBeNull();
    });

    await addItem('stale-item', 'stale-value');

    await waitFor(
      () => {
        expect(screen.getByText('stale-item')).toBeTruthy();
        expect(screen.getByText('stale-value')).toBeTruthy();
      },
      { timeout: 3000 }
    );
  });

  it('shows a newly added item when the list already has items', async () => {
    await saveItem({
      name: 'existing-item',
      value: 'existing-value',
      timestamp: 1,
      userId: 'u1',
    });
    renderHomeScreen();
    await waitFor(() => {
      expect(screen.getByText('existing-item')).toBeTruthy();
    });

    await addItem('second-item', 'second-value');

    await waitFor(
      () => {
        expect(screen.getByText('second-item')).toBeTruthy();
        expect(screen.getByText('existing-item')).toBeTruthy();
      },
      { timeout: 3000 }
    );
  });
});
