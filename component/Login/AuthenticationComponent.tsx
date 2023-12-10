import { View, StyleSheet, Text, Pressable } from "react-native";
import React, { useEffect, useState } from "react";
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
    setIsLoggedIn(isLoggedIn);
  });

  return _isLoggedIn ? (
    <View style={{ flex: 1 }}>
      <View style={styles.child_view}>
        <Pressable
          style={[globalStyles.button, globalStyles.button.primary.light]}
          onPress={logOutFn}
        >
          <Text style={globalStyles.button.text.default}>Log Out</Text>
        </Pressable>
      </View>
    </View>
  ) : (
    <View style={{ flex: 1 }}>
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
                paddingHorizontal: 50,
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
              <Text style={globalStyles.button.text.default}>
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
    justifyContent: "center",
    alignSelf: "center",
  },
});
