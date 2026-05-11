// __mocks__/expo-secure-store.js
module.exports = {
  setItemAsync: jest.fn(async (key, value, options) => true),
  getItemAsync: jest.fn(async (key, options) => null),
  deleteItemAsync: jest.fn(async (key, options) => true),
  isAvailableAsync: jest.fn(async () => true),
};
