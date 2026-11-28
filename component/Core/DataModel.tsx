export enum BackupCadence {
  NONE = 'NONE',
  DAILY = 'DAILY',
  INSTANT = 'INSTANT',
}

export enum MembershipType {
  FREE = 'FREE',
  PREMIUM = 'PREMIUM',
}

export type UserSettings = {
  userId: string;
  backup: BackupCadence;
  membership: MembershipType;
};

export type HomeTabParamList = {
  Home: { itemsReload?: number }; // Define the Home screen params
};

export type AListItem = {
  name: string;
  value: string;
  timestamp: number;
  userId?: string;
  encrypted?: boolean;
};

// ── Vault (schema v2) ─────────────────────────────────────────────────────

/** AEAD algorithm for every vault (schema v2) document. */
export const VAULT_ALGORITHM = 'xchacha20-poly1305' as const;

/** Current vault document schema version. Unknown future versions are rejected. */
export const VAULT_SCHEMA_VERSION = 2 as const;

/** Vault profile schema version. */
export const VAULT_PROFILE_SCHEMA_VERSION = 1 as const;

/**
 * Default inactivity delay before auto-lock. The middle of the 1 / 5 / 15
 * minute options in the transformation plan; the vault provider allows
 * callers to configure a different delay.
 */
export const DEFAULT_AUTO_LOCK_MS = 5 * 60 * 1000;

/**
 * Versioned key-derivation parameters stored in the vault profile (a salt
 * is not secret). Version 1 is the PBKDF2-HMAC-SHA256 fallback recorded
 * in the transformation plan (decision D2): Argon2id is preferred, but
 * only if the Step 3 spike proves a maintained binding. A future KDF is
 * added as a new `version` with its own parameter shape and is rejected
 * by the Step 2 contracts until then — never guessed.
 */
export type KdfParams = {
  kdf: 'pbkdf2-hmac-sha256';
  /** Base64 salt, generated once per account with a CSPRNG. */
  salt: string;
  /** PBKDF2 iteration count (OWASP recommendation for HMAC-SHA256). */
  iterations: number;
  /** Derived key length in bytes. */
  dkLen: number;
  /** Parameter-set version, so the KDF can be upgraded later. */
  version: 1;
};

/**
 * Per-account vault profile stored in Firestore. It holds KDF parameters
 * and a password verifier, plus wrapped key material. It never holds a
 * master password, a vault key in cleartext, or any item content.
 *
 * "Vault key" below means the key that wraps per-item keys. Step 5
 * decides whether it is the derived key itself or a distinct random key
 * wrapped by the derived key (the transformation plan's §5.2 hierarchy);
 * the profile accepts both shapes so this step does not prejudge that
 * decision. The biometric wrapped copy wraps the same vault key.
 */
export type VaultProfile = {
  userId: string;
  schemaVersion: typeof VAULT_PROFILE_SCHEMA_VERSION;
  kdf: KdfParams;
  /** Base64 hash of the derived key; detects a wrong master password. */
  verifier: string;
  /**
   * Wrapped vault key, present only when the vault key is a distinct
   * random key wrapped by the derived key.
   */
  wrappedVaultKey?: string | undefined;
  /** Base64 nonce for the wrapped vault key, when present. */
  wrappedVaultKeyNonce?: string | undefined;
  biometricEnabled: boolean;
  /** Base64 wrapped vault key for biometric unlock, when enabled. */
  biometricWrappedKey?: string | undefined;
  /** Base64 nonce for the biometric-wrapped vault key, when enabled. */
  biometricWrapNonce?: string | undefined;
};

/**
 * A vault item as stored in Firestore. The name and value are encrypted
 * together in `ciphertext`; no plaintext key, value, or search index is
 * stored, and the document ID is a random UUID, never derived from
 * content.
 */
export type VaultItemDocument = {
  id: string;
  userId: string;
  ciphertext: string;
  nonce: string;
  wrappedItemKey: string;
  wrappedKeyNonce: string;
  algorithm: typeof VAULT_ALGORITHM;
  schemaVersion: typeof VAULT_SCHEMA_VERSION;
  version: number;
  createdAt: number;
  updatedAt: number;
  migratedFrom?: string | undefined;
};

/** A decrypted vault item held in memory only, while the vault is unlocked. */
export type VaultItem = {
  id: string;
  name: string;
  value: string;
  /** Display/sort time, equal to `updatedAt`. */
  timestamp: number;
  userId: string;
  version: number;
  updatedAt: number;
};

/**
 * Quarantine entry for one undecryptable document. No value, no name.
 * `reason` is a machine-readable code such as `undecryptable`,
 * `malformed-document`, or `owner-mismatch`.
 */
export type QuarantineRecord = {
  legacyDocId: string;
  reason: string;
  at: number;
};

/**
 * Migration accounting. The invariant
 * `legacyTotal = migrated + quarantined + pending` always holds.
 */
export type MigrationReport = {
  legacyTotal: number;
  migrated: number;
  quarantined: number;
  pending: number;
  quarantinedItems: QuarantineRecord[];
};
