import { View, StyleSheet, Text, Button } from "react-native";
import React, { useEffect, useState } from "react";
import { GraphRequest, GraphRequestManager } from "react-native-fbsdk-next";
import auth from "@react-native-firebase/auth";

export default function ProfileScreen({ route }: any) {
  const [user] = useState(route.params.user.route.params);

  useEffect(() => {
    console.log("Profile Screen ", route.params.user.route.params);
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

  return user ? (
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
          }}
        />
      </View>
    </View>
  ) : (
    <View style={styles.container}></View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 10,
  },
});
