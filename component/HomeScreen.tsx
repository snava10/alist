import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, View, Text, TextInput, Pressable } from 'react-native';
import AddItemModal from './AddItemModal';
import ConfirmationModal from './ConfirmationModal';
import {
  createUserSettings,
  filterVaultItems,
  removeVaultItem,
  saveVaultItem,
  subscribeToVaultItems,
} from './Core/Storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import globalStyles from './Core/GlobalStyles';
import analytics from '@react-native-firebase/analytics';
import { EdgeInsets, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { AListItem, VaultItem } from './Core/DataModel';
import { AListItemComponent } from './AListItemComponent';
import { useVaultContext } from './Core/VaultContext';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function HomeScreen({ route }: any) {
  const vault = useVaultContext();
  const [oneOffCorrections, setOneOffCorrections] = useState(false);
  const [user, _] = useState(route.params.user);
  const [alistItems, setAListItems] = useState([] as VaultItem[]);
  const [selectedItem, setSelectedItem] = useState(null as VaultItem | null);
  const [modalVisible, setModalVisible] = useState(false);
  const [confirmationModalVisible, setConfirmationModalVisible] = useState(false);
  const [searchText, setSearchText] = useState('');

  const userId: string = vault.userId ?? user?.uid ?? '';

  const removeItem = async (item: VaultItem | null) => {
    if (item !== null) {
      vault.noteActivity();
      // The subscription below delivers the post-delete snapshot.
      await removeVaultItem(userId, item.id);
    }
  };

  const hideModal = () => {
    setModalVisible(false);
    setSelectedItem(null);
  };
  const showModal = () => setModalVisible(true);

  const onSearchTextInput = (text: string) => {
    setSearchText(text);
    vault.noteActivity();
  };

  const clearSearchFn = () => {
    setSearchText('');
  };

  const insets = useSafeAreaInsets();

  // Live vault subscription: the snapshot delivered after a local
  // write already contains that write, so a newly added item appears
  // without navigating away and back. Locking drops the subscription
  // and clears the decrypted items.
  useFocusEffect(
    React.useCallback(() => {
      vault.noteActivity();
      if (vault.locked || !vault.vaultKey || !userId) {
        setAListItems([]);
        return;
      }
      const unsubscribe = subscribeToVaultItems(
        userId,
        vault.vaultKey,
        ({ items }) => {
          setAListItems(items);
          route.params.itemsReload = 0;
        },
        (error) => {
          console.log(error);
        }
      );
      return unsubscribe;
    }, [vault, userId])
  );

  const visibleItems = filterVaultItems(alistItems, searchText);

  useEffect(() => {
    if (!oneOffCorrections) {
      if (user && !user.isAnonymous) {
        createUserSettings(user.uid)
          .then(() => console.log('User settings created'))
          .catch((error) => console.log('User settings ', error));
      }
      setOneOffCorrections(true);
    }
  }, [oneOffCorrections, user]);

  const styles = getStyles(insets);

  if (vault.locked || !vault.vaultKey) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      {alistItems.length > 0 || searchText.length > 0 ? (
        <View style={{ alignSelf: 'stretch', flex: 1 }}>
          <View style={{ paddingLeft: 16, paddingRight: 16 }}>
            <View style={[globalStyles.searchContainer]}>
              <Ionicons style={globalStyles.searchIcon} name="search-outline" size={20} />
              <TextInput
                style={globalStyles.searchInput}
                placeholder="Search..."
                onChangeText={onSearchTextInput}
                value={searchText}
              />
              {searchText && (
                <Ionicons
                  style={globalStyles.searchIcon}
                  name="backspace-outline"
                  size={20}
                  onPress={clearSearchFn}
                />
              )}
            </View>
          </View>
          <FlatList
            data={visibleItems}
            renderItem={({ item }) => (
              <AListItemComponent
                item={item}
                removeItem={(item: AListItem) => {
                  setSelectedItem(item as VaultItem);
                  setConfirmationModalVisible(true);
                }}
                editItem={(item: AListItem) => {
                  setSelectedItem(item as VaultItem);
                  setModalVisible(true);
                }}
              ></AListItemComponent>
            )}
            keyExtractor={(item) => item.id}
          />
        </View>
      ) : (
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 22, textAlign: 'center' }}>
            Tap{' '}
            <Ionicons
              name="add-circle"
              style={(styles.fab, { marginLeft: 10 })}
              size={25}
              onPress={() => setModalVisible(true)}
            />{' '}
            to add a new item
          </Text>
        </View>
      )}

      {modalVisible ? (
        <AddItemModal
          item={selectedItem}
          saveItem={async (old: AListItem, item: AListItem) => {
            vault.noteActivity();
            if (old.name) {
              analytics()
                .logEvent('edit_item')
                .then((_) => console.log('item edit logged'))
                .catch((_) => console.error("Couldn't log edit item event"));
            } else {
              analytics()
                .logEvent('add_item')
                .then((_) => console.log('add item logged'))
                .catch((_) => console.log('add item log failed'));
            }
            const existingId = (old as VaultItem).id;
            // The subscription delivers the updated list; no
            // manual reload is needed to show the saved item.
            // Analytics carries no item name or content.
            await saveVaultItem(
              userId,
              {
                ...(existingId ? { id: existingId } : {}),
                name: item.name,
                value: item.value,
              },
              vault.vaultKey
            );
          }}
          hideModal={hideModal}
          showModal={showModal}
          visible={modalVisible}
        />
      ) : (
        <Pressable
          testID="add-item-button"
          accessibilityLabel="Add item"
          style={styles.fab}
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="add-circle" size={60} />
        </Pressable>
      )}
      <ConfirmationModal
        message={'Are you sure you wish to delete ' + selectedItem?.name}
        visible={confirmationModalVisible}
        item={selectedItem}
        acceptCallbackFn={() => {
          removeItem(selectedItem);
          setSelectedItem(null);
          setConfirmationModalVisible(false);
        }}
        rejectCallbackFn={() => {
          setSelectedItem(null);
          setConfirmationModalVisible(false);
        }}
        hideModalFn={() => {
          setSelectedItem(null);
          setConfirmationModalVisible(false);
        }}
      ></ConfirmationModal>
    </View>
  );
}

const getStyles = (insets: EdgeInsets) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#fff',
      paddingTop: insets.top,
      paddingLeft: insets.left,
      paddingRight: insets.right,
    },
    item: {
      padding: 10,
      fontSize: 18,
      height: 44,
    },
    fab: {
      width: 60,
      height: 60,
      position: 'absolute',
      bottom: 20,
      left: 20,
      borderRadius: 100,
      alignContent: 'center',
    },
  });
