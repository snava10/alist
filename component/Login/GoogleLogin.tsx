import React from "react";
import { View } from "react-native";
import {
  GoogleSigninButton,
  GoogleSignin,
  SignInSuccessResponse,
} from "@react-native-google-signin/google-signin";
import auth, {
  FirebaseAuthTypes,
  linkWithCredential,
} from "@react-native-firebase/auth";
import { createUserSettings } from "../Core/Storage";
import { GoogleSocialButton } from "react-native-social-buttons";

GoogleSignin.configure({
  webClientId:
    // "183439267259-3fdekennuneoalsccieeaj44v781r3b4.apps.googleusercontent.com",
    "183439267259-12mtdreenqc4shhl3ab9ddnbhb00auu0.apps.googleusercontent.com",
  // "183439267259-4h0561svmr0ab771gq0nlgpj4640g459.apps.googleusercontent.com",
  // "183439267259-lte4rjvdj437i3r8904ck1vsflf7k7dv.apps.googleusercontent.com",
});

async function onGoogleButtonPress() {
  // Check if your device supports Google Play
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  // Get the users ID token
  var response = await GoogleSignin.signIn();
  if (response.type == "success") {
    // Create a Google credential with the token
    response = response as SignInSuccessResponse;
    const googleCredential = auth.GoogleAuthProvider.credential(
      response.data.idToken
    );

    if (auth().currentUser) {
      // await auth().signOut()
      const user: FirebaseAuthTypes.User = auth()
        .currentUser as FirebaseAuthTypes.User;
      return linkWithCredential(user, googleCredential).catch((error) =>
        auth().signInWithCredential(googleCredential)
      );
    }
    // Sign-in the user with the credential
    return auth().signInWithCredential(googleCredential);
  }
}

export default function GoogleLogin({ callbackFn }: any) {
  return (
    <View>
      <GoogleSocialButton
        onPress={() =>
          onGoogleButtonPress()
            .then(async (userCredentials) => {
              if (userCredentials) {
                const userSettings = await createUserSettings(
                  userCredentials.user.uid
                );
                console.log(JSON.stringify(userSettings));
                console.log(JSON.stringify(userCredentials));
                callbackFn();
              } else {
                console.error("Error: User credentials are null");
                callbackFn();
              }
            })
            .catch((error) => {
              console.log("Error " + error);
              callbackFn();
            })
        }
      />
    </View>
  );
}
