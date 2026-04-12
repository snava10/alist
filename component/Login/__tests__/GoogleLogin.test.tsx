import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import GoogleLogin from '../GoogleLogin';
import auth, { linkWithCredential } from '@react-native-firebase/auth';
import { GoogleSigninButton } from '@react-native-google-signin/google-signin';

const mockSignInWithCredential = jest.fn();
const mockHasPlayServices = jest.fn().mockResolvedValue(true);
const mockGoogleSignIn = jest.fn();

jest.mock('@react-native-google-signin/google-signin', () => {
  const ButtonComponent = jest.fn(() => null);
  (ButtonComponent as unknown as Record<string, unknown>).Size = { Wide: 'Wide' };
  (ButtonComponent as unknown as Record<string, unknown>).Color = { Dark: 'Dark' };
  return {
    GoogleSigninButton: ButtonComponent,
    GoogleSignin: {
      configure: jest.fn(),
      hasPlayServices: (...args: unknown[]) => mockHasPlayServices(...args),
      signIn: (...args: unknown[]) => mockGoogleSignIn(...args),
    },
    SignInSuccessResponse: {},
  };
});

jest.mock('@react-native-firebase/auth', () => {
  const mockAuth = Object.assign(
    jest.fn(() => ({
      currentUser: null,
      signInWithCredential: (...args: unknown[]) => mockSignInWithCredential(...args),
      signOut: jest.fn().mockResolvedValue(undefined),
    })),
    {
      GoogleAuthProvider: {
        credential: jest.fn((token) => ({ provider: 'google', token })),
      },
    }
  );
  return {
    __esModule: true,
    default: mockAuth,
    linkWithCredential: jest.fn().mockResolvedValue(undefined),
    FirebaseAuthTypes: {},
  };
});

jest.mock('../../Core/Storage', () => ({
  createUserSettings: jest.fn().mockResolvedValue({ userId: 'user-123' }),
}));

describe('GoogleLogin', () => {
  const mockCallbackFn = jest.fn();

  const pressGoogleButton = () => {
    const calls = (GoogleSigninButton as unknown as jest.Mock).mock.calls;
    const lastCall = calls[calls.length - 1];
    const onPress = lastCall[0].onPress;
    onPress();
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Google Sign-In button', () => {
    render(<GoogleLogin callbackFn={mockCallbackFn} />);
    expect(GoogleSigninButton).toHaveBeenCalled();
  });

  it('signs in and calls callback on success', async () => {
    mockGoogleSignIn.mockResolvedValue({
      type: 'success',
      data: { idToken: 'google-token-123' },
    });
    mockSignInWithCredential.mockResolvedValue({
      user: { uid: 'user-123' },
    });

    render(<GoogleLogin callbackFn={mockCallbackFn} />);
    pressGoogleButton();

    await waitFor(() => {
      expect(mockHasPlayServices).toHaveBeenCalled();
      expect(mockGoogleSignIn).toHaveBeenCalled();
      expect(mockSignInWithCredential).toHaveBeenCalled();
      expect(mockCallbackFn).toHaveBeenCalled();
    });
  });

  it('calls callback with error log when credentials are null', async () => {
    mockGoogleSignIn.mockResolvedValue({
      type: 'success',
      data: { idToken: 'google-token-123' },
    });
    mockSignInWithCredential.mockResolvedValue(undefined);
    const spy = jest.spyOn(console, 'error').mockImplementation();

    render(<GoogleLogin callbackFn={mockCallbackFn} />);
    pressGoogleButton();

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith('Error: User credentials are null');
      expect(mockCallbackFn).toHaveBeenCalled();
    });
    spy.mockRestore();
  });

  it('calls callback on error', async () => {
    mockGoogleSignIn.mockRejectedValue(new Error('Google sign-in failed'));

    render(<GoogleLogin callbackFn={mockCallbackFn} />);
    pressGoogleButton();

    await waitFor(() => {
      expect(mockCallbackFn).toHaveBeenCalled();
    });
  });

  it('links credential when currentUser exists', async () => {
    const mockUser = { uid: 'existing-user' };
    (auth as unknown as jest.Mock).mockReturnValue({
      currentUser: mockUser,
      signInWithCredential: mockSignInWithCredential,
    });
    mockGoogleSignIn.mockResolvedValue({
      type: 'success',
      data: { idToken: 'google-token-123' },
    });

    render(<GoogleLogin callbackFn={mockCallbackFn} />);
    pressGoogleButton();

    await waitFor(() => {
      expect(linkWithCredential).toHaveBeenCalledWith(mockUser, expect.any(Object));
    });
  });
});
