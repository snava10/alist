import { View, StyleSheet, Text, Pressable, ViewStyle } from "react-native";
import React, { useEffect, useState } from "react";
import FacebookLogin from "./FacebookLogin";
import GoogleLogin from "./GoogleLogin";
import globalStyles from "../Core/GlobalStyles";
import AppleLogin from "./AppleLogin";
import analytics from "@react-native-firebase/analytics";

export type AuthenticationComponentProps = {
  isLoggedIn: boolean;
  successCallbackFn: Function;
  logOutFn: any;
  continueAnonymousCallbackFn?: Function;
  deleteAccountFn: any;
  authProviders: {
    google?: boolean;
    facebook?: boolean;
    apple?: boolean;
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
  deleteAccountFn,
}: AuthenticationComponentProps) {
  const [_isLoggedIn, setIsLoggedIn] = useState(isLoggedIn);
  useEffect(() => {
    setIsLoggedIn(isLoggedIn);
  });

  return _isLoggedIn ? (
    <View style={{ flex: 1 }}>
      <View style={styles.child_view}>
        <Pressable
          style={[globalStyles.button, globalStyles.button.primary.main]}
          onPress={logOutFn}
        >
          <Text style={globalStyles.button.text.default}>Log Out</Text>
        </Pressable>
      </View>
      <View style={styles.child_view}>
        <Pressable
          style={[globalStyles.button, globalStyles.button.primary.outlined]}
          onPress={deleteAccountFn}
        >
          <Text style={globalStyles.button.text.dangerSmall}>
            Delete Account
          </Text>
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
        {authProviders.apple ? (
          <AppleLogin callbackFn={successCallbackFn}></AppleLogin>
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
              style={({ pressed }) => [
                globalStyles.button,
                { height: 40, width: 220 },
                pressed
                  ? globalStyles.button.primary.dark
                  : globalStyles.button.primary.main,
              ]}
              onPress={() => {
                setIsLoggedIn(true);
                if (continueAnonymousCallbackFn) {
                  continueAnonymousCallbackFn();
                }
              }}
            >
              <Text style={globalStyles.button.text.default}>
                Continue anonymous
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
