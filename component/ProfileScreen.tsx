import React, { useEffect, useState } from "react";
import auth from "@react-native-firebase/auth";
import AuthenticationComponent from "./Login/AuthenticationComponent";
import { View, Text } from "react-native";
import globalStyles from "./Core/GlobalStyles";
import { BackupCadence } from "./Core/DataModel";
import { StyleSheet } from "react-native";
import DropDownPicker from "react-native-dropdown-picker";

export default function ProfileScreen({ route }: any) {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState(route.params.user);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [backupCadence, setBackupCadence] = useState(BackupCadence.DAILY);

  const items = Object.values(BackupCadence).map((i) => {
    if (i === BackupCadence.INSTANT) {
      return { label: i, value: i, disabled: true };
    }
    return { label: i, value: i };
  });

  useEffect(() => {
    setIsLoggedIn(user && user.displayName);
  });

  return (
    <View
      style={[
        globalStyles.container,
        { paddingHorizontal: 10, alignItems: "center" },
      ]}
    >
      {isLoggedIn && user ? (
        <>
          <View
            style={
              (globalStyles.profileBannerContainer,
              [{ flex: 0.2, justifyContent: "center", alignItems: "center" }])
            }
          >
            <Text style={{ fontWeight: "bold", fontSize: 20 }}>
              {user.displayName}
            </Text>
          </View>
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
                />
              </View>
            </View>
          </View>

          {/* <View style={{ flex: 0.2 }}>
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
          </View> */}
        </>
      ) : (
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "white",
    padding: 16,
  },
  dropdown: {
    height: 50,
    borderColor: "gray",
    borderWidth: 0.5,
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  icon: {
    marginRight: 5,
  },
  label: {
    position: "absolute",
    backgroundColor: "white",
    left: 22,
    top: 8,
    zIndex: 999,
    paddingHorizontal: 8,
    fontSize: 14,
  },
  placeholderStyle: {
    fontSize: 16,
  },
  selectedTextStyle: {
    fontSize: 16,
  },
  iconStyle: {
    width: 20,
    height: 20,
  },
  inputSearchStyle: {
    height: 40,
    fontSize: 16,
  },
});
