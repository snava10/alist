import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import HomeScreen from "./component/HomeScreen";
import ProfileScreen from "./component/ProfileScreen";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Ionicons from "@expo/vector-icons/Ionicons";
import LoginScreen, {
  LoginScreenProperties,
} from "./component/Login/LoginScreen";
import auth from "@react-native-firebase/auth";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

export default function App() {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [continueAnonymous, setContinueAnonymous] = useState(false);

  const loginScreenProperties = {
    loginWithFacebook: false,
    loginWithGoogle: true,
    continueAnonymous: true,
    emailAndPassword: true,
  } as LoginScreenProperties;

  function onAuthStateChanged(u: any) {
    if (u) {
      const { _auth, ...rest } = u;
      console.log(rest);
      setUser(rest._user);
      if (initializing) setInitializing(false);
    } else {
      setUser(null);
    }
  }

  function continueAnonymousFunction(): void {
    setContinueAnonymous(true);
  }

  useEffect(() => {
    const subscriber = auth().onAuthStateChanged(onAuthStateChanged);
    return subscriber; // unsubscribe on unmount
  }, []);

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={({ route }) => ({ headerShown: false })}>
        {user || continueAnonymous ? (
          <>
            <Stack.Screen
              name="Home Tab"
              component={HomeTabScreen}
              initialParams={{ user: user, continueAnonymous }}
            />
          </>
        ) : (
          <>
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              initialParams={{
                loginScreenProperties,
                anonymousCallbackFun: continueAnonymousFunction,
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function HomeTabScreen(props: any) {
  return (
    <Tab.Navigator screenOptions={({ route }) => ({ headerShown: false })}>
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={ProfileScreen}
        initialParams={props}
        options={{
          tabBarLabel: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
