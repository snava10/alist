import React from "react";
import { View } from "react-native";
import {
  firebase,
  FirebaseAuthTypes,
  linkWithCredential,
} from "@react-native-firebase/auth";
import {
  appleAuth,
  AppleButton,
} from "@invertase/react-native-apple-authentication";
import Storage from "../Core/Storage";
import { AppleSocialButton } from "react-native-social-buttons";

const storage = Storage.getInstance();

export default function AppleLogin({ callbackFn }: any) {
  async function onAppleButtonPress() {
    var retryCount = 2;
    while (retryCount > 0) {
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
        const appleCredential = firebase.auth.AppleAuthProvider.credential(
          identityToken,
          nonce
        );

        // 4). use the created `AppleAuthProvider` credential to start a Firebase auth request,
        //     in this example `signInWithCredential` is used, but you could also call `linkWithCredential`
        //     to link the account to an existing user
        if (firebase.auth().currentUser) {
          const user: FirebaseAuthTypes.User = firebase.auth()
            .currentUser as FirebaseAuthTypes.User;
          return firebase
            .auth()
            .signInWithCredential(appleCredential)
            .then((credentials) => {
              linkWithCredential(user, appleCredential).catch(
                (_) => credentials
              );
            });
        }
        return firebase.auth().signInWithCredential(appleCredential);

        // const userCredential = await firebase.auth().signInWithCredential(appleCredential);
        // // user is now signed in, any Firebase `onAuthStateChanged` listeners you have will trigger
        // console.warn(`Firebase authenticated via Apple, UID: ${userCredential.user.uid}`);
      } else {
        retryCount--;
      }
      return null;
    }
  }

  return (
    <View>
      {appleAuth.isSupported && (
        <AppleSocialButton
          buttonViewStyle={{ backgroundColor: "black" }}
          textStyle={{ color: "white", fontWeight: "bold" }}
          logoStyle={{ tintColor: "white" }}
          onPress={() =>
            onAppleButtonPress()
              .then(async (userCredentials) => {
                if (userCredentials) {
                  const userSettings = await storage.createUserSettings(
                    userCredentials.user.uid
                  );
                  console.log(JSON.stringify(userSettings));
                  console.log(JSON.stringify(userCredentials));
                  callbackFn();
                } else {
                  if (firebase.auth().currentUser?.isAnonymous) {
                    console.error("Error: User credentials are null");
                  } else {
                    console.info(
                      "Login with Apple Succeded but there was an error merging the account with an anonymous user"
                    );
                  }
                  callbackFn();
                }
              })
              .catch((error) => {
                console.log("Error " + error);
                callbackFn();
              })
          }
        />
      )}
    </View>
  );
}
