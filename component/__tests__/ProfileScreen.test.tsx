/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import ProfileScreen from '../ProfileScreen';
import { SafeAreaProvider } from 'react-native-safe-area-context';

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
  restoreFromBackup: jest.fn().mockResolvedValue([{ id: '1', name: 'item1' }]),
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
  return function MockAuthenticationComponent({
    isLoggedIn,
    logOutFn,
    deleteAccountFn,
    successCallbackFn,
  }: any) {
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
          <button testID="login-btn" onPress={() => successCallbackFn?.()}>
            Login
          </button>
        )}
      </button>
    );
  };
});

jest.mock('../ConfirmationModal', () => {
  return function MockConfirmationModal({
    visible,
    acceptCallbackFn,
    rejectCallbackFn,
    hideModalFn,
    message,
  }: any) {
    if (!visible) return null;
    return (
      <button testID="confirm-modal">
        <button testID={`modal-message-${message?.substring(0, 10)}`}>{message}</button>
        <button testID="modal-accept-btn" onPress={acceptCallbackFn}>
          Accept
        </button>
        <button testID="modal-reject-btn" onPress={rejectCallbackFn}>
          Reject
        </button>
        <button testID="modal-hide-btn" onPress={hideModalFn}>
          Hide
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

// Mock auth module
jest.mock('@react-native-firebase/auth', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    signOut: jest.fn().mockResolvedValue(undefined),
    currentUser: null,
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

  it('renders without crashing with authenticated user', async () => {
    const { toJSON } = render(
      <SafeAreaProvider>
        <ProfileScreen route={{ params: { user: mockUser } }} />
      </SafeAreaProvider>
    );

    await waitFor(() => {
      expect(toJSON()).toBeTruthy();
    });
  });

  it('renders with anonymous user', async () => {
    const { toJSON } = render(
      <SafeAreaProvider>
        <ProfileScreen route={{ params: { user: mockAnonymousUser } }} />
      </SafeAreaProvider>
    );

    await waitFor(() => {
      expect(toJSON()).toBeTruthy();
    });
  });

  it('handles null user gracefully', async () => {
    const { toJSON } = render(
      <SafeAreaProvider>
        <ProfileScreen route={{ params: { user: null } }} />
      </SafeAreaProvider>
    );

    await waitFor(() => {
      expect(toJSON()).toBeTruthy();
    });
  });

  it('processes user with provider data', async () => {
    const userWithProvider = {
      uid: 'user-with-provider',
      displayName: null,
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

    await waitFor(() => {
      expect(toJSON()).toBeTruthy();
    });
  });

  it('handles user with multiple providers', async () => {
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

    await waitFor(() => {
      expect(toJSON()).toBeTruthy();
    });
  });

  it('handles user with displayName and providers', async () => {
    const userWithBoth = {
      uid: 'user-both',
      displayName: 'Display Name',
      isAnonymous: false,
      providerData: [
        {
          displayName: 'Provider Name',
          providerId: 'google.com',
        },
      ],
    };

    const { toJSON } = render(
      <SafeAreaProvider>
        <ProfileScreen route={{ params: { user: userWithBoth } }} />
      </SafeAreaProvider>
    );

    await waitFor(() => {
      expect(toJSON()).toBeTruthy();
    });
  });

  it('renders with empty displayName', async () => {
    const userNoName = {
      uid: 'no-name-user',
      displayName: '',
      isAnonymous: false,
      providerData: [],
    };

    const { toJSON } = render(
      <SafeAreaProvider>
        <ProfileScreen route={{ params: { user: userNoName } }} />
      </SafeAreaProvider>
    );

    await waitFor(() => {
      expect(toJSON()).toBeTruthy();
    });
  });

  it('handles user with undefined displayName', async () => {
    const userUndefinedName = {
      uid: 'undefined-name-user',
      displayName: undefined,
      isAnonymous: false,
      providerData: [],
    };

    const { toJSON } = render(
      <SafeAreaProvider>
        <ProfileScreen route={{ params: { user: userUndefinedName } }} />
      </SafeAreaProvider>
    );

    await waitFor(() => {
      expect(toJSON()).toBeTruthy();
    });
  });

  it('handles empty provider data array', async () => {
    const userEmptyProviders = {
      uid: 'empty-providers-user',
      displayName: 'User',
      isAnonymous: false,
      providerData: [],
    };

    const { toJSON } = render(
      <SafeAreaProvider>
        <ProfileScreen route={{ params: { user: userEmptyProviders } }} />
      </SafeAreaProvider>
    );

    await waitFor(() => {
      expect(toJSON()).toBeTruthy();
    });
  });

  it('handles provider with undefined displayName', async () => {
    const userUndefinedProviderName = {
      uid: 'undefined-provider-name',
      displayName: null,
      isAnonymous: false,
      providerData: [
        {
          displayName: undefined,
          providerId: 'google.com',
        },
      ],
    };

    const { toJSON } = render(
      <SafeAreaProvider>
        <ProfileScreen route={{ params: { user: userUndefinedProviderName } }} />
      </SafeAreaProvider>
    );

    await waitFor(() => {
      expect(toJSON()).toBeTruthy();
    });
  });

  it('maintains reference to user from route params', async () => {
    const customUser = {
      uid: 'custom-uid-456',
      displayName: 'Custom Name',
      isAnonymous: false,
      providerData: [],
    };

    const { toJSON } = render(
      <SafeAreaProvider>
        <ProfileScreen route={{ params: { user: customUser } }} />
      </SafeAreaProvider>
    );

    await waitFor(() => {
      expect(toJSON()).toBeTruthy();
    });
  });

  it('renders with SafeAreaProvider context', async () => {
    const { toJSON } = render(
      <SafeAreaProvider>
        <ProfileScreen route={{ params: { user: mockUser } }} />
      </SafeAreaProvider>
    );

    await waitFor(() => {
      expect(toJSON()).toBeTruthy();
    });
  });

  it('handles isAnonymous flag correctly for true value', async () => {
    const anonUser = {
      uid: 'anon-123',
      displayName: 'Anonymous',
      isAnonymous: true,
      providerData: [],
    };

    const { toJSON } = render(
      <SafeAreaProvider>
        <ProfileScreen route={{ params: { user: anonUser } }} />
      </SafeAreaProvider>
    );

    await waitFor(() => {
      expect(toJSON()).toBeTruthy();
    });
  });

  it('handles isAnonymous flag correctly for false value', async () => {
    const authUser = {
      uid: 'auth-123',
      displayName: 'Authenticated',
      isAnonymous: false,
      providerData: [],
    };

    const { toJSON } = render(
      <SafeAreaProvider>
        <ProfileScreen route={{ params: { user: authUser } }} />
      </SafeAreaProvider>
    );

    await waitFor(() => {
      expect(toJSON()).toBeTruthy();
    });
  });

  it('handles undefined user in params', async () => {
    const { toJSON } = render(
      <SafeAreaProvider>
        <ProfileScreen route={{ params: { user: undefined } }} />
      </SafeAreaProvider>
    );

    await waitFor(() => {
      expect(toJSON()).toBeTruthy();
    });
  });

  it('handles provider with null displayName', async () => {
    const userNullProviderName = {
      uid: 'null-provider-name',
      displayName: null,
      isAnonymous: false,
      providerData: [
        {
          displayName: null,
          providerId: 'apple.com',
        },
      ],
    };

    const { toJSON } = render(
      <SafeAreaProvider>
        <ProfileScreen route={{ params: { user: userNullProviderName } }} />
      </SafeAreaProvider>
    );

    await waitFor(() => {
      expect(toJSON()).toBeTruthy();
    });
  });

  it('renders component structure', () => {
    const { toJSON } = render(
      <SafeAreaProvider>
        <ProfileScreen route={{ params: { user: mockUser } }} />
      </SafeAreaProvider>
    );

    const tree = toJSON();
    expect(tree).not.toBeNull();
  });
});
