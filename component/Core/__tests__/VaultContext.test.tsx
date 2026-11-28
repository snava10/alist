import React from 'react';
import { Text } from 'react-native';
import { act, render, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { VaultProfile } from '../DataModel';
import { VaultProvider, useVaultContext, VaultContextValue } from '../VaultContext';
import { VaultProfileStore, unlockWithPassword } from '../Vault';

let captured: VaultContextValue | null = null;

function Probe() {
  captured = useVaultContext();
  return <Text testID="probe">{captured.locked ? 'locked' : 'unlocked'}</Text>;
}

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

const TEST_PASSWORD = 'correct horse';
const DEPS = { kdfIterations: 100 };
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

describe('VaultProvider', () => {
  beforeEach(() => {
    captured = null;
  });

  it('starts locked with no key and unlocks with the master password', async () => {
    const { store } = makeStore();
    const { getByTestId } = render(
      <VaultProvider userId="u1" store={store} vaultDeps={DEPS}>
        <Probe />
      </VaultProvider>
    );
    expect(captured?.locked).toBe(true);
    expect(captured?.vaultKey).toBeNull();
    expect(getByTestId('probe').children).toEqual(['locked']);
    await waitFor(() => expect(captured?.needsSetup).toBe(true));

    let ok = false;
    await act(async () => {
      ok = await captured!.unlockWithPassword(TEST_PASSWORD);
    });
    expect(ok).toBe(true);
    expect(captured?.locked).toBe(false);
    expect(captured?.vaultKey).toHaveLength(32);
    expect(captured?.needsSetup).toBe(false);
    expect(getByTestId('probe').children).toEqual(['unlocked']);
  });

  it('keeps the vault locked and reports an error on a wrong password', async () => {
    const { store } = makeStore();
    await unlockWithPassword(TEST_PASSWORD, 'u1', store, DEPS);
    render(
      <VaultProvider userId="u1" store={store} vaultDeps={DEPS}>
        <Probe />
      </VaultProvider>
    );

    let ok = true;
    await act(async () => {
      ok = await captured!.unlockWithPassword('wrong horse');
    });
    expect(ok).toBe(false);
    expect(captured?.locked).toBe(true);
    expect(captured?.vaultKey).toBeNull();
    expect(captured?.unlockError).toMatch(/incorrect/i);
  });

  it('auto-locks after the configured inactivity delay and wipes the key bytes', async () => {
    const { store } = makeStore();
    render(
      <VaultProvider userId="u1" store={store} vaultDeps={DEPS} autoLockMs={100}>
        <Probe />
      </VaultProvider>
    );
    await act(async () => {
      await captured!.unlockWithPassword(TEST_PASSWORD);
    });
    const key = captured?.vaultKey as Uint8Array;
    expect(key).toHaveLength(32);
    expect(key.some((b) => b !== 0)).toBe(true);

    await waitFor(() => expect(captured?.locked).toBe(true), { timeout: 2000 });
    expect(captured?.vaultKey).toBeNull();
    expect(key).toEqual(new Uint8Array(32));
  });

  it('applies a changed auto-lock delay and locks after it', async () => {
    const { store } = makeStore();
    render(
      <VaultProvider userId="u1" store={store} vaultDeps={DEPS} autoLockMs={10_000}>
        <Probe />
      </VaultProvider>
    );
    await act(async () => {
      await captured!.unlockWithPassword(TEST_PASSWORD);
    });
    expect(captured?.locked).toBe(false);
    expect(captured?.autoLockMs).toBe(10_000);

    act(() => {
      captured!.setAutoLockMs(100);
    });
    expect(captured?.autoLockMs).toBe(100);
    await waitFor(() => expect(captured?.locked).toBe(true), { timeout: 2000 });
    expect(captured?.vaultKey).toBeNull();
  });

  it('ignores non-positive auto-lock delays', async () => {
    const { store } = makeStore();
    render(
      <VaultProvider userId="u1" store={store} vaultDeps={DEPS} autoLockMs={10_000}>
        <Probe />
      </VaultProvider>
    );
    act(() => {
      captured!.setAutoLockMs(0);
      captured!.setAutoLockMs(-5);
    });
    expect(captured?.autoLockMs).toBe(10_000);
  });

  it('reschedules the auto-lock timer on activity', async () => {
    const { store } = makeStore();
    render(
      <VaultProvider userId="u1" store={store} vaultDeps={DEPS} autoLockMs={200}>
        <Probe />
      </VaultProvider>
    );
    await act(async () => {
      await captured!.unlockWithPassword(TEST_PASSWORD);
    });
    await sleep(100);
    act(() => {
      captured!.noteActivity();
    });
    await sleep(100);
    expect(captured?.locked).toBe(false);
    await waitFor(() => expect(captured?.locked).toBe(true), { timeout: 2000 });
  });

  it('locks immediately when the app moves to the background', async () => {
    const { store } = makeStore();
    let appStateHandler: ((state: string) => void) | null = null;
    const addEventListenerSpy = jest.spyOn(AppState, 'addEventListener').mockImplementation(((
      ...args: unknown[]
    ) => {
      appStateHandler = args[1] as (state: string) => void;
      return { remove: jest.fn() };
    }) as never);
    try {
      render(
        <VaultProvider userId="u1" store={store} vaultDeps={DEPS}>
          <Probe />
        </VaultProvider>
      );
      await act(async () => {
        await captured!.unlockWithPassword(TEST_PASSWORD);
      });
      expect(captured?.locked).toBe(false);

      act(() => {
        appStateHandler?.('background');
      });
      expect(captured?.locked).toBe(true);
      expect(captured?.vaultKey).toBeNull();

      await act(async () => {
        await captured!.unlockWithPassword(TEST_PASSWORD);
      });
      act(() => {
        appStateHandler?.('active');
      });
      expect(captured?.locked).toBe(false);
    } finally {
      addEventListenerSpy.mockRestore();
    }
  });

  it('locks on demand and wipes the key bytes', async () => {
    const { store } = makeStore();
    render(
      <VaultProvider userId="u1" store={store} vaultDeps={DEPS}>
        <Probe />
      </VaultProvider>
    );
    await act(async () => {
      await captured!.unlockWithPassword(TEST_PASSWORD);
    });
    const key = captured?.vaultKey as Uint8Array;
    act(() => {
      captured!.lock();
    });
    expect(captured?.locked).toBe(true);
    expect(captured?.vaultKey).toBeNull();
    expect(key).toEqual(new Uint8Array(32));
    expect(captured?.unlockError).toBeNull();
  });

  it('reports needsSetup false when a profile already exists', async () => {
    const { store } = makeStore();
    await unlockWithPassword(TEST_PASSWORD, 'u1', store, DEPS);
    render(
      <VaultProvider userId="u1" store={store} vaultDeps={DEPS}>
        <Probe />
      </VaultProvider>
    );
    await waitFor(() => expect(captured?.needsSetup).toBe(false));
  });

  it('wipes the key bytes on unmount', async () => {
    const { store } = makeStore();
    const { unmount } = render(
      <VaultProvider userId="u1" store={store} vaultDeps={DEPS}>
        <Probe />
      </VaultProvider>
    );
    await act(async () => {
      await captured!.unlockWithPassword(TEST_PASSWORD);
    });
    const key = captured?.vaultKey as Uint8Array;
    unmount();
    expect(key).toEqual(new Uint8Array(32));
  });
});
