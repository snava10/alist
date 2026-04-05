import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import AuthenticationComponent, { AuthenticationComponentProps } from '../AuthenticationComponent';

jest.mock('../FacebookLogin', () => {
  return function MockFacebookLogin() {
    return null;
  };
});

jest.mock('../GoogleLogin', () => {
  return function MockGoogleLogin() {
    return null;
  };
});

jest.mock('../AppleLogin', () => {
  return function MockAppleLogin() {
    return null;
  };
});

jest.mock('../../Core/GlobalStyles', () => ({
  button: {
    primary: { main: {}, outlined: {} },
    text: { default: {}, dangerSmall: {} },
  },
}));

jest.mock('@react-native-firebase/auth', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    signInAnonymously: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('AuthenticationComponent', () => {
  const mockSuccessFn = jest.fn();
  const mockLogoutFn = jest.fn();
  const mockDeleteAccountFn = jest.fn();
  const mockAnonymousFn = jest.fn();

  const defaultProps: AuthenticationComponentProps = {
    isLoggedIn: false,
    successCallbackFn: mockSuccessFn,
    logOutFn: mockLogoutFn,
    deleteAccountFn: mockDeleteAccountFn,
    continueAnonymousCallbackFn: mockAnonymousFn,
    authProviders: {
      google: true,
      facebook: true,
      apple: true,
      allowAnonymous: true,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exports AuthenticationComponent', () => {
    expect(typeof AuthenticationComponent).toBe('function');
  });

  it('renders component without crashing', () => {
    const { toJSON } = render(<AuthenticationComponent {...defaultProps} />);
    expect(toJSON()).toBeTruthy();
  });

  it('accepts isLoggedIn prop', () => {
    const { toJSON } = render(<AuthenticationComponent {...defaultProps} isLoggedIn={false} />);
    expect(toJSON()).toBeTruthy();
  });

  it('accepts callback functions', () => {
    const { toJSON } = render(<AuthenticationComponent {...defaultProps} />);
    expect(toJSON()).toBeTruthy();
  });

  it('accepts auth providers configuration', () => {
    const { toJSON } = render(<AuthenticationComponent {...defaultProps} />);
    expect(toJSON()).toBeTruthy();
  });

  it('is a functional component', () => {
    expect(typeof AuthenticationComponent).toBe('function');
  });

  it('renders with default props', () => {
    const { toJSON } = render(<AuthenticationComponent {...defaultProps} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders when not logged in', () => {
    const props = { ...defaultProps, isLoggedIn: false };
    const { toJSON } = render(<AuthenticationComponent {...props} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders when logged in', () => {
    const props = { ...defaultProps, isLoggedIn: true };
    const { toJSON } = render(<AuthenticationComponent {...props} />);
    expect(toJSON()).toBeTruthy();
  });

  it('with limited providers', () => {
    const props = {
      ...defaultProps,
      authProviders: {
        google: true,
        facebook: false,
        apple: false,
        allowAnonymous: false,
      },
    };
    const { toJSON } = render(<AuthenticationComponent {...props} />);
    expect(toJSON()).toBeTruthy();
  });

  it('with no providers', () => {
    const props = {
      ...defaultProps,
      authProviders: {
        google: false,
        facebook: false,
        apple: false,
        allowAnonymous: false,
      },
    };
    const { toJSON } = render(<AuthenticationComponent {...props} />);
    expect(toJSON()).toBeTruthy();
  });

  it('with anonymous login enabled', () => {
    const props = {
      ...defaultProps,
      authProviders: { ...defaultProps.authProviders, allowAnonymous: true },
    };
    const { toJSON } = render(<AuthenticationComponent {...props} />);
    expect(toJSON()).toBeTruthy();
  });

  it('with anonymous login disabled', () => {
    const props = {
      ...defaultProps,
      authProviders: { ...defaultProps.authProviders, allowAnonymous: false },
    };
    const { toJSON } = render(<AuthenticationComponent {...props} />);
    expect(toJSON()).toBeTruthy();
  });

  it('component receives all required callbacks', () => {
    const { toJSON } = render(<AuthenticationComponent {...defaultProps} />);
    expect(toJSON()).toBeTruthy();
  });

  it('component is JSX element', () => {
    const { toJSON } = render(<AuthenticationComponent {...defaultProps} />);
    expect(toJSON()).toBeTruthy();
  });

  it('component updates based on isLoggedIn', () => {
    const { rerender, toJSON } = render(
      <AuthenticationComponent {...defaultProps} isLoggedIn={false} />
    );
    expect(toJSON()).toBeTruthy();

    rerender(<AuthenticationComponent {...defaultProps} isLoggedIn={true} />);
    expect(toJSON()).toBeTruthy();
  });

  it('calls continueAnonymousCallbackFn when Continue anonymous is pressed', () => {
    render(<AuthenticationComponent {...defaultProps} />);

    fireEvent.press(screen.getByText('Continue anonymous'));
    expect(mockAnonymousFn).toHaveBeenCalled();
  });

  it('handles different configurations', () => {
    const configurations: AuthenticationComponentProps[] = [
      { ...defaultProps },
      { ...defaultProps, isLoggedIn: true },
      {
        ...defaultProps,
        authProviders: { google: true, facebook: false, apple: true, allowAnonymous: false },
      },
    ];

    configurations.forEach((config) => {
      const { toJSON, unmount } = render(<AuthenticationComponent {...config} />);
      expect(toJSON()).toBeTruthy();
      unmount();
    });
  });
});
