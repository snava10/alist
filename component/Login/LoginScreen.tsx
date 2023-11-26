import { View, StyleSheet } from "react-native";
import FacebookLogin from "./FacebookLogin";
import GoogleLogin from "./GoogleLogin";

export default function LoginScreen() {
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
        <FacebookLogin></FacebookLogin>
        <GoogleLogin></GoogleLogin>
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
