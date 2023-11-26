import { View, StyleSheet, Text, Pressable } from "react-native";
import FacebookLogin from "./FacebookLogin";
import GoogleLogin from "./GoogleLogin";
import globalStyles from "../GlobalStyles";

export type LoginScreenProperties = {
  loginWithFacebook: boolean;
  loginWithGoogle: boolean;
  continueAnonymous: boolean;
  emailAndPassword: boolean;
};

export default function LoginScreen({ route }: any) {
  const loginScreenProperties = route.params
    .loginScreenProperties as LoginScreenProperties;
  const anonymousCallbackFun = route.params.anonymousCallbackFun;
  return (
    <View style={styles.container}>
      <View
        style={{
          flex: 1,
          width: 100,
          height: 100,
          justifyContent: "center",
          alignItems: "center",
          alignSelf: "center",
          alignContent: "center",
        }}
      >
        {loginScreenProperties.loginWithFacebook ? (
          <FacebookLogin></FacebookLogin>
        ) : (
          <></>
        )}
        {loginScreenProperties.loginWithGoogle ? (
          <GoogleLogin></GoogleLogin>
        ) : (
          <></>
        )}
        {loginScreenProperties.continueAnonymous ? (
          <View>
            <Pressable
              style={[globalStyles.button, globalStyles.button.primary.main]}
              onPress={() => {
                console.log("Press");
                anonymousCallbackFun();
              }}
            >
              <Text style={globalStyles.button.text.defaut}>
                Continue anonymously
              </Text>
            </Pressable>
          </View>
        ) : (
          <></>
        )}
      </View>
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
