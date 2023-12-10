import { View, StyleSheet } from "react-native";
import AuthenticationComponent from "./AuthenticationComponent";

export type LoginScreenProperties = {
  loginWithFacebook: boolean;
  loginWithGoogle: boolean;
  continueAnonymous: boolean;
  emailAndPassword: boolean;
};

export default function LoginScreen({ route }: any) {
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
          allowAnonymous: true,
        }}
        continueAnonymousCallbackFn={route.params.anonymousCallbackFn}
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
