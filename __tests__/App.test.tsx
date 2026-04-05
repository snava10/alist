/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { render, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Mock Ionicons before importing App
jest.mock('@expo/vector-icons/Ionicons', () => {
  return function MockIonicons() {
    return null;
  };
});

// Mock React Navigation
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  NavigationContainer: ({ children }: any) => children,
}));

// Mock bottom tab navigator
jest.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: () => ({
    Navigator: ({ children }: any) => children,
    Screen: ({ component: Component, name, initialParams }: any) => (
      <Component key={name} route={{ params: initialParams }} />
    ),
  }),
}));

// Mock native stack navigator
jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => ({
    Navigator: ({ children, _ }: any) => children,
    Screen: ({ component: Component, name, initialParams }: any) => (
      <Component key={name} route={{ params: initialParams }} />
    ),
  }),
}));

// Mock child components
jest.mock('../component/HomeScreen', () => {
  return function MockHomeScreen() {
    return <div>HomeScreen</div>;
  };
});

jest.mock('../component/ProfileScreen', () => {
  return function MockProfileScreen() {
    return <div>ProfileScreen</div>;
  };
});

jest.mock('../component/Login/LoginScreen', () => {
  return function MockLoginScreen() {
    return <div>LoginScreen</div>;
  };
});

// Import App after all mocks are set up
import App from '../App';
import auth from '@react-native-firebase/auth';

describe('App', () => {
  let mockOnAuthStateChanged: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnAuthStateChanged = jest.fn();

    // Mock the auth() function to return an object with onAuthStateChanged
    (auth as any).mockImplementation(() => ({
      onAuthStateChanged: mockOnAuthStateChanged,
    }));
  });

  it('renders without crashing', () => {
    // Mock the unsubscribe function
    mockOnAuthStateChanged.mockReturnValue(jest.fn());

    const { toJSON } = render(<App />);
    expect(toJSON()).toBeTruthy();
  });

  it('subscribes to auth state changes on mount', () => {
    mockOnAuthStateChanged.mockReturnValue(jest.fn());

    render(<App />);

    expect(mockOnAuthStateChanged).toHaveBeenCalled();
  });

  it('unsubscribes from auth state changes on unmount', () => {
    const mockUnsubscribe = jest.fn();
    mockOnAuthStateChanged.mockReturnValue(mockUnsubscribe);

    const { unmount } = render(<App />);

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('sets up auth listener with callback function', () => {
    mockOnAuthStateChanged.mockReturnValue(jest.fn());

    render(<App />);

    // Verify onAuthStateChanged was called with a callback function
    expect(mockOnAuthStateChanged).toHaveBeenCalledWith(expect.any(Function));
  });

  it('handles user authentication state transitions', () => {
    const mockUser = {
      uid: 'test-user-123',
      displayName: 'Test User',
    };

    let capturedCallback: any;
    mockOnAuthStateChanged.mockImplementation((callback: any) => {
      capturedCallback = callback;
      return jest.fn();
    });

    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    const { toJSON } = render(<App />);

    // Verify callback was captured
    expect(capturedCallback).toBeDefined();
    expect(typeof capturedCallback).toBe('function');

    // Test authenticated state: call callback with a user
    act(() => {
      capturedCallback(mockUser);
    });

    expect(consoleLogSpy).toHaveBeenCalledWith('Display Name', mockUser.displayName);
    expect(toJSON()).toBeTruthy();

    // Test unauthenticated state: call callback with null
    act(() => {
      capturedCallback(null);
    });
    expect(toJSON()).toBeTruthy();

    consoleLogSpy.mockRestore();
  });

  it('renders with SafeAreaProvider', () => {
    mockOnAuthStateChanged.mockReturnValue(jest.fn());

    const { toJSON } = render(
      <SafeAreaProvider>
        <App />
      </SafeAreaProvider>
    );

    expect(toJSON()).toBeTruthy();
  });

  it('sets up proper login screen properties', () => {
    mockOnAuthStateChanged.mockReturnValue(jest.fn());

    const { toJSON } = render(<App />);

    // Verify the component renders
    const tree = toJSON();
    expect(tree).toBeTruthy();
  });
});
