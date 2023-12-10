import React, { useEffect, useState } from "react";
import auth from "@react-native-firebase/auth";
import AuthenticationComponent from "./Login/AuthenticationComponent";

export default function ProfileScreen({ route }: any) {
  const [user, setUser] = useState(route.params.route.params.user);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setIsLoggedIn(user && user.displayName);
  });

  return (
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
  );
}
