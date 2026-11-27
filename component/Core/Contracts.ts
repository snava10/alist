import { z } from 'zod';
import {
  BackupCadence,
  KdfParams,
  MembershipType,
  UserSettings,
  VAULT_ALGORITHM,
  VAULT_PROFILE_SCHEMA_VERSION,
  VAULT_SCHEMA_VERSION,
  VaultItemDocument,
  VaultProfile,
} from './DataModel';

/**
 * Firestore data contracts.
 * These schemas define the exact shape of data exchanged with Firebase.
 * If the app writes data that doesn't match, or Firebase returns unexpected data,
 * validation will fail and tests will catch it.
 */

// ── Enums ──

export const BackupCadenceSchema = z.nativeEnum(BackupCadence);

export const MembershipTypeSchema = z.nativeEnum(MembershipType);

// ── Firestore Documents ──

/** Shape of a document in the "UserSettings" collection */
export const UserSettingsContract: z.ZodType<UserSettings> = z
  .object({
    userId: z.string().min(1),
    backup: BackupCadenceSchema,
    membership: MembershipTypeSchema,
  })
  .strict();

const base64Regex = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

/** Shape of a document in the "Items" collection (as stored in Firestore) */
export const FirestoreItemContract = z
  .object({
    name: z.string().min(1),
    value: z.string().regex(base64Regex, 'value must be a valid base64-encoded string'),
    timestamp: z.number(),
    userId: z.string().min(1),
    encrypted: z.boolean().optional(),
    searchIndex: z.array(z.string().min(1)).optional(),
  })
  .strict();

// ── Local types (what the app works with after decoding) ──

export const LocalItemContract = z
  .object({
    name: z.string().min(1),
    value: z.string(),
    timestamp: z.number(),
    userId: z.string().optional(),
    encrypted: z.boolean().optional(),
  })
  .strict();

// ── Vault Documents (schema v2) ──

/** Non-empty base64 string. The regex alone also matches the empty string. */
const base64Field = (label: string) =>
  z.string().min(1).regex(base64Regex, `${label} must be a valid base64-encoded string`);

/**
 * Versioned KDF parameters. Version 1 covers only the PBKDF2 fallback;
 * an Argon2id parameter set is a future version and is rejected until
 * the Step 3 spike defines it — never accepted on a guess.
 */
export const KdfParamsContract: z.ZodType<KdfParams> = z
  .object({
    kdf: z.literal('pbkdf2-hmac-sha256'),
    salt: base64Field('salt'),
    iterations: z.number().int().positive(),
    dkLen: z.number().int().positive(),
    version: z.literal(1),
  })
  .strict();

/**
 * Shape of a document in the "VaultProfiles" collection. Only ciphertext,
 * wrapped keys, KDF parameters, and a verifier are stored; never a master
 * password, a cleartext key, or item content. A profile claiming
 * biometric unlock must carry both wrapped-key fields, and a wrapped
 * vault key must carry its nonce with it.
 */
export const VaultProfileContract = z
  .object({
    userId: z.string().min(1),
    schemaVersion: z.literal(VAULT_PROFILE_SCHEMA_VERSION),
    kdf: KdfParamsContract,
    verifier: base64Field('verifier'),
    wrappedVaultKey: base64Field('wrappedVaultKey').optional(),
    wrappedVaultKeyNonce: base64Field('wrappedVaultKeyNonce').optional(),
    biometricEnabled: z.boolean(),
    biometricWrappedKey: base64Field('biometricWrappedKey').optional(),
    biometricWrapNonce: base64Field('biometricWrapNonce').optional(),
  })
  .strict()
  .superRefine((profile, ctx) => {
    const hasWrappedKey = profile.wrappedVaultKey !== undefined;
    const hasWrappedNonce = profile.wrappedVaultKeyNonce !== undefined;
    if (hasWrappedKey !== hasWrappedNonce) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['wrappedVaultKeyNonce'],
        message: 'wrappedVaultKey and wrappedVaultKeyNonce must be present together',
      });
    }
    if (
      profile.biometricEnabled &&
      (profile.biometricWrappedKey === undefined || profile.biometricWrapNonce === undefined)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['biometricWrappedKey'],
        message: 'biometric unlock requires both biometricWrappedKey and biometricWrapNonce',
      });
    }
  });

/** Shape of a document in the "VaultItems" collection (as stored in Firestore) */
export const VaultItemDocumentContract: z.ZodType<VaultItemDocument> = z
  .object({
    id: z.string().uuid(),
    userId: z.string().min(1),
    ciphertext: base64Field('ciphertext'),
    nonce: base64Field('nonce'),
    wrappedItemKey: base64Field('wrappedItemKey'),
    wrappedKeyNonce: base64Field('wrappedKeyNonce'),
    algorithm: z.literal(VAULT_ALGORITHM),
    schemaVersion: z.literal(VAULT_SCHEMA_VERSION),
    version: z.number().int().min(1),
    createdAt: z.number().int().nonnegative(),
    updatedAt: z.number().int().nonnegative(),
    migratedFrom: z.string().min(1).optional(),
  })
  .strict();

// ── Validators ──

export function validateKdfParams(data: unknown): KdfParams {
  return KdfParamsContract.parse(data);
}

export function validateVaultProfile(data: unknown): VaultProfile {
  return VaultProfileContract.parse(data);
}

export function validateVaultItemDocument(data: unknown): VaultItemDocument {
  return VaultItemDocumentContract.parse(data);
}

// ── Decrypted Vault Payload ──

/**
 * Plaintext payload encrypted inside one vault item: the key and value
 * together. Validated after AEAD decryption, before any caller sees it.
 */
export const VaultItemPayloadContract = z
  .object({
    name: z.string().min(1),
    value: z.string(),
  })
  .strict();

export function validateVaultItemPayload(data: unknown): { name: string; value: string } {
  return VaultItemPayloadContract.parse(data);
}

export function validateUserSettings(data: unknown): UserSettings {
  return UserSettingsContract.parse(data);
}

export function validateFirestoreItem(data: unknown) {
  return FirestoreItemContract.parse(data);
}

export function validateLocalItem(data: unknown) {
  return LocalItemContract.parse(data);
}
