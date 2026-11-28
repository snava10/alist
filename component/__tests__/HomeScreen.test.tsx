/* eslint-disable @typescript-eslint/no-explicit-any */
jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn().mockResolvedValue(undefined),
}));

import React, { useEffect, useRef } from 'react';
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
  saveVaultItem,
} from '../Core/Storage';
import { VaultProvider, useVaultContext } from '../Core/VaultContext';
import { VaultProfileStore, unlockWithPassword } from '../Core/Vault';
import { VaultProfile } from '../Core/DataModel';

const Stack = createNativeStackNavigator();
const PASSWORD = 'correct horse';
const DEPS = { kdfIterations: 100 };

const mockUser = {
  uid: 'u1',
  isAnonymous: false,
  displayName: 'Test User',
  providerData: [{ displayName: 'Test User', providerId: 'google.com' }],
  providerId: 'google.com',
};

let testStore: { store: VaultProfileStore; profiles: Map<string, VaultProfile> };

function makeStore() {
  const profiles = new Map<string, VaultProfile>();
  const store: VaultProfileStore = {
    getVaultProfile: async (userId: string) => profiles.get(userId) ?? null,
    saveVaultProfile: async (profile: VaultProfile) => {
      profiles.set(profile.userId, profile);
    },
  };
  return { store, profiles };
}

function Unlocker({ children }: { children: React.ReactNode }) {
  const vault = useVaultContext();
  const started = useRef(false);
  useEffect(() => {
    if (!started.current) {
      started.current = true;
      void vault.unlockWithPassword(PASSWORD);
    }
  }, [vault]);
  return <>{children}</>;
}

function HomeScreenWithVault(props: any) {
  return (
    <VaultProvider userId="u1" store={testStore.store} vaultDeps={DEPS}>
      <Unlocker>
        <HomeScreen {...props} />
      </Unlocker>
    </VaultProvider>
  );
}

function renderHomeScreen() {
  return render(
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen
            name="Home"
            component={HomeScreenWithVault}
            initialParams={{ user: mockUser }}
          />
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

async function seedVaultItem(name: string, value: string) {
  const { vaultKey } = await unlockWithPassword(PASSWORD, 'u1', testStore.store, DEPS);
  await saveVaultItem('u1', { name, value }, vaultKey);
}

async function waitForUnlocked() {
  await screen.findByTestId('add-item-button');
}

async function addItem(name: string, value: string) {
  fireEvent.press(screen.getByTestId('add-item-button'));
  fireEvent.changeText(screen.getByPlaceholderText('Name'), name);
  fireEvent.changeText(screen.getByPlaceholderText('Value'), value);
  fireEvent.press(screen.getByText('Save'));
}

describe('HomeScreen', () => {
  let mockFirestore: MockFirestore;

  beforeEach(() => {
    jest.clearAllMocks();
    (auth as unknown as jest.Mock).mockReturnValue({
      currentUser: mockUser,
      useEmulator: jest.fn(),
    });
    testStore = makeStore();
    mockFirestore = new MockFirestore();
    setFirestoreClientForTesting(mockFirestore as any);
  });

  afterAll(() => {
    resetFirestoreClientForTesting();
  });

  it('shows a newly added item without navigating away and back', async () => {
    renderHomeScreen();
    await waitForUnlocked();
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
    await waitForUnlocked();
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

  it('filters the list client-side as the search text changes', async () => {
    await seedVaultItem('National Insurance', 'SA1');
    await seedVaultItem('Passport', 'P1');
    renderHomeScreen();
    await waitForUnlocked();
    await waitFor(() => {
      expect(screen.getByText('Passport')).toBeTruthy();
    });

    fireEvent.changeText(screen.getByPlaceholderText('Search...'), 'nat');
    await waitFor(() => {
      expect(screen.getByText('National Insurance')).toBeTruthy();
      expect(screen.queryByText('Passport')).toBeNull();
    });

    fireEvent.changeText(screen.getByPlaceholderText('Search...'), '');
    await waitFor(() => {
      expect(screen.getByText('Passport')).toBeTruthy();
    });
  });

  it('shows a newly added item when the list already has items', async () => {
    await seedVaultItem('existing-item', 'existing-value');
    renderHomeScreen();
    await waitForUnlocked();
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
