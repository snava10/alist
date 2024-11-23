import React, { useEffect, useState } from "react";
import auth from "@react-native-firebase/auth";
import AuthenticationComponent from "./Login/AuthenticationComponent";
import { View, Text } from "react-native";
import globalStyles from "./Core/GlobalStyles";
import { BackupCadence } from "./Core/DataModel";
import DropDownPicker from "react-native-dropdown-picker";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ProfileScreen({ route }: any) {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState(route.params.user);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [backupCadence, setBackupCadence] = useState(BackupCadence.DAILY);

  const items = Object.values(BackupCadence).map((i) => {
    if (i === BackupCadence.INSTANT) {
      return {
        label: i,
        value: i,
        disabled: true,
        icon: () => <Ionicons name="ribbon" />,
      };
    }
    return { label: i, value: i };
  });

  const insets = useSafeAreaInsets();

  useEffect(() => {
    setIsLoggedIn(user && !user.isAnonymous);
  });

  const displayNameComponent = () => {
    var displayName = user?.displayName
    if (!displayName && user?.providerData) {
      for (const userInfo of user?.providerData) {
        displayName = userInfo.displayName;
        if (displayName) {
          console.log(userInfo.providerId);
          break;
        }
      }
    }

    return (
      <View
        style={
          (globalStyles.profileBannerContainer,
            [{ flex: 0.2, justifyContent: "center", alignItems: "center" }])
        }
      >
        <Text style={{ fontWeight: "bold", fontSize: 20 }}>
          {displayName ?? ""}
        </Text>
      </View>);

  }

  return (
    <View
      style={[
        {
          paddingHorizontal: 10, alignItems: "center",
          flex: 1,
          backgroundColor: "#fff",
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right
        },
      ]}
    >
      {isLoggedIn ? (
        <>
          {displayNameComponent()}
          <View
            style={{
              flex: 0.8,
              flexDirection: "row",
              justifyContent: "center",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                backgroundColor: "#f0f0f0",
                width: 350,
                borderRadius: 8,
                padding: 10,
                height: 70,
                alignContent: "space-between",
              }}
            >
              <View style={{ flex: 0.5, justifyContent: "center" }}>
                <Text style={globalStyles.profileTextLabel}>Backup</Text>
              </View>
              <View style={{ flex: 0.5, justifyContent: "center" }}>
                <DropDownPicker
                  open={open}
                  setOpen={setOpen}
                  value={backupCadence}
                  items={items}
                  setValue={setBackupCadence}
                  disabledItemContainerStyle={{
                    backgroundColor: "#f0f0f0",
                  }}
                />
              </View>
            </View>
          </View>

          <View style={{ flex: 0.2 }}>
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
                apple: true,
                allowAnonymous: false,
              }}
            ></AuthenticationComponent>
          </View>
        </>
      ) : (
        <View style={{ flex: 1 }}>
          <AuthenticationComponent
            isLoggedIn={isLoggedIn}
            successCallbackFn={() => {
              console.log("Login success callback", auth().currentUser)
              setUser(auth().currentUser)
            }}
            logOutFn={() => {
              auth().signOut().then(() => {
                console.log("Signout success");
                setIsLoggedIn(false);
              }).catch(reason => console.error(reason));
            }}
            authProviders={{
              google: true,
              apple: true,
              allowAnonymous: false,
            }}
          ></AuthenticationComponent>
        </View>
      )}
    </View>
  );
}


