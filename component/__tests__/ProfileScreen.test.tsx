/* eslint-disable @typescript-eslint/no-explicit-any */
// Mock native modules used by login sub-components
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(),
    signIn: jest.fn(),
  },
  GoogleSigninButton: () => null,
}));

jest.mock('@invertase/react-native-apple-authentication', () => ({
  appleAuth: {
    performRequest: jest.fn(),
    Operation: { LOGIN: 0 },
    Scope: { EMAIL: 0, FULL_NAME: 1 },
  },
  AppleButton: () => null,
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../Login/FacebookLogin', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../Login/GoogleLogin', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../Login/AppleLogin', () => ({
  __esModule: true,
  default: () => null,
}));

import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import auth from '@react-native-firebase/auth';
import { deleteItems, restoreFromBackup } from '../Core/Storage';
import ProfileScreen from '../ProfileScreen';

jest.mock('../Core/Storage', () => ({
  ...jest.requireActual('../Core/Storage'),
  deleteItems: jest.fn().mockResolvedValue(3),
  restoreFromBackup: jest.fn().mockResolvedValue(5),
}));

const mockLogEvent = jest.fn().mockResolvedValue(undefined);
jest.mock('@react-native-firebase/analytics', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    logEvent: mockLogEvent,
  })),
}));

const Stack = createNativeStackNavigator();

const renderProfileScreen = (params: any) =>
  render(
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen name="Profile" component={ProfileScreen} initialParams={params} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );

describe('ProfileScreen - Rendering Tests', () => {
  const mockUser = {
    uid: 'test-user-123',
    isAnonymous: false,
    displayName: 'Test User',
    providerData: [{ displayName: 'Test User', providerId: 'google.com' }],
    providerId: 'google.com',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all expected elements for a logged-in user', async () => {
    renderProfileScreen({ user: mockUser });

    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeTruthy();
      expect(screen.getByText('Backup')).toBeTruthy();
      expect(screen.getByText('Backup Restore')).toBeTruthy();
      expect(screen.getByText('Log Out')).toBeTruthy();
      expect(screen.getByText('Delete Account')).toBeTruthy();
    });
  });

  it('falls back to providerData displayName when user.displayName is null', async () => {
    const userWithoutDisplayName = {
      ...mockUser,
      displayName: null,
      providerData: [{ displayName: 'Provider Name', providerId: 'apple.com' }],
    };
    renderProfileScreen({ user: userWithoutDisplayName });

    await waitFor(() => {
      expect(screen.getByText('Provider Name')).toBeTruthy();
    });
  });

  it('renders login view for anonymous user', async () => {
    const anonymousUser = { uid: 'anon-123', isAnonymous: true, displayName: null };
    renderProfileScreen({ user: anonymousUser });

    await waitFor(() => {
      expect(screen.queryByText('Backup')).toBeNull();
      expect(screen.queryByText('Log Out')).toBeNull();
    });
  });

  it('logs out when Log Out is pressed', async () => {
    const mockSignOut = jest.fn().mockResolvedValue(undefined);
    (auth as unknown as jest.Mock).mockReturnValue({
      currentUser: mockUser,
      signOut: mockSignOut,
    });

    renderProfileScreen({ user: mockUser });

    await waitFor(() => {
      expect(screen.getByText('Log Out')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByText('Log Out'));
    });

    expect(mockSignOut).toHaveBeenCalled();
  });

  it('shows delete account confirmation modal and accepts', async () => {
    const mockDelete = jest.fn().mockResolvedValue(undefined);
    const mockGetIdToken = jest.fn().mockResolvedValue('token');
    (auth as unknown as jest.Mock).mockReturnValue({
      currentUser: {
        ...mockUser,
        getIdToken: mockGetIdToken,
        delete: mockDelete,
      },
      signOut: jest.fn(),
    });

    renderProfileScreen({ user: mockUser });

    await waitFor(() => {
      expect(screen.getByText('Delete Account')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByText('Delete Account'));
    });

    // Delete modal should appear
    await waitFor(() => {
      expect(screen.getByText(/Deleting your account/)).toBeTruthy();
      expect(screen.getByText('Yes')).toBeTruthy();
      expect(screen.getByText('No')).toBeTruthy();
    });

    // Accept deletion
    await act(async () => {
      fireEvent.press(screen.getByText('Yes'));
    });

    await waitFor(() => {
      expect(deleteItems).toHaveBeenCalledWith(mockUser.uid);
      expect(mockGetIdToken).toHaveBeenCalledWith(true);
      expect(mockDelete).toHaveBeenCalled();
    });
  });

  it('shows error message when delete requires recent login', async () => {
    const recentLoginError = new Error(
      '[auth/requires-recent-login] This operation requires recent authentication.'
    );
    const mockDelete = jest.fn().mockRejectedValue(recentLoginError);
    const mockGetIdToken = jest.fn().mockResolvedValue('token');
    (auth as unknown as jest.Mock).mockReturnValue({
      currentUser: {
        ...mockUser,
        getIdToken: mockGetIdToken,
        delete: mockDelete,
      },
      signOut: jest.fn(),
    });

    renderProfileScreen({ user: mockUser });

    await waitFor(() => {
      expect(screen.getByText('Delete Account')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByText('Delete Account'));
    });

    await waitFor(() => {
      expect(screen.getByText('Yes')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByText('Yes'));
    });

    await waitFor(() => {
      expect(
        screen.getByText(/Please logout, login and try deleting your account again/)
      ).toBeTruthy();
    });
  });

  it('dismisses delete modal when No is pressed', async () => {
    renderProfileScreen({ user: mockUser });

    await waitFor(() => {
      expect(screen.getByText('Delete Account')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByText('Delete Account'));
    });

    await waitFor(() => {
      expect(screen.getByText('No')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByText('No'));
    });

    await waitFor(() => {
      expect(screen.queryByText(/Deleting your account/)).toBeNull();
    });
  });

  it('opens restore from backup modal and accepts', async () => {
    renderProfileScreen({ user: mockUser });

    await waitFor(() => {
      expect(screen.getByText('Backup Restore')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByText('Backup Restore'));
    });

    await waitFor(() => {
      expect(screen.getByText(/replace all your data/)).toBeTruthy();
      expect(screen.getByText('Yes')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByText('Yes'));
    });

    await waitFor(() => {
      expect(restoreFromBackup).toHaveBeenCalledWith(mockUser.uid);
    });
  });

  it('dismisses restore from backup modal when No is pressed', async () => {
    renderProfileScreen({ user: mockUser });

    await waitFor(() => {
      expect(screen.getByText('Backup Restore')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByText('Backup Restore'));
    });

    await waitFor(() => {
      expect(screen.getByText(/replace all your data/)).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByText('No'));
    });

    await waitFor(() => {
      expect(screen.queryByText(/replace all your data/)).toBeNull();
    });
  });

  it('displays empty string when no displayName available anywhere', async () => {
    const userWithNoName = {
      ...mockUser,
      displayName: null,
      providerData: [{ displayName: null, providerId: 'google.com' }],
    };
    renderProfileScreen({ user: userWithNoName });

    await waitFor(() => {
      expect(screen.getByText('Backup')).toBeTruthy();
    });
    expect(screen.queryByText('Test User')).toBeNull();
  });

  it('displays empty string when providerData is empty', async () => {
    const userNoProvider = {
      ...mockUser,
      displayName: null,
      providerData: [],
    };
    renderProfileScreen({ user: userNoProvider });

    await waitFor(() => {
      expect(screen.getByText('Backup')).toBeTruthy();
    });
    expect(screen.queryByText('Test User')).toBeNull();
  });

  it('logs user_delete analytics event on successful deletion', async () => {
    const mockDelete = jest.fn().mockResolvedValue(undefined);
    const mockGetIdToken = jest.fn().mockResolvedValue('token');
    (auth as unknown as jest.Mock).mockReturnValue({
      currentUser: {
        ...mockUser,
        getIdToken: mockGetIdToken,
        delete: mockDelete,
      },
      signOut: jest.fn(),
    });

    renderProfileScreen({ user: mockUser });

    await waitFor(() => {
      expect(screen.getByText('Delete Account')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByText('Delete Account'));
    });

    await waitFor(() => {
      expect(screen.getByText('Yes')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByText('Yes'));
    });

    await waitFor(() => {
      expect(mockLogEvent).toHaveBeenCalledWith(
        'user_delete',
        expect.objectContaining({
          uid: mockUser.uid,
          provider: mockUser.providerId,
        })
      );
    });
  });

  it('logs user_delete_error analytics on auth/requires-recent-login', async () => {
    const recentLoginError = new Error(
      '[auth/requires-recent-login] This operation requires recent authentication.'
    );
    const mockDelete = jest.fn().mockRejectedValue(recentLoginError);
    const mockGetIdToken = jest.fn().mockResolvedValue('token');
    (auth as unknown as jest.Mock).mockReturnValue({
      currentUser: {
        ...mockUser,
        getIdToken: mockGetIdToken,
        delete: mockDelete,
      },
      signOut: jest.fn(),
    });

    renderProfileScreen({ user: mockUser });

    await waitFor(() => {
      expect(screen.getByText('Delete Account')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByText('Delete Account'));
    });

    await waitFor(() => {
      expect(screen.getByText('Yes')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByText('Yes'));
    });

    await waitFor(() => {
      expect(mockLogEvent).toHaveBeenCalledWith(
        'user_delete_error',
        expect.objectContaining({
          uid: mockUser.uid,
          provider: mockUser.providerId,
        })
      );
    });
  });

  it('logs backup_restore analytics event on successful restore', async () => {
    renderProfileScreen({ user: mockUser });

    await waitFor(() => {
      expect(screen.getByText('Backup Restore')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByText('Backup Restore'));
    });

    await waitFor(() => {
      expect(screen.getByText('Yes')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByText('Yes'));
    });

    await waitFor(() => {
      expect(mockLogEvent).toHaveBeenCalledWith(
        'backup_restore',
        expect.objectContaining({
          uid: mockUser.uid,
          provider: mockUser.providerId,
        })
      );
    });
  });

  it('hides backup section after logout', async () => {
    const mockSignOut = jest.fn().mockResolvedValue(undefined);
    (auth as unknown as jest.Mock).mockReturnValue({
      currentUser: mockUser,
      signOut: mockSignOut,
    });

    renderProfileScreen({ user: mockUser });

    await waitFor(() => {
      expect(screen.getByText('Backup')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByText('Log Out'));
    });

    await waitFor(() => {
      expect(screen.queryByText('Backup')).toBeNull();
    });
  });
});
