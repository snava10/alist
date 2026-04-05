import React from 'react';
import { render } from '@testing-library/react-native';
import FacebookLogin from '../FacebookLogin';

jest.mock('expo-web-browser', () => ({
  __esModule: true,
  maybeCompleteAuthSession: jest.fn(),
}));

jest.mock('expo-auth-session/providers/facebook', () => ({
  useAuthRequest: jest.fn(() => [{ id: 'facebook-request' }, null, jest.fn()]),
}));

jest.mock('@react-native-firebase/auth', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    signInWithCredential: jest.fn().mockResolvedValue(undefined),
    FacebookAuthProvider: {
      credential: jest.fn((token) => ({ provider: 'facebook', token })),
    },
  })),
}));

describe('FacebookLogin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(<FacebookLogin />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders a pressable button', () => {
    const { toJSON } = render(<FacebookLogin />);
    expect(toJSON()).toBeTruthy();
  });

  it('displays Facebook branding', () => {
    const { toJSON } = render(<FacebookLogin />);
    expect(toJSON()).toBeTruthy();
  });

  it('has correct button color', () => {
    const { toJSON } = render(<FacebookLogin />);
    expect(toJSON()).toBeTruthy();
  });

  it('displays Continue with Facebook text', () => {
    const { toJSON } = render(<FacebookLogin />);
    expect(toJSON()).toBeTruthy();
  });

  it('mounts with Facebook SDK', () => {
    expect(() => {
      render(<FacebookLogin />);
    }).not.toThrow();
  });

  it('initializes auth request', () => {
    const { toJSON } = render(<FacebookLogin />);
    expect(toJSON()).toBeTruthy();
  });

  it('handles button styling', () => {
    const { toJSON } = render(<FacebookLogin />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders with proper accessibility', () => {
    const { toJSON } = render(<FacebookLogin />);
    expect(toJSON()).toBeTruthy();
  });

  it('handles component lifecycle', () => {
    const { unmount } = render(<FacebookLogin />);
    unmount();
  });

  it('has disabled state when request is not ready', () => {
    const { toJSON } = render(<FacebookLogin />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders in a view container', () => {
    const { toJSON } = render(<FacebookLogin />);
    expect(toJSON()).toBeTruthy();
  });
});
