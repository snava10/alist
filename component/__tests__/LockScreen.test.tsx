jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn().mockResolvedValue(undefined),
}));

import React from 'react';
import { Text } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import LockScreen from '../LockScreen';
import { VaultProvider, useVaultContext } from '../Core/VaultContext';
import { VaultProfileStore, unlockWithPassword } from '../Core/Vault';
import { VaultProfile } from '../Core/DataModel';

const DEPS = { kdfIterations: 100 };
const TEST_PASSWORD = 'correct horse';

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

function StatusProbe() {
  const vault = useVaultContext();
  return <Text testID="vault-status">{vault.locked ? 'locked' : 'unlocked'}</Text>;
}

function renderLockScreen(store: VaultProfileStore) {
  return render(
    <VaultProvider userId="u1" store={store} vaultDeps={DEPS}>
      <StatusProbe />
      <LockScreen />
    </VaultProvider>
  );
}

describe('LockScreen', () => {
  it('prompts to create a vault password when no profile exists', async () => {
    const { store } = makeStore();
    renderLockScreen(store);
    await waitFor(() => {
      expect(screen.getByText('Create your vault password')).toBeTruthy();
    });
    expect(screen.getByText(/cannot be recovered/)).toBeTruthy();
  });

  it('prompts to unlock when a profile already exists', async () => {
    const { store } = makeStore();
    await unlockWithPassword(TEST_PASSWORD, 'u1', store, DEPS);
    renderLockScreen(store);
    await waitFor(() => {
      expect(screen.getByText('Unlock your vault')).toBeTruthy();
    });
  });

  it('unlocks with the master password and clears it from the form', async () => {
    const { store } = makeStore();
    renderLockScreen(store);
    const input = screen.getByTestId('master-password-input');
    expect(screen.getByTestId('unlock-button')).toBeDisabled();
    fireEvent.changeText(input, TEST_PASSWORD);
    expect(screen.getByTestId('unlock-button')).not.toBeDisabled();
    fireEvent.press(screen.getByTestId('unlock-button'));
    await waitFor(() => {
      expect(screen.getByTestId('vault-status')).toHaveTextContent('unlocked');
    });
    expect(screen.getByTestId('master-password-input').props.value).toBe('');
  });

  it('keeps the vault locked and shows an error on a wrong password', async () => {
    const { store } = makeStore();
    await unlockWithPassword(TEST_PASSWORD, 'u1', store, DEPS);
    renderLockScreen(store);
    fireEvent.changeText(screen.getByTestId('master-password-input'), 'wrong horse');
    fireEvent.press(screen.getByTestId('unlock-button'));
    await waitFor(() => {
      expect(screen.getByTestId('lock-error')).toHaveTextContent(/incorrect/i);
    });
    expect(screen.getByTestId('vault-status')).toHaveTextContent('locked');
    expect(screen.getByTestId('master-password-input').props.value).toBe('wrong horse');
  });

  it('toggles password visibility', async () => {
    const { store } = makeStore();
    renderLockScreen(store);
    const input = screen.getByTestId('master-password-input');
    expect(input.props.secureTextEntry).toBe(true);
    fireEvent.press(screen.getByTestId('toggle-password-visibility'));
    expect(screen.getByTestId('master-password-input').props.secureTextEntry).toBe(false);
  });
});
