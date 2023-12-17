import React, { useEffect, useState } from "react";
import auth from "@react-native-firebase/auth";
import AuthenticationComponent from "./Login/AuthenticationComponent";
import { View, Text, Switch } from "react-native";
import globalStyles from "./Core/GlobalStyles";
import { isEnabled } from "react-native/Libraries/Performance/Systrace";

export default function ProfileScreen({ route }: any) {
  const [user, setUser] = useState(route.params.user);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    setIsLoggedIn(user && user.displayName);
  });

  function toggleSwitch() {
    setIsEnabled(!isEnabled);
  }

  return (
    <View style={{ flex: 1 }}>
      {isLoggedIn && user ? (
        <>
          <View style={[globalStyles.container, { flex: 3 }]}>
            <View style={{ justifyContent: "flex-start", marginTop: 10 }}>
              <Text style={{ fontWeight: "bold", fontSize: 20 }}>
                {user.displayName}
              </Text>
            </View>
          </View>
          <View>
            <Switch
              trackColor={{ false: "#767577", true: "#81b0ff" }}
              thumbColor={isEnabled ? "#f5dd4b" : "#f4f3f4"}
              ios_backgroundColor="#3e3e3e"
              onValueChange={toggleSwitch}
              value={isEnabled}
            />
          </View>
        </>
      ) : (
        <></>
      )}
      <View style={{ flex: 1 }}>
        <AuthenticationComponent
          isLoggedIn={isLoggedIn}
          successCallbackFn={() => {
            setUser(auth().currentUser);
          }}
          logOutFn={() => {
            setIsLoggedIn(false);
            auth().signOut();
            setUser(null);
          }}
          authProviders={{
            google: true,
            allowAnonymous: false,
          }}
        ></AuthenticationComponent>
      </View>
    </View>
  );
}
