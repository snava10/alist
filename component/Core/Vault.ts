import { utf8ToBytes } from '@noble/hashes/utils.js';
import { KdfParams, VaultProfile } from './DataModel';
import {
  base64ToBytes,
  bytesToBase64,
  computeVerifier,
  DEFAULT_KDF_ITERATIONS,
  deriveMasterKey,
  equalBytes,
  randomBytes,
  SALT_LENGTH,
  unwrapKey,
  VAULT_KEY_LENGTH,
  VaultCryptoError,
  wrapKey,
  zeroBytes,
} from './VaultCrypto';

/**
 * Vault unlock with a separate master password. The password is
 * stretched with the versioned KDF in the vault profile to derive a
 * master key, which unwraps a distinct random Vault Key (transformation
 * plan §5.2). The Vault Key — never the master key — wraps per-item
 * keys, and only the Vault Key is held in memory by the vault provider.
 * The master key is wiped as soon as the vault key is unwrapped (or the
 * password is rejected), is never stored or logged, and there is no
 * recovery key or reset in this step: losing the master password means
 * the vault is unrecoverable. Biometric unlock (Step 9) and device
 * enrolment are separate steps; this module knows nothing about them.
 *
 * Firestore access is injected through VaultProfileStore so unlock
 * stays storage-agnostic and testable without Firebase.
 */

export class VaultUnlockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VaultUnlockError';
  }
}

/** Firestore access for vault profiles, injected so unlock stays storage-agnostic. */
export type VaultProfileStore = {
  getVaultProfile: (userId: string) => Promise<VaultProfile | null>;
  saveVaultProfile: (profile: VaultProfile) => Promise<void>;
};

export type VaultDeps = {
  /** Iteration count for newly created profiles. Tests use a small count. */
  kdfIterations?: number;
};

/** AAD binding the wrapped Vault Key to its purpose. */
export const VAULT_KEY_WRAP_AAD = 'aguslist:vault-key:v1';

export type UnlockResult = {
  /** Random Vault Key, held in memory only until lock. Never persisted. */
  vaultKey: Uint8Array;
  profile: VaultProfile;
  isNewProfile: boolean;
};

function verifierMatches(masterKey: Uint8Array, verifier: string): boolean {
  return equalBytes(utf8ToBytes(computeVerifier(masterKey)), utf8ToBytes(verifier));
}

async function unlockExistingProfile(password: string, profile: VaultProfile): Promise<Uint8Array> {
  if (profile.kdf.kdf !== 'pbkdf2-hmac-sha256' || profile.kdf.version !== 1) {
    throw new VaultUnlockError('This vault profile version is not supported.');
  }
  if (!profile.wrappedVaultKey || !profile.wrappedVaultKeyNonce) {
    throw new VaultUnlockError('This vault profile is incomplete and cannot be unlocked.');
  }
  let masterKey: Uint8Array;
  try {
    masterKey = await deriveMasterKey(password, base64ToBytes(profile.kdf.salt), {
      iterations: profile.kdf.iterations,
      dkLen: profile.kdf.dkLen,
    });
  } catch (error) {
    if (error instanceof VaultCryptoError) {
      throw new VaultUnlockError('The vault could not be unlocked.');
    }
    throw error;
  }
  try {
    if (!verifierMatches(masterKey, profile.verifier)) {
      throw new VaultUnlockError('The master password is incorrect.');
    }
    return unwrapKey(
      { ciphertext: profile.wrappedVaultKey, nonce: profile.wrappedVaultKeyNonce },
      masterKey,
      VAULT_KEY_WRAP_AAD
    );
  } catch (error) {
    if (error instanceof VaultUnlockError) {
      throw error;
    }
    throw new VaultUnlockError('The vault could not be unlocked.');
  } finally {
    zeroBytes(masterKey);
  }
}

async function createProfile(
  password: string,
  userId: string,
  store: VaultProfileStore,
  deps: VaultDeps
): Promise<UnlockResult> {
  const salt = randomBytes(SALT_LENGTH);
  const kdf: KdfParams = {
    kdf: 'pbkdf2-hmac-sha256',
    salt: bytesToBase64(salt),
    iterations: deps.kdfIterations ?? DEFAULT_KDF_ITERATIONS,
    dkLen: VAULT_KEY_LENGTH,
    version: 1,
  };
  const masterKey = await deriveMasterKey(password, salt, {
    iterations: kdf.iterations,
    dkLen: kdf.dkLen,
  });
  const vaultKey = randomBytes(VAULT_KEY_LENGTH);
  try {
    const wrapped = wrapKey(vaultKey, masterKey, VAULT_KEY_WRAP_AAD);
    const newProfile: VaultProfile = {
      userId,
      schemaVersion: 1,
      kdf,
      verifier: computeVerifier(masterKey),
      wrappedVaultKey: wrapped.ciphertext,
      wrappedVaultKeyNonce: wrapped.nonce,
      biometricEnabled: false,
    };
    await store.saveVaultProfile(newProfile);
    return { vaultKey, profile: newProfile, isNewProfile: true };
  } catch (error) {
    zeroBytes(vaultKey);
    throw error;
  } finally {
    zeroBytes(masterKey);
  }
}

/**
 * Unlocks with the master password. When no vault profile exists yet, this
 * first unlock creates the profile (salt, verifier, wrapped Vault Key)
 * for the signed-in account. A wrong password fails closed and wipes the
 * derived key before throwing; the stored profile is never modified by
 * a failed unlock.
 */
export async function unlockWithPassword(
  password: string,
  userId: string,
  store: VaultProfileStore,
  deps: VaultDeps = {}
): Promise<UnlockResult> {
  if (!userId) {
    throw new VaultUnlockError('A signed-in user is required to unlock the vault.');
  }
  if (!password) {
    throw new VaultUnlockError('A master password is required to unlock the vault.');
  }
  const profile = await store.getVaultProfile(userId);
  if (profile) {
    const vaultKey = await unlockExistingProfile(password, profile);
    return { vaultKey, profile, isNewProfile: false };
  }
  return createProfile(password, userId, store, deps);
}

/** Wipes key material in place. The vault provider calls this on every lock. */
export function lockVaultKey(vaultKey: Uint8Array | null | undefined): void {
  zeroBytes(vaultKey);
}
