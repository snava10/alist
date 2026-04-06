import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import AppleLogin from '../AppleLogin';
import { firebase, linkWithCredential } from '@react-native-firebase/auth';
import { AppleButton } from '@invertase/react-native-apple-authentication';

const mockSignInWithCredential = jest.fn();
const mockPerformRequest = jest.fn();

jest.mock('@invertase/react-native-apple-authentication', () => {
  const AppleButtonComponent = jest.fn(() => null);
  (AppleButtonComponent as any).Style = { BLACK: 'BLACK', WHITE: 'WHITE' };
  (AppleButtonComponent as any).Type = { SIGN_IN: 'SIGN_IN' };
  return {
    appleAuth: {
      isSupported: true,
      Operation: { LOGIN: 'LOGIN' },
      Scope: { EMAIL: 'EMAIL', FULL_NAME: 'FULL_NAME' },
      performRequest: (...args: unknown[]) => mockPerformRequest(...args),
    },
    AppleButton: AppleButtonComponent,
  };
});

jest.mock('@react-native-firebase/auth', () => ({
  __esModule: true,
  firebase: {
    auth: Object.assign(
      jest.fn(() => ({
        currentUser: null,
        signInWithCredential: (...args: unknown[]) => mockSignInWithCredential(...args),
      })),
      {
        AppleAuthProvider: {
          credential: jest.fn((token, nonce) => ({ provider: 'apple', token, nonce })),
        },
      }
    ),
  },
  linkWithCredential: jest.fn().mockResolvedValue(undefined),
  FirebaseAuthTypes: {},
}));

jest.mock('../../Core/Storage', () => ({
  createUserSettings: jest.fn().mockResolvedValue({ userId: 'user-123' }),
}));

describe('AppleLogin', () => {
  const mockCallbackFn = jest.fn();

  const pressAppleButton = () => {
    const calls = (AppleButton as unknown as jest.Mock).mock.calls;
    const lastCall = calls[calls.length - 1];
    const onPress = lastCall[0].onPress;
    onPress();
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Apple Sign-In button when supported', () => {
    render(<AppleLogin callbackFn={mockCallbackFn} />);
    expect(AppleButton).toHaveBeenCalled();
  });

  it('signs in with credential on successful Apple auth', async () => {
    mockPerformRequest.mockResolvedValue({
      identityToken: 'test-token',
      nonce: 'test-nonce',
    });
    mockSignInWithCredential.mockResolvedValue({
      user: { uid: 'user-123' },
    });

    render(<AppleLogin callbackFn={mockCallbackFn} />);
    pressAppleButton();

    await waitFor(() => {
      expect(mockPerformRequest).toHaveBeenCalled();
      expect(mockSignInWithCredential).toHaveBeenCalled();
      expect(mockCallbackFn).toHaveBeenCalledWith({ uid: 'user-123' });
    });
  });

  it('calls callbackFn with currentUser when credentials are null', async () => {
    mockPerformRequest.mockResolvedValue({
      identityToken: 'test-token',
      nonce: 'test-nonce',
    });
    mockSignInWithCredential.mockResolvedValue(undefined);

    render(<AppleLogin callbackFn={mockCallbackFn} />);
    pressAppleButton();

    await waitFor(() => {
      expect(mockCallbackFn).toHaveBeenCalledWith(null);
    });
  });

  it('calls callbackFn on error', async () => {
    mockPerformRequest.mockRejectedValue(new Error('Apple auth failed'));

    render(<AppleLogin callbackFn={mockCallbackFn} />);
    pressAppleButton();

    await waitFor(() => {
      expect(mockCallbackFn).toHaveBeenCalledWith(null);
    });
  });

  it('retries when identityToken is null', async () => {
    mockPerformRequest.mockResolvedValue({
      identityToken: null,
      nonce: null,
    });

    render(<AppleLogin callbackFn={mockCallbackFn} />);
    pressAppleButton();

    await waitFor(() => {
      expect(mockPerformRequest).toHaveBeenCalled();
    });
  });

  it('links credential when currentUser exists', async () => {
    const mockUser = { uid: 'existing-user' };
    (firebase.auth as unknown as jest.Mock).mockReturnValue({
      currentUser: mockUser,
      signInWithCredential: mockSignInWithCredential,
    });
    mockPerformRequest.mockResolvedValue({
      identityToken: 'test-token',
      nonce: 'test-nonce',
    });
    mockSignInWithCredential.mockResolvedValue({
      user: { uid: 'user-123' },
    });

    render(<AppleLogin callbackFn={mockCallbackFn} />);
    pressAppleButton();

    await waitFor(() => {
      expect(mockSignInWithCredential).toHaveBeenCalled();
      expect(linkWithCredential).toHaveBeenCalledWith(mockUser, expect.any(Object));
    });
  });
});
