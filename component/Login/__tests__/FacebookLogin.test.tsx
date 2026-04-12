import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import FacebookLogin from '../FacebookLogin';

jest.mock('expo-web-browser', () => ({
  __esModule: true,
  maybeCompleteAuthSession: jest.fn(),
}));

const mockPromptAsync = jest.fn();
let mockResponse: unknown = null;

jest.mock('expo-auth-session/providers/facebook', () => ({
  useAuthRequest: jest.fn(() => [{ id: 'facebook-request' }, mockResponse, mockPromptAsync]),
}));

const mockSignInWithCredential = jest.fn();

jest.mock('@react-native-firebase/auth', () => {
  const mockAuth = Object.assign(
    jest.fn(() => ({
      signInWithCredential: (...args: unknown[]) => mockSignInWithCredential(...args),
    })),
    {
      FacebookAuthProvider: {
        credential: jest.fn((token) => ({ provider: 'facebook', token })),
      },
    }
  );
  return {
    __esModule: true,
    default: mockAuth,
  };
});

describe('FacebookLogin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResponse = null;
  });

  it('renders Continue with Facebook button', () => {
    render(<FacebookLogin />);
    expect(screen.getByText('Continue with Facebook')).toBeTruthy();
  });

  it('calls promptAsync on button press', () => {
    render(<FacebookLogin />);
    fireEvent.press(screen.getByText('Continue with Facebook'));
    expect(mockPromptAsync).toHaveBeenCalled();
  });

  it('signs in with credential on successful Facebook response', async () => {
    mockResponse = {
      type: 'success',
      params: { access_token: 'fb-token-123' },
    };
    mockSignInWithCredential.mockResolvedValue(undefined);

    render(<FacebookLogin />);

    await waitFor(() => {
      expect(mockSignInWithCredential).toHaveBeenCalledWith({
        provider: 'facebook',
        token: 'fb-token-123',
      });
    });
  });

  it('logs error when access_token is missing', async () => {
    mockResponse = {
      type: 'success',
      params: {},
    };
    const spy = jest.spyOn(console, 'error').mockImplementation();

    render(<FacebookLogin />);

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith('No access token received from Facebook');
    });
    spy.mockRestore();
  });

  it('handles sign-in error', async () => {
    mockResponse = {
      type: 'success',
      params: { access_token: 'fb-token-123' },
    };
    mockSignInWithCredential.mockRejectedValue(new Error('Firebase error'));
    const spy = jest.spyOn(console, 'error').mockImplementation();

    render(<FacebookLogin />);

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith('Firebase sign-in error:', expect.any(Error));
    });
    spy.mockRestore();
  });
});
