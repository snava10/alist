import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import globalStyles from './Core/GlobalStyles';
import { useVaultContext } from './Core/VaultContext';

/**
 * Vault lock screen. The master-password form is always shown: a failed
 * unlock falls back to retrying it here, and the vault stays locked with
 * no items visible. Copy states plainly that a forgotten master
 * password cannot be recovered, because there is no reset or backdoor.
 */
export default function LockScreen() {
  const vault = useVaultContext();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const title = vault.needsSetup === true ? 'Create your vault password' : 'Unlock your vault';

  const handleUnlock = async () => {
    const ok = await vault.unlockWithPassword(password);
    if (ok) {
      setPassword('');
    }
  };

  return (
    <View testID="lock-screen" style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>
        Your vault is locked. The master password unlocks it on this device only.
      </Text>
      <TextInput
        testID="master-password-input"
        style={styles.input}
        placeholder="Master password"
        placeholderTextColor="#6e6e6e"
        secureTextEntry={!showPassword}
        autoCapitalize="none"
        autoCorrect={false}
        value={password}
        onChangeText={setPassword}
      />
      <Pressable
        testID="toggle-password-visibility"
        accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
        style={styles.textButton}
        onPress={() => setShowPassword(!showPassword)}
      >
        <Text>{showPassword ? 'Hide password' : 'Show password'}</Text>
      </Pressable>
      {vault.unlockError ? (
        <Text testID="lock-error" style={styles.error}>
          {vault.unlockError}
        </Text>
      ) : null}
      <Pressable
        testID="unlock-button"
        accessibilityLabel="Unlock vault"
        disabled={vault.unlocking || password.length === 0}
        style={[globalStyles.button, globalStyles.button.primary.main, styles.unlockButton]}
        onPress={handleUnlock}
      >
        <Text style={globalStyles.button.text.default}>
          {vault.unlocking ? 'Unlocking…' : 'Unlock'}
        </Text>
      </Pressable>
      <Text style={styles.warning}>
        If you forget your master password, your vault cannot be recovered. There is no password
        reset.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: 'gray',
    borderRadius: 5,
    paddingLeft: 7,
    fontSize: 18,
    marginBottom: 8,
  },
  textButton: {
    alignSelf: 'flex-end',
    paddingVertical: 8,
    marginBottom: 8,
  },
  error: {
    color: 'red',
    fontSize: 14,
    marginBottom: 8,
    textAlign: 'center',
  },
  unlockButton: {
    marginVertical: 6,
  },
  warning: {
    fontSize: 14,
    marginTop: 24,
    textAlign: 'center',
  },
});
