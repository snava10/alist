const mockAuth = jest.fn();

mockAuth.mockImplementation(() => ({
  onAuthStateChanged: jest.fn(),
}));

export default mockAuth;

export const FirebaseAuthTypes = {};
