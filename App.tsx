import React from "react";
import Main from "./component/Main";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Settings from "./component/Profile";
import { Button } from "react-native";

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen
          name="Home"
          component={Main}
          options={({ navigation }) => ({
            title: "Home",
            headerStyle: {
              backgroundColor: "#273469",
            },
            headerTintColor: "#EBF2FA",
            headerRight: () => (
              <Button
                onPress={() => navigation.navigate("Profile")}
                title="Profile"
              />
            ),
          })}
        />
        <Stack.Screen
          name="Profile"
          component={Settings}
          options={{
            title: "Profile",
            headerStyle: {
              backgroundColor: "#273469",
            },
            headerTintColor: "#EBF2FA",
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
