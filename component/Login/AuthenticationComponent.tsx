import { View, StyleSheet, Text, Button, Pressable } from "react-native";
import React, { useEffect, useState } from "react";
import { GraphRequest, GraphRequestManager } from "react-native-fbsdk-next";
import auth from "@react-native-firebase/auth";
import FacebookLogin from "./FacebookLogin";
import GoogleLogin from "./GoogleLogin";

export type AuthenticationComponentProps = {
  isLoggedIn: boolean;
  successCallbackFn: Function;
  logOutFn: any;
  authProviders: {
    google?: boolean;
    facebook?: boolean;
    twitter?: boolean;
    microsoft?: boolean;
    emailAndPassword?: boolean;
    allowAnonymous?: boolean;
  };
};

export default function AuthenticationComponent({
  isLoggedIn,
  successCallbackFn,
  logOutFn,
  authProviders,
}: AuthenticationComponentProps) {
  const [_isLoggedIn, setIsLoggedIn] = useState(isLoggedIn);
  useEffect(() => {
    setIsLoggedIn(isLoggedIn);
  });

  return _isLoggedIn ? (
    <View style={styles.container}>
      <View style={styles.child_view}>
        <Button title="Log Out" onPress={logOutFn} />
      </View>
    </View>
  ) : (
    <View style={styles.child_view}>
      {authProviders.facebook ? <FacebookLogin></FacebookLogin> : <></>}
      {authProviders.google ? (
        <GoogleLogin callbackFn={successCallbackFn}></GoogleLogin>
      ) : (
        <></>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 10,
  },
  child_view: {
    flex: 1,
    width: 100,
    height: 100,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    alignContent: "center",
  },
});
