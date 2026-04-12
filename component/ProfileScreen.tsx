import React, { useEffect, useState } from 'react';
import auth from '@react-native-firebase/auth';
import AuthenticationComponent from './Login/AuthenticationComponent';
import { View, Text, Pressable, Modal, TextInput, StyleSheet, Alert } from 'react-native';
import globalStyles from './Core/GlobalStyles';
import { BackupCadence, HomeTabParamList } from './Core/DataModel';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ConfirmationModal from './ConfirmationModal';
import { FirebaseAuthTypes } from '@react-native-firebase/auth';
import {
  deleteItems,
  pushAllItems,
  restoreFromBackup,
  restoreKeyFromCloud,
  saveWrappedKey,
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
  const [showSetKeyModal, setShowSetKeyModal] = useState(false);
  const [showRestoreKeyModal, setShowRestoreKeyModal] = useState(false);
  const [passphraseInput, setPassphraseInput] = useState('');
  const [isSavingBackupKey, setIsSavingBackupKey] = useState(false);
  const [isRestoringBackupKey, setIsRestoringBackupKey] = useState(false);

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

          {/* ── Backup & Security section ── */}
          <View style={profileStyles.section}>
            <Text style={profileStyles.sectionHeader}>Backup &amp; Security</Text>

            <View style={profileStyles.row}>
              <Text style={profileStyles.rowLabel}>Restore backup</Text>
              <Pressable
                style={[globalStyles.button, globalStyles.button.primary.main]}
                onPress={() => setShowRestoreFromBackupModal(true)}
              >
                <Text style={globalStyles.button.text.default}>Backup Restore</Text>
              </Pressable>
            </View>

            <View style={profileStyles.row}>
              <Text style={profileStyles.rowLabel}>Cloud backup</Text>
              <Pressable
                style={[globalStyles.button, globalStyles.button.primary.main]}
                onPress={async () => {
                  await pushAllItems(user.uid);
                }}
              >
                <Text style={globalStyles.button.text.default}>Backup Now</Text>
              </Pressable>
            </View>

            <View style={profileStyles.row}>
              <Text style={profileStyles.rowLabel}>Backup key</Text>
              <Pressable
                style={[globalStyles.button, globalStyles.button.primary.main]}
                onPress={() => {
                  setPassphraseInput('');
                  setShowSetKeyModal(true);
                }}
              >
                <Text style={globalStyles.button.text.default}>Set Backup Key</Text>
              </Pressable>
            </View>

            <View style={profileStyles.row}>
              <Text style={profileStyles.rowLabel}>Restore key</Text>
              <Pressable
                style={[globalStyles.button, globalStyles.button.primary.main]}
                onPress={() => {
                  setPassphraseInput('');
                  setShowRestoreKeyModal(true);
                }}
              >
                <Text style={globalStyles.button.text.default}>Restore Key</Text>
              </Pressable>
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
                .catch((_) => console.log('backup log failed'));
              console.info('Restored ', x, ' items');
              // This is needed otherwise the items won't show up on the Home screen.
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
      {/* Set Backup Key modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showSetKeyModal}
        onRequestClose={() => setShowSetKeyModal(false)}
      >
        <View style={passphraseStyles.overlay}>
          <View style={passphraseStyles.container}>
            <Text style={passphraseStyles.title}>Set Backup Key</Text>
            <TextInput
              style={passphraseStyles.input}
              placeholder="Enter passphrase"
              placeholderTextColor="#6e6e6e"
              secureTextEntry
              value={passphraseInput}
              onChangeText={setPassphraseInput}
            />
            <View style={{ flexDirection: 'row', marginTop: 10 }}>
              <Pressable
                style={[globalStyles.button, globalStyles.button.primary.main]}
                onPress={async () => {
                  if (isSavingBackupKey) return;
                  const passphrase = passphraseInput.trim();
                  if (!passphrase) {
                    Alert.alert('Backup key required', 'Please enter a passphrase before saving.');
                    return;
                  }
                  setIsSavingBackupKey(true);
                  try {
                    const wrapped = await wrapAESKey(passphrase, { mode: 'fast' });
                    await saveWrappedKey(user.uid, wrapped);
                    setShowSetKeyModal(false);
                    Alert.alert('Backup key saved', 'Your encrypted backup key has been saved.');
                  } catch (e) {
                    console.error('Failed to save backup key', e);
                    Alert.alert('Save failed', 'Could not save backup key. Please try again.');
                  } finally {
                    setIsSavingBackupKey(false);
                  }
                }}
              >
                <Text style={globalStyles.button.text.default}>
                  {isSavingBackupKey ? 'Saving...' : 'Save'}
                </Text>
              </Pressable>
              <Pressable
                style={[globalStyles.button, globalStyles.button.error.main]}
                onPress={() => setShowSetKeyModal(false)}
              >
                <Text style={globalStyles.button.text.default}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      {/* Restore Key modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showRestoreKeyModal}
        onRequestClose={() => setShowRestoreKeyModal(false)}
      >
        <View style={passphraseStyles.overlay}>
          <View style={passphraseStyles.container}>
            <Text style={passphraseStyles.title}>Restore Key</Text>
            <TextInput
              style={passphraseStyles.input}
              placeholder="Enter passphrase"
              placeholderTextColor="#6e6e6e"
              secureTextEntry
              value={passphraseInput}
              onChangeText={setPassphraseInput}
            />
            <View style={{ flexDirection: 'row', marginTop: 10 }}>
              <Pressable
                style={[globalStyles.button, globalStyles.button.primary.main]}
                onPress={async () => {
                  if (isRestoringBackupKey) return;
                  const passphrase = passphraseInput.trim();
                  if (!passphrase) {
                    Alert.alert(
                      'Passphrase required',
                      'Please enter your passphrase to restore the key.'
                    );
                    return;
                  }
                  setIsRestoringBackupKey(true);
                  try {
                    await restoreKeyFromCloud(user.uid, passphrase);
                    setShowRestoreKeyModal(false);
                    Alert.alert('Key restored', 'Backup key restored successfully.');
                  } catch (e) {
                    console.error('Failed to restore backup key', e);
                    Alert.alert(
                      'Restore failed',
                      'Could not restore key. Verify your passphrase and try again.'
                    );
                  } finally {
                    setIsRestoringBackupKey(false);
                  }
                }}
              >
                <Text style={globalStyles.button.text.default}>
                  {isRestoringBackupKey ? 'Restoring...' : 'Restore'}
                </Text>
              </Pressable>
              <Pressable
                style={[globalStyles.button, globalStyles.button.error.main]}
                onPress={() => setShowRestoreKeyModal(false)}
              >
                <Text style={globalStyles.button.text.default}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const profileStyles = StyleSheet.create({
  section: {
    width: '100%',
    paddingHorizontal: 16,
    marginTop: 16,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6e6e6e',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  rowLabel: {
    fontSize: 15,
    color: '#1a1a1a',
  },
});

const passphraseStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 20,
    width: 300,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 8,
    fontSize: 16,
  },
});
