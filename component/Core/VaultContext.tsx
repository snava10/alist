import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { DEFAULT_AUTO_LOCK_MS } from './DataModel';
import { getVaultProfile, saveVaultProfile } from './Storage';
import {
  VaultDeps,
  VaultProfileStore,
  VaultUnlockError,
  lockVaultKey,
  unlockWithPassword,
} from './Vault';

export type VaultContextValue = {
  userId: string;
  /** True while the vault key is absent from memory. Decrypted items must be cleared. */
  locked: boolean;
  /** In-memory Vault Key, or null while locked. Never persisted or logged. */
  vaultKey: Uint8Array | null;
  unlocking: boolean;
  unlockError: string | null;
  /** True when no vault profile exists yet; the first unlock creates it. */
  needsSetup: boolean | null;
  autoLockMs: number;
  /** Changes the inactivity auto-lock delay. Ignored unless positive. */
  setAutoLockMs: (ms: number) => void;
  unlockWithPassword: (password: string) => Promise<boolean>;
  lock: () => void;
  noteActivity: () => void;
};

const VaultContext = createContext<VaultContextValue | null>(null);

const EMPTY_VAULT_DEPS: VaultDeps = {};

export type VaultProviderProps = {
  userId: string;
  /** Inactivity delay before auto-lock. Defaults to DEFAULT_AUTO_LOCK_MS (5 minutes). */
  autoLockMs?: number;
  store?: VaultProfileStore;
  vaultDeps?: VaultDeps;
  children: React.ReactNode;
};

/**
 * Holds the Vault Key in memory only. Locking (inactivity timeout,
 * background/inactive app state, sign-out via unmount, or an explicit
 * call) wipes the key bytes. The migration job does not run here; it
 * is added in Step 10.
 */
export function VaultProvider({
  userId,
  autoLockMs: initialAutoLockMs = DEFAULT_AUTO_LOCK_MS,
  store: storeProp,
  vaultDeps = EMPTY_VAULT_DEPS,
  children,
}: VaultProviderProps) {
  const store = useMemo<VaultProfileStore>(
    () => storeProp ?? { getVaultProfile, saveVaultProfile },
    [storeProp]
  );
  const [currentAutoLockMs, setCurrentAutoLockMs] = useState(initialAutoLockMs);
  const [vaultKey, setVaultKey] = useState<Uint8Array | null>(null);
  const [locked, setLocked] = useState(true);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);

  const vaultKeyRef = useRef<Uint8Array | null>(null);
  const lockedRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const lock = useCallback(() => {
    clearTimer();
    lockVaultKey(vaultKeyRef.current);
    vaultKeyRef.current = null;
    setVaultKey(null);
    setLocked(true);
    lockedRef.current = true;
    setUnlockError(null);
  }, [clearTimer]);

  const scheduleAutoLock = useCallback(() => {
    clearTimer();
    if (currentAutoLockMs > 0) {
      timerRef.current = setTimeout(() => {
        lock();
      }, currentAutoLockMs);
    }
  }, [currentAutoLockMs, clearTimer, lock]);

  const setAutoLockMs = useCallback((ms: number) => {
    if (Number.isFinite(ms) && ms > 0) {
      setCurrentAutoLockMs(ms);
    }
  }, []);

  const noteActivity = useCallback(() => {
    if (lockedRef.current) {
      return;
    }
    scheduleAutoLock();
  }, [scheduleAutoLock]);

  // Auto-lock on background/inactive, and key wipe on unmount.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if ((state === 'background' || state === 'inactive') && !lockedRef.current) {
        lock();
      }
    }) as unknown as { remove?: () => void } | (() => void) | undefined;
    return () => {
      if (typeof subscription === 'function') {
        subscription();
      } else {
        subscription?.remove?.();
      }
      clearTimer();
      lockVaultKey(vaultKeyRef.current);
      vaultKeyRef.current = null;
    };
  }, [clearTimer, lock]);

  // Inactivity auto-lock while unlocked.
  useEffect(() => {
    if (!locked) {
      scheduleAutoLock();
    }
    return clearTimer;
  }, [locked, scheduleAutoLock, clearTimer]);

  // Load whether a vault profile exists, for the lock screen.
  useEffect(() => {
    let cancelled = false;
    store
      .getVaultProfile(userId)
      .then((profile) => {
        if (!cancelled) {
          setNeedsSetup(profile === null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setNeedsSetup(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [userId, store]);

  const handleUnlockWithPassword = useCallback(
    async (password: string): Promise<boolean> => {
      setUnlocking(true);
      setUnlockError(null);
      try {
        const result = await unlockWithPassword(password, userId, store, vaultDeps);
        vaultKeyRef.current = result.vaultKey;
        setVaultKey(result.vaultKey);
        setLocked(false);
        lockedRef.current = false;
        setNeedsSetup(false);
        return true;
      } catch (error) {
        setUnlockError(
          error instanceof VaultUnlockError ? error.message : 'Unlock failed. Please try again.'
        );
        return false;
      } finally {
        setUnlocking(false);
      }
    },
    [store, userId, vaultDeps]
  );

  const value = useMemo<VaultContextValue>(
    () => ({
      userId,
      locked,
      vaultKey,
      unlocking,
      unlockError,
      needsSetup,
      autoLockMs: currentAutoLockMs,
      setAutoLockMs,
      unlockWithPassword: handleUnlockWithPassword,
      lock,
      noteActivity,
    }),
    [
      userId,
      locked,
      vaultKey,
      unlocking,
      unlockError,
      needsSetup,
      currentAutoLockMs,
      setAutoLockMs,
      handleUnlockWithPassword,
      lock,
      noteActivity,
    ]
  );

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}

export function useVaultContext(): VaultContextValue {
  const context = useContext(VaultContext);
  if (!context) {
    throw new Error('useVaultContext must be used within a VaultProvider');
  }
  return context;
}

/** Returns null outside a VaultProvider, for screens also rendered standalone. */
export function useVaultContextOptional(): VaultContextValue | null {
  return useContext(VaultContext);
}
