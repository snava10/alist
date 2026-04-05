import React, { useEffect } from 'react';
import { View, Pressable, Text } from 'react-native';
import * as Facebook from 'expo-auth-session/providers/facebook';
import * as WebBrowser from 'expo-web-browser';
import auth from '@react-native-firebase/auth';

WebBrowser.maybeCompleteAuthSession();

const FACEBOOK_APP_ID = '256292256803627';

export default function FacebookLogin() {
  const [request, response, promptAsync] = Facebook.useAuthRequest({
    clientId: FACEBOOK_APP_ID,
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { access_token } = response.params;
      if (!access_token) {
        console.error('No access token received from Facebook');
        return;
      }
      const facebookCredential = auth.FacebookAuthProvider.credential(access_token);
      auth()
        .signInWithCredential(facebookCredential)
        .then(() => {
          console.log('Login Success');
        })
        .catch((error) => {
          console.error('Firebase sign-in error:', error);
        });
    }
  }, [response]);

  return (
    <View>
      <Pressable
        disabled={!request}
        onPress={() => promptAsync()}
        style={{
          backgroundColor: '#1877F2',
          paddingVertical: 12,
          paddingHorizontal: 20,
          borderRadius: 6,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
          Continue with Facebook
        </Text>
      </Pressable>
    </View>
  );
}
