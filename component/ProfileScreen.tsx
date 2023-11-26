import { View, StyleSheet, Text, Button, Pressable } from "react-native";
import React, { useEffect, useState } from "react";
import { GraphRequest, GraphRequestManager } from "react-native-fbsdk-next";
import auth from "@react-native-firebase/auth";
import LoginScreen from "./Login/LoginScreen";
import globalStyles from "./GlobalStyles";
import FacebookLogin from "./Login/FacebookLogin";
import GoogleLogin from "./Login/GoogleLogin";

export default function ProfileScreen({ route }: any) {
  const [user, setUser] = useState(route.params.route.params.user);
  const [anonymous, setAnonymous] = useState(
    route.params.route.params.continueAnonymous
  );

  useEffect(() => {
    console.log("Profile Screen ", route.params.route.params);
    // console.log(route.params.user.route.params);
    // console.log("User " + JSON.stringify(user));
  });

  const getUserInfo = (token: string) => {
    const infoRequest = new GraphRequest(
      "/me",
      {
        accessToken: token,
        parameters: { fields: { string: "id,name,email" } },
      },
      (error, result) => {
        if (error) {
          console.error("Error fetching user info:", error);
        } else {
          console.log(result?.email);
          console.log("User Info:", result);
        }
      }
    );
    new GraphRequestManager().addRequest(infoRequest).start();
  };

  return user && user.displayName ? (
    <View style={styles.container}>
      <View style={{ flex: 1 }}>
        <View>
          <Text>Welcome to AList {user.displayName}</Text>
        </View>
      </View>
      <View style={{ flex: 1 }}>
        <Button
          title="Log Out"
          onPress={() => {
            auth().signOut();
            setUser(null);
          }}
        />
      </View>
    </View>
  ) : (
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
      <GoogleLogin callbackFn={() => setUser(auth().currentUser)}></GoogleLogin>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 10,
  },
});
