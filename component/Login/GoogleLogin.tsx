import React from "react";
import { View } from "react-native";
import {
  GoogleSigninButton,
  GoogleSignin,
} from "@react-native-google-signin/google-signin";
import auth from "@react-native-firebase/auth";
import { createUserSettings, getUserSettings } from "../Core/Storage";

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
  const { idToken } = await GoogleSignin.signIn();

  // Create a Google credential with the token
  const googleCredential = auth.GoogleAuthProvider.credential(idToken);

  // Sign-in the user with the credential
  return auth().signInWithCredential(googleCredential);
}

export default function GoogleLogin({ callbackFn }: any) {
  return (
    <View>
      <GoogleSigninButton
        size={GoogleSigninButton.Size.Wide}
        color={GoogleSigninButton.Color.Dark}
        onPress={() =>
          onGoogleButtonPress()
            .then(async (userCredentials) => {
              const userSettings = await createUserSettings(
                userCredentials.user.uid
              );
              console.log(JSON.stringify(userSettings));
              callbackFn();
            })
            .catch((error) => console.log("Error " + error))
        }
        // disabled={isInProgress}
      />
    </View>
  );
}
