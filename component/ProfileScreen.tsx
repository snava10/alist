import React, { useEffect, useState } from "react";
import auth from "@react-native-firebase/auth";
import AuthenticationComponent from "./Login/AuthenticationComponent";
import { View, Text, Pressable } from "react-native";
import globalStyles from "./Core/GlobalStyles";
import { BackupCadence } from "./Core/DataModel";
import DropDownPicker from "react-native-dropdown-picker";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ConfirmationModal from "./ConfirmationModal";
import { FirebaseAuthTypes } from "@react-native-firebase/auth";
import { deleteItems, restoreFromBackup } from "./Core/Storage";
import analytics from "@react-native-firebase/analytics";
import { useNavigation } from "@react-navigation/native";

export default function ProfileScreen({ route }: any) {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState(route.params.user);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [backupCadence, setBackupCadence] = useState(BackupCadence.DAILY);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [modalMessage, setModalMessage] = useState(
    "Deleting you account will remove your credentials and all backups. The data will still be available in your phone. Do you wish to proceed?"
  );
  const [showRestoreFromBackupModal, setShowRestoreFromBackupModal] =
    useState(false);

  const navigation = useNavigation();

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
    var displayName = user?.displayName;
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
      </View>
    );
  };

  return (
    <View
      style={[
        {
          paddingHorizontal: 10,
          alignItems: "center",
          flex: 1,
          backgroundColor: "#fff",
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
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
                <Pressable
                  style={[
                    globalStyles.button,
                    globalStyles.button.primary.main,
                  ]}
                  onPress={() => {
                    setShowRestoreFromBackupModal(true);
                  }}
                >
                  <Text style={globalStyles.button.text.default}>
                    Backup Restore
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </>
      ) : (
        <></>
      )}
      <View
        style={
          isLoggedIn
            ? {
                flex: 0.2,
                flexDirection: "row",
              }
            : {
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }
        }
      >
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
          deleteAccountFn={() => {
            console.log("deleting account");
            setShowDeleteModal(true);
            console.log(showDeleteModal);
          }}
        ></AuthenticationComponent>
      </View>
      {isLoggedIn && showDeleteModal ? (
        <ConfirmationModal
          message={modalMessage}
          visible={showDeleteModal}
          acceptCallbackFn={() => {
            auth()
              .currentUser?.getIdToken(true)
              .then((token) => {
                const currentUser = auth()
                  .currentUser as FirebaseAuthTypes.User;
                deleteItems(currentUser.uid).then((deletedCount) => {
                  console.log(`Deleted ${deletedCount} documents`);
                  currentUser
                    .delete()
                    .then((response) => {
                      console.log("Response", response);
                      setShowDeleteModal(false);
                      setUser(null);
                      setIsLoggedIn(false);
                      analytics()
                        .logEvent("user_delete", {
                          uid: currentUser.uid,
                          provider: currentUser.providerId,
                          displayName: currentUser.displayName ?? "",
                        })
                        .then((_) => console.log("delete user logged"))
                        .catch((_) => console.log("delete user log failed"));
                    })
                    .catch((reason: Error) => {
                      if (
                        reason.message.includes("auth/requires-recent-login")
                      ) {
                        analytics()
                          .logEvent("user_delete_error", {
                            uid: currentUser.uid,
                            provider: currentUser.providerId,
                            displayName: currentUser.displayName ?? "",
                          })
                          .then((_) => console.log("delete user error logged"))
                          .catch((_) =>
                            console.log("delete user error log failed")
                          );
                        setModalMessage(
                          `${reason.message} \n. Please logout, login and try deleting your account again.`
                        );
                      }
                      console.log("Error", reason);
                    });
                });
              });
          }}
          rejectCallbackFn={() => {
            setShowDeleteModal(false);
          }}
          hideModalFn={() => {
            setShowDeleteModal(false);
          }}
          item={null}
        ></ConfirmationModal>
      ) : (
        <></>
      )}
      {isLoggedIn && showRestoreFromBackupModal ? (
        <ConfirmationModal
          message="This will replace all your data with your latest backup. Would you like to proceed"
          item={null}
          acceptCallbackFn={async () => {
            console.log("Restoring from backup");
            await restoreFromBackup(user.uid);
            setShowRestoreFromBackupModal(false);
            analytics()
              .logEvent("backup_restore", {
                uid: user.uid,
                provider: user.providerId,
                displayName: user.displayName ?? "",
              })
              .catch((_) => console.log("backup log failed"));
            navigation.goBack();
          }}
          rejectCallbackFn={() => {
            setShowRestoreFromBackupModal(false);
          }}
          hideModalFn={() => {
            setShowRestoreFromBackupModal(false);
          }}
          visible={showRestoreFromBackupModal}
        ></ConfirmationModal>
      ) : (
        <></>
      )}
    </View>
  );
}
