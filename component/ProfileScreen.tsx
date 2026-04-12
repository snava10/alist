import React, { useEffect, useState } from 'react';
import auth from '@react-native-firebase/auth';
import AuthenticationComponent from './Login/AuthenticationComponent';
import { View, Text, Pressable, Modal, TextInput } from 'react-native';
import globalStyles from './Core/GlobalStyles';
import { BackupCadence, HomeTabParamList } from './Core/DataModel';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ConfirmationModal from './ConfirmationModal';
import { FirebaseAuthTypes } from '@react-native-firebase/auth';
import {
  deleteItems,
  restoreFromBackup,
  pushAllItems,
  saveWrappedKey,
  restoreKeyFromCloud,
} from './Core/Storage';
import { wrapAESKey } from './Core/Security';
import analytics from '@react-native-firebase/analytics';
import { NavigationProp, useNavigation } from '@react-navigation/native';

type NavigationType = NavigationProp<HomeTabParamList>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function ProfileScreen({ route }: any) {
  const [user, setUser] = useState(route.params.user);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [modalMessage, setModalMessage] = useState(
    'Deleting your account will remove your credentials and all backups. The data will still be available in your phone. Do you wish to proceed?'
  );
  const [showRestoreFromBackupModal, setShowRestoreFromBackupModal] = useState(false);
  const [showBackupNowModal, setShowBackupNowModal] = useState(false);
  const [showPassphraseModal, setShowPassphraseModal] = useState(false);
  const [showRestoreKeyModal, setShowRestoreKeyModal] = useState(false);
  const [passphraseInput, setPassphraseInput] = useState('');
  const [passphraseError, setPassphraseError] = useState('');

  const navigation = useNavigation<NavigationType>();

  Object.values(BackupCadence).map((i) => {
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
          [{ flex: 0.2, justifyContent: 'center', alignItems: 'center' }])
        }
      >
        <Text style={{ fontWeight: 'bold', fontSize: 20 }}>{displayName ?? ''}</Text>
      </View>
    );
  };

  const passphraseModal = (title: string, onConfirm: (passphrase: string) => Promise<void>) => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={true}
      onRequestClose={() => {
        setShowPassphraseModal(false);
        setShowRestoreKeyModal(false);
        setPassphraseInput('');
        setPassphraseError('');
      }}
    >
      <View style={globalStyles.modalViewCentered}>
        <View style={globalStyles.modalView}>
          <Text style={{ fontSize: 18, marginBottom: 10 }}>{title}</Text>
          <TextInput
            style={{
              borderWidth: 1,
              borderColor: '#ccc',
              borderRadius: 4,
              padding: 8,
              width: 260,
              marginBottom: 8,
            }}
            placeholder="Enter passphrase"
            secureTextEntry={true}
            value={passphraseInput}
            onChangeText={(t) => {
              setPassphraseInput(t);
              setPassphraseError('');
            }}
            testID="passphrase-input"
          />
          {passphraseError ? (
            <Text style={{ color: 'red', marginBottom: 8 }}>{passphraseError}</Text>
          ) : null}
          <View style={{ flexDirection: 'row', marginTop: 10 }}>
            <Pressable
              style={[globalStyles.button, globalStyles.button.primary.main]}
              onPress={async () => {
                if (!passphraseInput) {
                  setPassphraseError('Passphrase cannot be empty.');
                  return;
                }
                try {
                  await onConfirm(passphraseInput);
                  setPassphraseInput('');
                  setPassphraseError('');
                } catch {
                  setPassphraseError('Operation failed. Check your passphrase and try again.');
                }
              }}
            >
              <Text style={globalStyles.button.text.default}>Confirm</Text>
            </Pressable>
            <Pressable
              style={[globalStyles.button, globalStyles.button.error.main]}
              onPress={() => {
                setShowPassphraseModal(false);
                setShowRestoreKeyModal(false);
                setPassphraseInput('');
                setPassphraseError('');
              }}
            >
              <Text style={globalStyles.button.text.default}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <View
      style={[
        {
          paddingHorizontal: 10,
          alignItems: 'center',
          flex: 1,
          backgroundColor: '#fff',
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
              flexDirection: 'row',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                flexDirection: 'column',
                backgroundColor: '#f0f0f0',
                width: 350,
                borderRadius: 8,
                padding: 10,
                alignContent: 'space-between',
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginBottom: 8,
                  height: 50,
                }}
              >
                <View style={{ flex: 0.5, justifyContent: 'center' }}>
                  <Text style={globalStyles.profileTextLabel}>Backup</Text>
                </View>
                <View style={{ flex: 0.5, justifyContent: 'center' }}>
                  <Pressable
                    style={[globalStyles.button, globalStyles.button.primary.main]}
                    onPress={() => setShowBackupNowModal(true)}
                  >
                    <Text style={globalStyles.button.text.default}>Backup Now</Text>
                  </Pressable>
                </View>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginBottom: 8,
                  height: 50,
                }}
              >
                <View style={{ flex: 0.5, justifyContent: 'center' }}>
                  <Text style={globalStyles.profileTextLabel}>Restore</Text>
                </View>
                <View style={{ flex: 0.5, justifyContent: 'center' }}>
                  <Pressable
                    style={[globalStyles.button, globalStyles.button.primary.main]}
                    onPress={() => setShowRestoreFromBackupModal(true)}
                  >
                    <Text style={globalStyles.button.text.default}>Backup Restore</Text>
                  </Pressable>
                </View>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginBottom: 8,
                  height: 50,
                }}
              >
                <View style={{ flex: 0.5, justifyContent: 'center' }}>
                  <Text style={globalStyles.profileTextLabel}>Backup Key</Text>
                </View>
                <View style={{ flex: 0.5, justifyContent: 'center' }}>
                  <Pressable
                    style={[globalStyles.button, globalStyles.button.primary.main]}
                    onPress={() => setShowPassphraseModal(true)}
                  >
                    <Text style={globalStyles.button.text.default}>Set Backup Key</Text>
                  </Pressable>
                </View>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  height: 50,
                }}
              >
                <View style={{ flex: 0.5, justifyContent: 'center' }}>
                  <Text style={globalStyles.profileTextLabel}>New Device</Text>
                </View>
                <View style={{ flex: 0.5, justifyContent: 'center' }}>
                  <Pressable
                    style={[globalStyles.button, globalStyles.button.primary.main]}
                    onPress={() => setShowRestoreKeyModal(true)}
                  >
                    <Text style={globalStyles.button.text.default}>Restore Key</Text>
                  </Pressable>
                </View>
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
                flexDirection: 'row',
              }
            : {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
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
            console.log('deleting account');
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
              .then(() => {
                const currentUser = auth().currentUser as FirebaseAuthTypes.User;
                deleteItems(currentUser.uid).then((deletedCount) => {
                  console.log(`Deleted ${deletedCount} documents`);
                  currentUser
                    .delete()
                    .then((response) => {
                      console.log('Response', response);
                      setShowDeleteModal(false);
                      setUser(null);
                      setIsLoggedIn(false);
                      analytics()
                        .logEvent('user_delete', {
                          uid: currentUser.uid,
                          provider: currentUser.providerId,
                          displayName: currentUser.displayName ?? '',
                        })
                        .then((_) => console.log('delete user logged'))
                        .catch((_) => console.log('delete user log failed'));
                    })
                    .catch((reason: Error) => {
                      if (reason.message.includes('auth/requires-recent-login')) {
                        analytics()
                          .logEvent('user_delete_error', {
                            uid: currentUser.uid,
                            provider: currentUser.providerId,
                            displayName: currentUser.displayName ?? '',
                          })
                          .then((_) => console.log('delete user error logged'))
                          .catch((_) => console.log('delete user error log failed'));
                        setModalMessage(
                          `${reason.message} \n. Please logout, login and try deleting your account again.`
                        );
                      }
                      console.log('Error', reason);
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
            console.log('Restoring from backup');
            await restoreFromBackup(user.uid).then((x) => {
              setShowRestoreFromBackupModal(false);
              analytics()
                .logEvent('backup_restore', {
                  uid: user.uid,
                  provider: user.providerId,
                  displayName: user.displayName ?? '',
                })
                .catch((_) => console.log('backup restore analytics log failed'));
              console.info('Restored ', x, ' items');
              setTimeout(() => navigation.navigate('Home', { itemsReload: x }), 1000);
            });
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
      {isLoggedIn && showBackupNowModal ? (
        <ConfirmationModal
          message="Back up all items to the cloud now? Your data is encrypted before leaving your device."
          item={null}
          acceptCallbackFn={async () => {
            await pushAllItems(user.uid);
            setShowBackupNowModal(false);
            analytics()
              .logEvent('backup_push', {
                uid: user.uid,
                provider: user.providerId,
                displayName: user.displayName ?? '',
              })
              .catch((_) => console.log('backup push analytics log failed'));
          }}
          rejectCallbackFn={() => setShowBackupNowModal(false)}
          hideModalFn={() => setShowBackupNowModal(false)}
          visible={showBackupNowModal}
        />
      ) : (
        <></>
      )}
      {isLoggedIn && showPassphraseModal
        ? passphraseModal(
            'Set a passphrase to protect your backup key.\nYou will need this passphrase to restore your data on a new device.',
            async (passphrase) => {
              const wrapped = await wrapAESKey(passphrase);
              await saveWrappedKey(user.uid, wrapped);
              setShowPassphraseModal(false);
            }
          )
        : null}
      {isLoggedIn && showRestoreKeyModal
        ? passphraseModal(
            'Enter your passphrase to restore your encryption key from the cloud.',
            async (passphrase) => {
              const restored = await restoreKeyFromCloud(user.uid, passphrase);
              if (!restored) {
                throw new Error('No backup key found. Set a backup key first.');
              }
              setShowRestoreKeyModal(false);
            }
          )
        : null}
    </View>
  );
}
