import { View, StyleSheet, Text, Pressable } from "react-native";
import FacebookLogin from "./FacebookLogin";
import GoogleLogin from "./GoogleLogin";
import globalStyles from "../GlobalStyles";
import AuthenticationComponent from "./AuthenticationComponent";

export type LoginScreenProperties = {
  loginWithFacebook: boolean;
  loginWithGoogle: boolean;
  continueAnonymous: boolean;
  emailAndPassword: boolean;
};

export default function LoginScreen({ route }: any) {
  return (
    <View>
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
