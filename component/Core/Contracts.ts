import { z } from 'zod';
import { BackupCadence, MembershipType, UserSettings } from './DataModel';

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
export const UserSettingsContract = z
  .object({
    userId: z.string().min(1),
    backup: BackupCadenceSchema,
    membership: MembershipTypeSchema,
    wrappedKey: z.string().min(1).optional(),
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
    encrypted: z.boolean(),
  })
  .strict();

/**
 * Shape of the wrapped-key payload stored in Firestore under UserSettings.
 * `wrappedKey` is base64(16-byte-salt || AES-KW-wrapped-AES-256-key).
 * The passphrase used to derive the wrapping key never leaves the device.
 */
export const WrappedKeyContract = z
  .object({
    userId: z.string().min(1),
    wrappedKey: z.string().min(1),
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

// ── Validators ──

export function validateUserSettings(data: unknown): UserSettings {
  return UserSettingsContract.parse(data) as UserSettings;
}

export function validateFirestoreItem(data: unknown) {
  return FirestoreItemContract.parse(data);
}

export function validateLocalItem(data: unknown) {
  return LocalItemContract.parse(data);
}

export function validateWrappedKey(data: unknown) {
  return WrappedKeyContract.parse(data);
}
