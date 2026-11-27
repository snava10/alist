// Test-only mock for expo-crypto. Randomness is real: it delegates to
// Node's WebCrypto CSPRNG. It must never return fixed or predictable
// bytes — identity-mocked randomness would make crypto tests vacuous.
const { webcrypto } = require('node:crypto');

module.exports = {
  getRandomValues: (typedArray) => webcrypto.getRandomValues(typedArray),
};
