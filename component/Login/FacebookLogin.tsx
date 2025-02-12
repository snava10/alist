import React from "react";
import { View } from "react-native";
import { LoginButton, AccessToken } from "react-native-fbsdk-next";
import auth from "@react-native-firebase/auth";

export default function FacebookLogin() {
  return (
    <View>
      <LoginButton
        permissions={["public_profile", "email"]}
        onLoginFinished={async (error, _) => {
          if (error) {
            console.error(error);
          } else {
            const data = await AccessToken.getCurrentAccessToken();
            console.debug("Login Success");
            if (data) {
              const facebookCredential = auth.FacebookAuthProvider.credential(
                data.accessToken
              );
              await auth().signInWithCredential(facebookCredential);
            }
          }
        }}
        onLogoutFinished={async () => {
          try {
            auth().signOut();
            console.debug("Logged out from Facebook");
          } catch (error) {
            console.error("Error logging out from Facebook:", error);
          }
        }}
      />
    </View>
  );
}
