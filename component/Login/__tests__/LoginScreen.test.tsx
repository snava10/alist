/* eslint-disable @typescript-eslint/no-explicit-any */
jest.mock('../FacebookLogin', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../GoogleLogin', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../AppleLogin', () => ({
  __esModule: true,
  default: () => null,
}));

// Capture the props passed to AuthenticationComponent for callback testing
let capturedAuthProps: any = null;
jest.mock('../AuthenticationComponent', () => ({
  __esModule: true,
  default: (props: any) => {
    capturedAuthProps = props;
    return null;
  },
}));

import React from 'react';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import auth from '@react-native-firebase/auth';
import LoginScreen from '../LoginScreen';

const Stack = createNativeStackNavigator();

const renderLoginScreen = () =>
  render(
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen name="Login" component={LoginScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );

describe('LoginScreen - Rendering Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedAuthProps = null;
  });

  it('renders and passes correct props to AuthenticationComponent', () => {
    renderLoginScreen();

    expect(capturedAuthProps).not.toBeNull();
    expect(capturedAuthProps.isLoggedIn).toBe(false);
    expect(capturedAuthProps.authProviders).toEqual({
      google: true,
      apple: true,
      facebook: true,
      allowAnonymous: true,
    });
  });

  it('successCallbackFn logs message', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation();
    renderLoginScreen();

    capturedAuthProps.successCallbackFn();
    expect(spy).toHaveBeenCalledWith('Successfully logged in');
    spy.mockRestore();
  });

  it('logOutFn logs message', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation();
    renderLoginScreen();

    capturedAuthProps.logOutFn();
    expect(spy).toHaveBeenCalledWith('Successfully logged out');
    spy.mockRestore();
  });

  it('continueAnonymousCallbackFn calls signInAnonymously', () => {
    const mockSignInAnonymously = jest.fn().mockResolvedValue({});
    (auth as unknown as jest.Mock).mockReturnValue({
      signInAnonymously: mockSignInAnonymously,
      currentUser: null,
      useEmulator: jest.fn(),
    });

    renderLoginScreen();

    capturedAuthProps.continueAnonymousCallbackFn();
    expect(mockSignInAnonymously).toHaveBeenCalled();
  });

  it('deleteAccountFn is a no-op', () => {
    renderLoginScreen();
    // Should not throw
    expect(() => capturedAuthProps.deleteAccountFn()).not.toThrow();
  });
});
