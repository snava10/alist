import { View, StyleSheet } from "react-native";
import FacebookLogin from "./FacebookLogin";


export default function LoginScreen() {
  return (
    <View style={styles.container}>
      <View style={{ flex: 1 }}>
        <FacebookLogin></FacebookLogin>
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
