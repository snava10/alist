import React, { useEffect, useState } from "react";
import auth from "@react-native-firebase/auth";
import AuthenticationComponent from "./Login/AuthenticationComponent";
import { View, Text } from "react-native";
import globalStyles from "./GlobalStyles";

export default function ProfileScreen({ route }: any) {
  const [user, setUser] = useState(route.params.route.params.user);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setIsLoggedIn(user && user.displayName);
  });

  return (
    <View style={{ flex: 1 }}>
      <View style={[globalStyles.container, { flex: 3 }]}>
        <Text style={{ fontSize: 20 }}>Welcome</Text>
        <Text style={{ fontWeight: "bold", fontSize: 20 }}>
          {user.displayName}
        </Text>
      </View>
      <View style={{ flex: 0.5 }}>
        <AuthenticationComponent
          isLoggedIn={isLoggedIn}
          successCallbackFn={() => {
            setUser(auth().currentUser);
          }}
          logOutFn={() => {
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
