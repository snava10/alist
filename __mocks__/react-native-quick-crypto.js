// Test-only mock for react-native-quick-crypto. The PBKDF2
// implementation is real: it delegates to Node's OpenSSL-backed
// crypto.pbkdf2, the same primitive class as the native module on
// device. It must never return fixed bytes. Setting
// globalThis.__RNQC_PBKDF2_FAIL__ makes pbkdf2 fail so tests can
// exercise the pure-JS fallback path in VaultCrypto.
const { pbkdf2: nodePbkdf2 } = require('node:crypto');

function pbkdf2(password, salt, iterations, keylen, digest, callback) {
  if (globalThis.__RNQC_PBKDF2_FAIL__) {
    callback(new Error('native unavailable (test-forced)'));
    return;
  }
  nodePbkdf2(password, salt, iterations, keylen, digest, callback);
}

module.exports = { pbkdf2 };
