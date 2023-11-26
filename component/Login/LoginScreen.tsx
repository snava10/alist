import { View, StyleSheet } from "react-native";
import FacebookLogin from "./FacebookLogin";
import GoogleLogin from "./GoogleLogin";

export default function LoginScreen() {
  return (
    <View style={styles.container}>
      <View style={{ flex: 1 }}>
        <FacebookLogin></FacebookLogin>
        <GoogleLogin></GoogleLogin>
      </View>
      <View style={{ flex: 5 }}></View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 10,
  },
});
