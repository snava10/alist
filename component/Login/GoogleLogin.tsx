import React from "react";
import { View } from "react-native";
import {
  GoogleSigninButton,
  GoogleSignin,
} from "@react-native-google-signin/google-signin";
import auth from "@react-native-firebase/auth";

GoogleSignin.configure({
  webClientId:
    // "183439267259-3fdekennuneoalsccieeaj44v781r3b4.apps.googleusercontent.com",
    "183439267259-12mtdreenqc4shhl3ab9ddnbhb00auu0.apps.googleusercontent.com",
  // "183439267259-4h0561svmr0ab771gq0nlgpj4640g459.apps.googleusercontent.com",
  // "183439267259-lte4rjvdj437i3r8904ck1vsflf7k7dv.apps.googleusercontent.com",
});

async function onGoogleButtonPress() {
  try {
    // Check if your device supports Google Play
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    // Get the users ID token
    const { idToken } = await GoogleSignin.signIn();
    console.log(idToken);

    // Create a Google credential with the token
    const googleCredential = auth.GoogleAuthProvider.credential(idToken);
    console.log(googleCredential);

    // Sign-in the user with the credential
    return auth().signInWithCredential(googleCredential);
  } catch (e: any) {
    console.log("Error signing in with google" + e);
    console.log(e.code);
    console.log(e.message);
    throw e;
  }
}

export default function GoogleLogin() {
  return (
    <View>
      <GoogleSigninButton
        size={GoogleSigninButton.Size.Wide}
        color={GoogleSigninButton.Color.Dark}
        onPress={() =>
          onGoogleButtonPress()
            .then(() => console.log("Signed in with Google!"))
            .catch((error) => console.log(error))
        }
        // disabled={isInProgress}
      />
    </View>
  );
}
