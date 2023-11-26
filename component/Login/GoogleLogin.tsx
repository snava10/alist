import React from "react";
import { View } from "react-native";
import {
  GoogleSigninButton,
  GoogleSignin,
} from "@react-native-google-signin/google-signin";
import auth from "@react-native-firebase/auth";

GoogleSignin.configure({
  webClientId:
    "183439267259-kttd199p50pegq0maqdv4kv6v0nau62d.apps.googleusercontent.com",
});

async function onGoogleButtonPress() {
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
