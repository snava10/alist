import { View, StyleSheet } from "react-native";
import AuthenticationComponent from "./AuthenticationComponent";
import auth from "@react-native-firebase/auth";

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
          console.log("Successfully logged in");
        }}
        logOutFn={() => {
          console.log("Successfully logged out");
        }}
        authProviders={{
          google: true,
          apple: true,
          allowAnonymous: true,
        }}
        continueAnonymousCallbackFn={() => auth().signInAnonymously()}
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
