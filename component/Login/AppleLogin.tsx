import React from 'react';
import { View } from 'react-native';
import { firebase } from '@react-native-firebase/auth';
import { appleAuth, AppleButton } from '@invertase/react-native-apple-authentication';
import { createUserSettings } from "../Core/Storage";
import { AppleSocialButton } from 'react-native-social-buttons';

export default function AppleLogin({ callbackFn }: any) {

  async function onAppleButtonPress() {
    // 1). start a apple sign-in request
    const appleAuthRequestResponse = await appleAuth.performRequest({
      requestedOperation: appleAuth.Operation.LOGIN,
      requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
    });
    // 2). if the request was successful, extract the token and nonce
    const { identityToken, nonce } = appleAuthRequestResponse;
    // can be null in some scenarios
    if (identityToken) {
      // 3). create a Firebase `AppleAuthProvider` credential
      const appleCredential = firebase.auth.AppleAuthProvider.credential(identityToken, nonce);
      // 4). use the created `AppleAuthProvider` credential to start a Firebase auth request,
      //     in this example `signInWithCredential` is used, but you could also call `linkWithCredential`
      //     to link the account to an existing user
      const userCredential = await firebase.auth().signInWithCredential(appleCredential);
      // user is now signed in, any Firebase `onAuthStateChanged` listeners you have will trigger
      console.warn(`Firebase authenticated via Apple, UID: ${userCredential.user.uid}`);
      return userCredential
    } else {
      // handle this - retry?
    }
  }

  return (
    <View>
      {appleAuth.isSupported && (
        <AppleSocialButton onPress={() => onAppleButtonPress().then(async (userCredentials) => {
          if (userCredentials) {
            const userSettings = await createUserSettings(
              userCredentials.user.uid
            );
            console.log(JSON.stringify(userSettings));
            console.log(JSON.stringify(userCredentials))
            callbackFn();
          } else {
            console.error("Error: User credentials are null")
          }
        })
          .catch((error) => console.error("Error " + error))} />        
      )}
    </View>
  );

}