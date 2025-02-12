import { View, StyleSheet } from "react-native";
import AuthenticationComponent from "./AuthenticationComponent";
import auth from "@react-native-firebase/auth";
import React from "react";

export type LoginScreenProperties = {
  loginWithFacebook: boolean;
  loginWithGoogle: boolean;
  continueAnonymous: boolean;
  emailAndPassword: boolean;
};

export default function LoginScreen() {
  return (
    <View style={styles.container}>
      <AuthenticationComponent
        isLoggedIn={false}
        successCallbackFn={() => {
          console.debug("Successfully logged in");
        }}
        logOutFn={() => {
          console.debug("Successfully logged out");
        }}
        authProviders={{
          google: true,
          apple: true,
          allowAnonymous: true,
        }}
        continueAnonymousCallbackFn={() => auth().signInAnonymously()}
        deleteAccountFn={() => {}}
      ></AuthenticationComponent>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 10,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
});
