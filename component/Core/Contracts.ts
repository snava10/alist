import { z } from 'zod';

/**
 * Firestore data contracts.
 * These schemas define the exact shape of data exchanged with Firebase.
 * If the app writes data that doesn't match, or Firebase returns unexpected data,
 * validation will fail and tests will catch it.
 */

// ── Enums ──

export const BackupCadenceSchema = z.enum(['NONE', 'DAILY', 'INSTANT']);

export const MembershipTypeSchema = z.enum(['FREE', 'PREMIUM']);

// ── Firestore Documents ──

/** Shape of a document in the "UserSettings" collection */
export const UserSettingsContract = z.object({
  userId: z.string().min(1),
  backup: BackupCadenceSchema,
  membership: MembershipTypeSchema,
});

/** Shape of a document in the "Items" collection (as stored in Firestore) */
export const FirestoreItemContract = z.object({
  name: z.string().min(1),
  value: z.string(), // base64-encoded in Firestore
  timestamp: z.number(),
  userId: z.string().min(1),
  encrypted: z.boolean().optional(),
});

// ── Local types (what the app works with after decoding) ──

export const LocalItemContract = z.object({
  name: z.string().min(1),
  value: z.string(),
  timestamp: z.number(),
  userId: z.string().optional(),
  encrypted: z.boolean().optional(),
});

// ── Validators ──

export function validateUserSettings(data: unknown) {
  return UserSettingsContract.parse(data);
}

export function validateFirestoreItem(data: unknown) {
  return FirestoreItemContract.parse(data);
}

export function validateLocalItem(data: unknown) {
  return LocalItemContract.parse(data);
}
