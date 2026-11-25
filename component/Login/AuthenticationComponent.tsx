import { View, StyleSheet, Text, Pressable } from 'react-native';
import React, { useEffect, useRef, useState } from 'react';
import FacebookLogin from './FacebookLogin';
import GoogleLogin from './GoogleLogin';
import globalStyles from '../Core/GlobalStyles';
import AppleLogin from './AppleLogin';
import EmailLogin from './EmailLogin';
import { FirebaseAuthTypes } from '@react-native-firebase/auth';

export type AuthenticationComponentProps = {
  isLoggedIn: boolean;
  successCallbackFn: (user: FirebaseAuthTypes.User | null) => void;
  logOutFn: () => void;
  continueAnonymousCallbackFn?: () => Promise<unknown> | void;
  deleteAccountFn: () => void;
  authProviders: {
    google?: boolean;
    facebook?: boolean;
    apple?: boolean;
    twitter?: boolean;
    microsoft?: boolean;
    emailAndPassword?: boolean;
    allowAnonymous?: boolean;
  };
};

export default function AuthenticationComponent({
  isLoggedIn,
  successCallbackFn,
  logOutFn,
  authProviders,
  continueAnonymousCallbackFn,
  deleteAccountFn,
}: AuthenticationComponentProps) {
  const [_isLoggedIn, setIsLoggedIn] = useState(isLoggedIn);
  const [anonymousError, setAnonymousError] = useState<string | null>(null);
  const [isSigningInAnonymously, setIsSigningInAnonymously] = useState(false);
  const isSigningInRef = useRef(false);
  useEffect(() => {
    setIsLoggedIn(isLoggedIn);
  }, [isLoggedIn]);

  const handleContinueAnonymous = async () => {
    if (isSigningInRef.current || !continueAnonymousCallbackFn) {
      return;
    }
    isSigningInRef.current = true;
    setAnonymousError(null);
    setIsSigningInAnonymously(true);
    try {
      await continueAnonymousCallbackFn();
      setIsLoggedIn(true);
    } catch {
      setAnonymousError("Couldn't continue anonymously. Check your connection and try again.");
    } finally {
      isSigningInRef.current = false;
      setIsSigningInAnonymously(false);
    }
  };

  return _isLoggedIn ? (
    <View style={{ flex: 1 }}>
      <View style={styles.child_view}>
        <Pressable
          style={[globalStyles.button, globalStyles.button.primary.main]}
          onPress={logOutFn}
        >
          <Text style={globalStyles.button.text.default}>Log Out</Text>
        </Pressable>
      </View>
      <View style={styles.child_view}>
        <Pressable
          style={[globalStyles.button, globalStyles.button.primary.outlined]}
          onPress={deleteAccountFn}
        >
          <Text style={globalStyles.button.text.dangerSmall}>Delete Account</Text>
        </Pressable>
      </View>
    </View>
  ) : (
    <View style={{ flex: 1 }}>
      <View style={styles.child_view}>
        {authProviders.facebook ? <FacebookLogin></FacebookLogin> : <></>}
        {authProviders.google ? <GoogleLogin callbackFn={successCallbackFn}></GoogleLogin> : <></>}
        {authProviders.apple ? <AppleLogin callbackFn={successCallbackFn}></AppleLogin> : <></>}
        {authProviders.emailAndPassword ? (
          <EmailLogin callbackFn={successCallbackFn}></EmailLogin>
        ) : (
          <></>
        )}
        {authProviders.allowAnonymous ? (
          <>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 50,
                paddingVertical: 10,
              }}
            >
              <View style={{ flex: 1, height: 1, backgroundColor: '#b0afac' }} />
              <View>
                <Text
                  style={{
                    width: 50,
                    textAlign: 'center',
                    color: '#b0afac',
                    fontWeight: 'bold',
                    fontSize: 20,
                  }}
                >
                  or
                </Text>
              </View>
              <View style={{ flex: 1, height: 1, backgroundColor: '#b0afac' }} />
            </View>
            <Pressable
              disabled={isSigningInAnonymously}
              style={({ pressed }) => [
                globalStyles.button,
                { height: 40, width: 220 },
                pressed ? globalStyles.button.primary.dark : globalStyles.button.primary.main,
              ]}
              onPress={handleContinueAnonymous}
            >
              <Text style={globalStyles.button.text.default}>Continue anonymous</Text>
            </Pressable>
            {anonymousError ? (
              <Text testID="anonymous-sign-in-error" style={styles.error_text}>
                {anonymousError}
              </Text>
            ) : null}
          </>
        ) : (
          <></>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  child_view: {
    flex: 1,
    justifyContent: 'center',
    alignSelf: 'center',
  },
  error_text: {
    color: 'red',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    width: 220,
  },
});
