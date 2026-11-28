import { VaultProfile } from '../DataModel';
import {
  VAULT_KEY_WRAP_AAD,
  VaultProfileStore,
  VaultUnlockError,
  lockVaultKey,
  unlockWithPassword,
} from '../Vault';
import {
  base64ToBytes,
  computeVerifier,
  deriveMasterKey,
  randomBytes,
  unwrapKey,
  VAULT_KEY_LENGTH,
} from '../VaultCrypto';

const PASSWORD = 'correct horse battery staple';
const DEPS = { kdfIterations: 100 };

function makeStore() {
  const profiles = new Map<string, VaultProfile>();
  const store: VaultProfileStore = {
    getVaultProfile: async (userId: string) => profiles.get(userId) ?? null,
    saveVaultProfile: async (profile: VaultProfile) => {
      profiles.set(profile.userId, profile);
    },
  };
  return { store, profiles };
}

describe('unlockWithPassword', () => {
  it('creates a profile on first unlock with a wrapped Vault Key', async () => {
    const { store, profiles } = makeStore();
    const result = await unlockWithPassword(PASSWORD, 'u1', store, DEPS);

    expect(result.vaultKey).toHaveLength(VAULT_KEY_LENGTH);
    expect(result.isNewProfile).toBe(true);
    const saved = profiles.get('u1');
    expect(saved).toBeDefined();
    expect(saved?.schemaVersion).toBe(1);
    expect(saved?.biometricEnabled).toBe(false);
    expect(saved?.kdf).toMatchObject({
      kdf: 'pbkdf2-hmac-sha256',
      iterations: 100,
      dkLen: VAULT_KEY_LENGTH,
      version: 1,
    });
    expect(saved?.wrappedVaultKey).toBeDefined();
    expect(saved?.wrappedVaultKeyNonce).toBeDefined();

    // The stored verifier and wrapped key check out against an
    // independently derived master key: the Vault Key is distinct from
    // the derived key and recoverable only with the right password.
    const masterKey = await deriveMasterKey(PASSWORD, base64ToBytes(saved?.kdf.salt ?? ''), {
      iterations: 100,
      dkLen: VAULT_KEY_LENGTH,
    });
    expect(computeVerifier(masterKey)).toBe(saved?.verifier);
    expect(
      unwrapKey(
        { ciphertext: saved?.wrappedVaultKey ?? '', nonce: saved?.wrappedVaultKeyNonce ?? '' },
        masterKey,
        VAULT_KEY_WRAP_AAD
      )
    ).toEqual(result.vaultKey);
  });

  it('returns the same Vault Key on later unlocks with the same password', async () => {
    const { store } = makeStore();
    const first = await unlockWithPassword(PASSWORD, 'u1', store, DEPS);
    const second = await unlockWithPassword(PASSWORD, 'u1', store, DEPS);
    expect(second.isNewProfile).toBe(false);
    expect(second.vaultKey).toEqual(first.vaultKey);
    expect(second.profile).toEqual(first.profile);
  });

  it('rejects a wrong password and leaves the profile usable', async () => {
    const { store, profiles } = makeStore();
    const first = await unlockWithPassword(PASSWORD, 'u1', store, DEPS);
    const savedBefore = profiles.get('u1');
    await expect(unlockWithPassword('wrong horse', 'u1', store, DEPS)).rejects.toThrow(
      VaultUnlockError
    );
    expect(profiles.get('u1')).toEqual(savedBefore);
    const retry = await unlockWithPassword(PASSWORD, 'u1', store, DEPS);
    expect(retry.vaultKey).toEqual(first.vaultKey);
  });

  it('rejects an empty password and an empty user id', async () => {
    const { store } = makeStore();
    await expect(unlockWithPassword('', 'u1', store, DEPS)).rejects.toThrow(VaultUnlockError);
    await expect(unlockWithPassword(PASSWORD, '', store, DEPS)).rejects.toThrow(VaultUnlockError);
  });

  it('keeps vaults for different users isolated', async () => {
    const { store } = makeStore();
    const first = await unlockWithPassword(PASSWORD, 'u1', store, DEPS);
    const second = await unlockWithPassword(PASSWORD, 'u2', store, DEPS);
    expect(second.vaultKey).not.toEqual(first.vaultKey);
    expect(second.profile.kdf.salt).not.toBe(first.profile.kdf.salt);
  });

  it('rejects a profile with an unsupported KDF without modifying it', async () => {
    const { store, profiles } = makeStore();
    const planted = {
      userId: 'u1',
      schemaVersion: 1,
      kdf: {
        kdf: 'argon2id',
        salt: 'AAAAAAAAAAAAAAAAAAAAAA==',
        iterations: 3,
        dkLen: 32,
        version: 1,
      },
      verifier: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
      biometricEnabled: false,
    } as unknown as VaultProfile;
    profiles.set('u1', planted);
    await expect(unlockWithPassword(PASSWORD, 'u1', store, DEPS)).rejects.toThrow(/not supported/);
    expect(profiles.get('u1')).toBe(planted);
  });

  it('rejects a profile with an unsupported KDF version', async () => {
    const { store, profiles } = makeStore();
    const created = await unlockWithPassword(PASSWORD, 'u1', store, DEPS);
    const planted: VaultProfile = {
      ...created.profile,
      kdf: { ...created.profile.kdf, version: 2 as unknown as 1 },
    };
    profiles.set('u1', planted);
    await expect(unlockWithPassword(PASSWORD, 'u1', store, DEPS)).rejects.toThrow(/not supported/);
  });

  it('rejects a profile missing the wrapped Vault Key', async () => {
    const { store, profiles } = makeStore();
    const created = await unlockWithPassword(PASSWORD, 'u1', store, DEPS);
    const { wrappedVaultKey: _wrapped, wrappedVaultKeyNonce: _nonce, ...rest } = created.profile;
    profiles.set('u1', rest as VaultProfile);
    await expect(unlockWithPassword(PASSWORD, 'u1', store, DEPS)).rejects.toThrow(/incomplete/);
  });

  it('rejects a tampered verifier as an incorrect password', async () => {
    const { store, profiles } = makeStore();
    const created = await unlockWithPassword(PASSWORD, 'u1', store, DEPS);
    profiles.set('u1', {
      ...created.profile,
      verifier: 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=',
    });
    await expect(unlockWithPassword(PASSWORD, 'u1', store, DEPS)).rejects.toThrow(/incorrect/);
  });

  it('rejects a tampered wrapped Vault Key', async () => {
    const { store, profiles } = makeStore();
    const created = await unlockWithPassword(PASSWORD, 'u1', store, DEPS);
    const ciphertext = created.profile.wrappedVaultKey ?? '';
    const tampered = (ciphertext[0] === 'A' ? 'B' : 'A') + ciphertext.slice(1);
    profiles.set('u1', { ...created.profile, wrappedVaultKey: tampered });
    await expect(unlockWithPassword(PASSWORD, 'u1', store, DEPS)).rejects.toThrow(VaultUnlockError);
  });

  it('fails closed when saving the new profile fails, storing nothing', async () => {
    const failingStore: VaultProfileStore = {
      getVaultProfile: async () => null,
      saveVaultProfile: async () => {
        throw new Error('store unavailable');
      },
    };
    await expect(unlockWithPassword(PASSWORD, 'u1', failingStore, DEPS)).rejects.toThrow(
      'store unavailable'
    );
    await expect(failingStore.getVaultProfile('u1')).resolves.toBeNull();
  });

  it('uses the configured KDF iteration count for new profiles', async () => {
    const { store } = makeStore();
    const result = await unlockWithPassword(PASSWORD, 'u1', store, { kdfIterations: 1000 });
    expect(result.profile.kdf.iterations).toBe(1000);
  });

  it('lockVaultKey wipes key bytes in place', () => {
    const key = randomBytes(VAULT_KEY_LENGTH);
    lockVaultKey(key);
    expect(key).toEqual(new Uint8Array(VAULT_KEY_LENGTH));
    lockVaultKey(null);
    lockVaultKey(undefined);
  });

  it('unlocks stably with a unicode password and rejects a different one', async () => {
    const { store } = makeStore();
    const first = await unlockWithPassword('pässwörd 🔑', 'u1', store, DEPS);
    const second = await unlockWithPassword('pässwörd 🔑', 'u1', store, DEPS);
    expect(second.vaultKey).toEqual(first.vaultKey);
    await expect(unlockWithPassword('password', 'u1', store, DEPS)).rejects.toThrow(/incorrect/);
  });
});
