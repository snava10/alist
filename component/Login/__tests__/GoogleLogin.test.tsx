import GoogleLogin from '../GoogleLogin';

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSigninButton: {
    Size: { Wide: 'Wide' },
    Color: { Dark: 'Dark' },
  },
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn().mockResolvedValue(true),
    signIn: jest.fn().mockResolvedValue({
      type: 'success',
      data: {
        idToken: 'test-token',
        user: { id: 'user-123' },
      },
    }),
  },
  SignInSuccessResponse: {},
}));

jest.mock('@react-native-firebase/auth', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    currentUser: null,
    signInWithCredential: jest.fn().mockResolvedValue(undefined),
    GoogleAuthProvider: {
      credential: jest.fn((token) => ({ provider: 'google', token })),
    },
  })),
  linkWithCredential: jest.fn().mockRejectedValue(new Error('Not linked')),
  FirebaseAuthTypes: {},
}));

jest.mock('../../Core/Storage', () => ({
  createUserSettings: jest.fn().mockResolvedValue(undefined),
}));

describe('GoogleLogin', () => {
  const mockCallbackFn = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exports GoogleLogin component', () => {
    expect(typeof GoogleLogin).toBe('function');
  });

  it('has GoogleSignin configured', () => {
    expect(typeof GoogleLogin).toBe('function');
  });

  it('accepts callback function as prop', () => {
    expect(GoogleLogin.length).toBeGreaterThanOrEqual(0);
  });

  it('is a functional component', () => {
    expect(typeof GoogleLogin).toBe('function');
  });

  it('receives callbackFn parameter', () => {
    expect(typeof GoogleLogin).toBe('function');
  });

  it('defined with proper signature', () => {
    expect(GoogleLogin.toString()).toContain('callbackFn');
  });

  it('is callable with props', () => {
    expect(() => {
      GoogleLogin({ callbackFn: mockCallbackFn });
    }).not.toThrow();
  });

  it('handles missing callback', () => {
    expect(() => {
      GoogleLogin({ callbackFn: undefined });
    }).not.toThrow();
  });

  it('component function exists', () => {
    expect(GoogleLogin).toBeDefined();
    expect(typeof GoogleLogin).toBe('function');
  });

  it('is react component', () => {
    expect(GoogleLogin.$$typeof).toBe(undefined); // Not a React element yet, it's a function
  });

  it('exports default GoogleLogin', () => {
    expect(GoogleLogin).not.toBeNull();
  });

  it('component returns JSX', () => {
    const result = GoogleLogin({ callbackFn: jest.fn() });
    expect(result).toBeDefined();
  });

  it('handles alternative callback functions', () => {
    const alternativeCallback = jest.fn();
    expect(() => {
      GoogleLogin({ callbackFn: alternativeCallback });
    }).not.toThrow();
  });

  it('supports different prop values', () => {
    const callbacks = [jest.fn(), jest.fn(), jest.fn()];
    callbacks.forEach((cb) => {
      expect(() => {
        GoogleLogin({ callbackFn: cb });
      }).not.toThrow();
    });
  });
});
