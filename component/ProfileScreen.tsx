import React, { useEffect, useState } from "react";
import auth from "@react-native-firebase/auth";
import AuthenticationComponent from "./Login/AuthenticationComponent";
import { View, Text, Switch } from "react-native";
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
            <DropDownPicker
              open={open}
              setOpen={setOpen}
              value={backupCadence}
              items={items}
              setValue={setBackupCadence}
              setItems={() =>
                Object.values(BackupCadence).map((i) => {
                  return { label: i, value: i };
                })
              }
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
