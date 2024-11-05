import React from "react";
import { View } from "react-native";
import {
  GoogleSigninButton,
  GoogleSignin,
  SignInSuccessResponse,
} from "@react-native-google-signin/google-signin";
import auth from "@react-native-firebase/auth";
import { createUserSettings } from "../Core/Storage";

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
    response = response as SignInSuccessResponse
    const googleCredential = auth.GoogleAuthProvider.credential(response.data.idToken);

    // Sign-in the user with the credential
    return auth().signInWithCredential(googleCredential);
  }
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
              if (userCredentials) {
                const userSettings = await createUserSettings(
                  userCredentials.user.uid
                );
                console.log(JSON.stringify(userSettings));
                callbackFn();
              } else {
                console.error("Error: User credentials are null")
              }
            })
            .catch((error) => console.error("Error " + error))
        }
        // disabled={isInProgress}
      />
    </View>
  );
}
     