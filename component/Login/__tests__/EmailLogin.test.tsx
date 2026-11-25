import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import EmailLogin from '../EmailLogin';

const mockSignInWithEmailAndPassword = jest.fn();

jest.mock('@react-native-firebase/auth', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    currentUser: null,
    signInWithEmailAndPassword: (...args: unknown[]) => mockSignInWithEmailAndPassword(...args),
    signOut: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('EmailLogin', () => {
  const mockCallbackFn = jest.fn();

  const pressSignIn = async () => {
    await act(async () => {
      fireEvent.press(screen.getByText('Sign in with email'));
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders email and password inputs and a sign-in button', () => {
    render(<EmailLogin callbackFn={mockCallbackFn} />);

    expect(screen.getByPlaceholderText('Email')).toBeTruthy();
    expect(screen.getByPlaceholderText('Password')).toBeTruthy();
    expect(screen.getByText('Sign in with email')).toBeTruthy();
  });

  it('signs in with the trimmed email and password and calls the callback on success', async () => {
    mockSignInWithEmailAndPassword.mockResolvedValue({ user: { uid: 'user-123' } });
    render(<EmailLogin callbackFn={mockCallbackFn} />);

    fireEvent.changeText(screen.getByPlaceholderText('Email'), '  test@alist.local  ');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'TestUser123!');
    await pressSignIn();

    await waitFor(() => {
      expect(mockSignInWithEmailAndPassword).toHaveBeenCalledWith(
        'test@alist.local',
        'TestUser123!'
      );
      expect(mockCallbackFn).toHaveBeenCalled();
    });
  });

  it('does not call sign-in when the fields are empty', async () => {
    render(<EmailLogin callbackFn={mockCallbackFn} />);

    await pressSignIn();

    expect(mockSignInWithEmailAndPassword).not.toHaveBeenCalled();
    expect(mockCallbackFn).not.toHaveBeenCalled();
    expect(screen.getByTestId('email-sign-in-error')).toBeTruthy();
  });

  it('does not call sign-in when the email is invalid', async () => {
    render(<EmailLogin callbackFn={mockCallbackFn} />);

    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'not-an-email');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'TestUser123!');
    await pressSignIn();

    expect(mockSignInWithEmailAndPassword).not.toHaveBeenCalled();
    expect(mockCallbackFn).not.toHaveBeenCalled();
    expect(screen.getByTestId('email-sign-in-error')).toBeTruthy();
  });

  it('does not call sign-in when the password is empty', async () => {
    render(<EmailLogin callbackFn={mockCallbackFn} />);

    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'test@alist.local');
    await pressSignIn();

    expect(mockSignInWithEmailAndPassword).not.toHaveBeenCalled();
    expect(mockCallbackFn).not.toHaveBeenCalled();
    expect(screen.getByTestId('email-sign-in-error')).toBeTruthy();
  });

  it('shows an error and does not call the callback when sign-in fails', async () => {
    mockSignInWithEmailAndPassword.mockRejectedValue(new Error('auth/invalid-credential'));
    render(<EmailLogin callbackFn={mockCallbackFn} />);

    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'test@alist.local');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'wrong-password');
    await pressSignIn();

    await waitFor(() => {
      expect(screen.getByTestId('email-sign-in-error')).toHaveTextContent(
        "Couldn't sign in. Check your email and password and try again."
      );
    });
    expect(mockCallbackFn).not.toHaveBeenCalled();
  });
});
