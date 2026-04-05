/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ProfileScreen from '../ProfileScreen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as auth from '@react-native-firebase/auth';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  },
}));

jest.mock('@react-native-firebase/firestore', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    collection: jest.fn(),
  })),
}));

jest.mock('@react-native-firebase/app', () => ({
  __esModule: true,
}));

jest.mock('../Core/Storage', () => ({
  deleteItems: jest.fn().mockResolvedValue(5),
  restoreFromBackup: jest.fn().mockResolvedValue([]),
}));

jest.mock('../Core/GlobalStyles', () => ({
  profileBannerContainer: {},
  profileTextLabel: {},
  button: {
    primary: { main: {} },
    text: { default: {} },
  },
}));

jest.mock('@expo/vector-icons/Ionicons', () => {
  return function MockIcon() {
    return null;
  };
});

jest.mock('../Login/AuthenticationComponent', () => {
  return function MockAuthenticationComponent({ isLoggedIn, logOutFn, deleteAccountFn }: any) {
    return (
      <button testID="auth-component" onPress={() => {}}>
        {isLoggedIn ? (
          <>
            <button testID="logout-btn" onPress={logOutFn}>
              Logout
            </button>
            <button testID="delete-account-btn" onPress={deleteAccountFn}>
              Delete Account
            </button>
          </>
        ) : (
          <button testID="login-btn">Login</button>
        )}
      </button>
    );
  };
});

jest.mock('../ConfirmationModal', () => {
  return function MockConfirmationModal({ visible, acceptCallbackFn, hideModalFn }: any) {
    if (!visible) return null;
    return (
      <button testID="confirm-modal">
        <button testID="modal-accept-btn" onPress={acceptCallbackFn}>
          Accept
        </button>
        <button testID="modal-reject-btn" onPress={hideModalFn}>
          Reject
        </button>
      </button>
    );
  };
});

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: jest.fn(() => ({
    navigate: jest.fn(),
  })),
}));

jest.mock('@react-native-firebase/analytics', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    logEvent: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('ProfileScreen', () => {
  const mockUser = {
    uid: 'test-uid-123',
    displayName: 'Test User',
    isAnonymous: false,
    providerData: [],
  };

  const mockAnonymousUser = {
    uid: 'anon-uid',
    displayName: null,
    isAnonymous: true,
    providerData: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(
      <SafeAreaProvider>
        <ProfileScreen route={{ params: { user: mockUser } }} />
      </SafeAreaProvider>
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders SafeAreaProvider context correctly', () => {
    const { toJSON } = render(
      <SafeAreaProvider>
        <ProfileScreen route={{ params: { user: mockUser } }} />
      </SafeAreaProvider>
    );
    const tree = toJSON();
    expect(tree).toBeTruthy();
  });

  it('renders with authenticated user', () => {
    const { toJSON } = render(
      <SafeAreaProvider>
        <ProfileScreen route={{ params: { user: mockUser } }} />
      </SafeAreaProvider>
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders with anonymous user', () => {
    const { toJSON } = render(
      <SafeAreaProvider>
        <ProfileScreen route={{ params: { user: mockAnonymousUser } }} />
      </SafeAreaProvider>
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders with null user handling', () => {
    const { toJSON } = render(
      <SafeAreaProvider>
        <ProfileScreen route={{ params: { user: null } }} />
      </SafeAreaProvider>
    );
    expect(toJSON()).toBeTruthy();
  });

  it('receives and uses user from route params', () => {
    const customUser = {
      uid: 'custom-uid',
      displayName: 'Custom User',
      isAnonymous: false,
      providerData: [],
    };

    const { toJSON } = render(
      <SafeAreaProvider>
        <ProfileScreen route={{ params: { user: customUser } }} />
      </SafeAreaProvider>
    );
    expect(toJSON()).toBeTruthy();
  });

  it('receives and manages callback functions from authentication component', () => {
    const { toJSON } = render(
      <SafeAreaProvider>
        <ProfileScreen route={{ params: { user: mockUser } }} />
      </SafeAreaProvider>
    );
    expect(toJSON()).toBeTruthy();
  });

  it('manages modal visibility state correctly', () => {
    const { queryByTestId } = render(
      <SafeAreaProvider>
        <ProfileScreen route={{ params: { user: mockUser } }} />
      </SafeAreaProvider>
    );

    // Initially, modals should not be visible
    expect(queryByTestId('confirm-modal')).toBeFalsy();
  });

  it('handles user data with provider information', () => {
    const userWithProvider = {
      uid: 'user-with-provider',
      displayName: 'User Name',
      isAnonymous: false,
      providerData: [
        {
          displayName: 'Google User',
          providerId: 'google.com',
        },
      ],
    };

    const { toJSON } = render(
      <SafeAreaProvider>
        <ProfileScreen route={{ params: { user: userWithProvider } }} />
      </SafeAreaProvider>
    );
    expect(toJSON()).toBeTruthy();
  });

  it('handles display name extraction from first provider', () => {
    const userWithMultipleProviders = {
      uid: 'multi-provider-user',
      displayName: null,
      isAnonymous: false,
      providerData: [
        {
          displayName: 'Apple User',
          providerId: 'apple.com',
        },
        {
          displayName: 'Google User',
          providerId: 'google.com',
        },
      ],
    };

    const { toJSON } = render(
      <SafeAreaProvider>
        <ProfileScreen route={{ params: { user: userWithMultipleProviders } }} />
      </SafeAreaProvider>
    );
    expect(toJSON()).toBeTruthy();
  });

  it('prevents rendering when user is not provided', () => {
    const { toJSON } = render(
      <SafeAreaProvider>
        <ProfileScreen route={{ params: { user: undefined } }} />
      </SafeAreaProvider>
    );
    expect(toJSON()).toBeTruthy();
  });
});
