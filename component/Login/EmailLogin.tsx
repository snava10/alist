import React, { useRef, useState } from 'react';
import { View, TextInput, Pressable, Text, StyleSheet } from 'react-native';
import auth from '@react-native-firebase/auth';
import globalStyles from '../Core/GlobalStyles';

const VALIDATION_ERROR = 'Enter a valid email and password.';
const SIGN_IN_ERROR = "Couldn't sign in. Check your email and password and try again.";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function EmailLogin({ callbackFn }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const isSigningInRef = useRef(false);

  const handleSignIn = async () => {
    if (isSigningInRef.current) {
      return;
    }
    const trimmedEmail = email.trim();
    if (!isValidEmail(trimmedEmail) || !password) {
      setError(VALIDATION_ERROR);
      return;
    }
    isSigningInRef.current = true;
    setError(null);
    setIsSigningIn(true);
    try {
      await auth().signInWithEmailAndPassword(trimmedEmail, password);
      callbackFn();
    } catch {
      setError(SIGN_IN_ERROR);
    } finally {
      isSigningInRef.current = false;
      setIsSigningIn(false);
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        testID="email-input"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#6e6e6e"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        editable={!isSigningIn}
      />
      <TextInput
        testID="password-input"
        value={password}
        onChangeText={setPassword}
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#6e6e6e"
        secureTextEntry
        editable={!isSigningIn}
      />
      <Pressable
        testID="email-sign-in-button"
        disabled={isSigningIn}
        style={[globalStyles.button, globalStyles.button.primary.main]}
        onPress={handleSignIn}
      >
        <Text style={globalStyles.button.text.default}>Sign in with email</Text>
      </Pressable>
      {error ? (
        <Text testID="email-sign-in-error" style={styles.error_text}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 220,
    marginTop: 10,
  },
  input: {
    marginBottom: 10,
    alignSelf: 'stretch',
    height: 48,
    borderWidth: 1,
    paddingLeft: 7,
    borderRadius: 5,
    fontSize: 18,
  },
  error_text: {
    color: 'red',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    width: 220,
  },
});
