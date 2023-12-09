import { View, StyleSheet, Text, Button, Pressable } from "react-native";
import React, { useEffect, useState } from "react";
import { GraphRequest, GraphRequestManager } from "react-native-fbsdk-next";
import auth from "@react-native-firebase/auth";
import FacebookLogin from "./FacebookLogin";
import GoogleLogin from "./GoogleLogin";
import globalStyles from "../GlobalStyles";

export type AuthenticationComponentProps = {
  isLoggedIn: boolean;
  successCallbackFn: Function;
  logOutFn: any;
  continueAnonymousCallbackFn?: Function;
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
  continueAnonymousCallbackFn,
}: AuthenticationComponentProps) {
  const [_isLoggedIn, setIsLoggedIn] = useState(isLoggedIn);
  useEffect(() => {
    console.log(continueAnonymousCallbackFn);
    setIsLoggedIn(isLoggedIn);
  });

  return _isLoggedIn ? (
    <View>
      <View style={styles.child_view}>
        <Button title="Log Out" onPress={logOutFn} />
      </View>
    </View>
  ) : (
    <View>
      <View style={styles.child_view}>
        {authProviders.facebook ? <FacebookLogin></FacebookLogin> : <></>}
        {authProviders.google ? (
          <GoogleLogin callbackFn={successCallbackFn}></GoogleLogin>
        ) : (
          <></>
        )}
        {authProviders.allowAnonymous ? (
          <>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 10,
              }}
            >
              <View
                style={{ flex: 1, height: 1, backgroundColor: "#b0afac" }}
              />
              <View>
                <Text
                  style={{
                    width: 50,
                    textAlign: "center",
                    color: "#b0afac",
                    fontWeight: "bold",
                    fontSize: 20,
                  }}
                >
                  or
                </Text>
              </View>
              <View
                style={{ flex: 1, height: 1, backgroundColor: "#b0afac" }}
              />
            </View>
            <Pressable
              style={[globalStyles.button, globalStyles.button.primary.main]}
              onPress={() => {
                setIsLoggedIn(true);
                if (continueAnonymousCallbackFn) {
                  continueAnonymousCallbackFn();
                }
              }}
            >
              <Text style={globalStyles.button.text.defaut}>
                Continue offline
              </Text>
            </Pressable>
          </>
        ) : (
          <></>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  child_view: {
    flex: 1,
    height: 100,
    justifyContent: "center",
    alignSelf: "center",
  },
});
