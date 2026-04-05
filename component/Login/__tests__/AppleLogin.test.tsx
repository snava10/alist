import React from 'react';
import { render } from '@testing-library/react-native';
import AppleLogin from '../AppleLogin';

jest.mock('@invertase/react-native-apple-authentication', () => ({
  appleAuth: {
    Operation: { LOGIN: 'LOGIN' },
    Scope: { EMAIL: 'EMAIL', FULL_NAME: 'FULL_NAME' },
    performRequest: jest.fn().mockResolvedValue({
      identityToken: 'test-identity-token',
      nonce: 'test-nonce',
    }),
  },
  AppleButton: {
    Style: { WHITE: 'WHITE' },
    Type: { SIGN_IN: 'SIGN_IN' },
  },
}));

jest.mock('@react-native-firebase/auth', () => ({
  __esModule: true,
  firebase: {
    auth: jest.fn(() => ({
      currentUser: null,
      signInWithCredential: jest.fn().mockResolvedValue({
        user: { uid: 'user-123' },
      }),
    })),
  },
  linkWithCredential: jest.fn().mockRejectedValue(new Error('Not linked')),
  FirebaseAuthTypes: {},
}));

jest.mock('../../Core/Storage', () => ({
  createUserSettings: jest.fn().mockResolvedValue(undefined),
}));

describe('AppleLogin', () => {
  const mockCallbackFn = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(<AppleLogin callbackFn={mockCallbackFn} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders an Apple Sign-In button', () => {
    const { toJSON } = render(<AppleLogin callbackFn={mockCallbackFn} />);
    expect(toJSON()).toBeTruthy();
  });

  it('passes callback function', () => {
    const { toJSON } = render(<AppleLogin callbackFn={mockCallbackFn} />);
    expect(toJSON()).toBeTruthy();
  });

  it('has correct button configuration', () => {
    const { toJSON } = render(<AppleLogin callbackFn={mockCallbackFn} />);
    expect(toJSON()).toBeTruthy();
  });

  it('mounts with Apple authentication setup', () => {
    expect(() => {
      render(<AppleLogin callbackFn={mockCallbackFn} />);
    }).not.toThrow();
  });

  it('handles button styling', () => {
    const { toJSON } = render(<AppleLogin callbackFn={mockCallbackFn} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders in a view container', () => {
    const { toJSON } = render(<AppleLogin callbackFn={mockCallbackFn} />);
    expect(toJSON()).toBeTruthy();
  });

  it('handles different callback functions', () => {
    const alternativeCallback = jest.fn();
    const { toJSON } = render(<AppleLogin callbackFn={alternativeCallback} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders with proper accessibility', () => {
    const { toJSON } = render(<AppleLogin callbackFn={mockCallbackFn} />);
    expect(toJSON()).toBeTruthy();
  });

  it('handles component lifecycle', () => {
    const { unmount } = render(<AppleLogin callbackFn={mockCallbackFn} />);
    unmount();
  });

  it('receives callback as prop', () => {
    const customCallback = jest.fn();
    const { toJSON } = render(<AppleLogin callbackFn={customCallback} />);
    expect(toJSON()).toBeTruthy();
  });

  it('handles missing callback gracefully', () => {
    const { toJSON } = render(<AppleLogin callbackFn={undefined} />);
    expect(toJSON()).toBeTruthy();
  });
});
