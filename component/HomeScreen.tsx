import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View, Text, TextInput, Pressable } from 'react-native';
import AddItemModal from './AddItemModal';
import ConfirmationModal from './ConfirmationModal';
import auth from '@react-native-firebase/auth';
import {
  addTimestampToItems,
  createUserSettings,
  replaceItem,
  removeItem as storageRemoveItem,
  subscribeToItems,
} from './Core/Storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import globalStyles from './Core/GlobalStyles';
import analytics from '@react-native-firebase/analytics';
import { EdgeInsets, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { AListItem } from './Core/DataModel';
import { AListItemComponent } from './AListItemComponent';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function HomeScreen({ route }: any) {
  const [oneOffCorrections, setOneOffCorrections] = useState(false);
  const [user, _] = useState(route.params.user);
  const [alistItems, setAListItems] = useState([] as AListItem[]);
  const [selectedItem, setSelectedItem] = useState(null as AListItem | null);
  const [modalVisible, setModalVisible] = useState(false);
  const [confirmationModalVisible, setConfirmationModalVisible] = useState(false);
  const [searchText, setSearchText] = useState('');

  const removeItem = async (item: AListItem | null) => {
    if (item !== null) {
      // The subscription below delivers the post-delete snapshot.
      await storageRemoveItem(item);
    }
  };

  const hideModal = () => {
    setModalVisible(false);
    setSelectedItem(null);
  };
  const showModal = () => setModalVisible(true);

  const onSearchTextInput = (text: string) => {
    setSearchText(text);
  };

  const clearSearchFn = () => {
    setSearchText('');
  };

  const insets = useSafeAreaInsets();

  // Live subscription: the snapshot delivered after a local write already
  // contains that write, so a newly added item appears without navigating
  // away and back. Search is client-side over the decrypted items below,
  // so no plaintext search index is queried or written.
  useFocusEffect(
    React.useCallback(() => {
      const userId = auth().currentUser?.uid ?? '';
      const unsubscribe = subscribeToItems(userId, null, setAListItems, (error) => {
        console.log(error);
      });
      return unsubscribe;
    }, [])
  );

  const visibleItems = useMemo(() => {
    const term = searchText.trim().toLowerCase();
    if (!term) {
      return alistItems;
    }
    return alistItems.filter((item) => item.name.toLowerCase().includes(term));
  }, [alistItems, searchText]);

  useEffect(() => {
    console.info('Use Effect Invoked', alistItems);
    if (!oneOffCorrections) {
      if (user && !user.isAnonymous) {
        createUserSettings(user.uid)
          .then(() => console.log('User settings created'))
          .catch((error) => console.log('User settings ', error));
      }
      if (user?.uid) {
        addTimestampToItems(user.uid)
          .then(() => {
            console.log('Add timestamps executed');
            setOneOffCorrections(true);
          })
          .catch((error) => console.log('Add timestamps ', error));
      }
    }
  }, [oneOffCorrections]);

  const styles = getStyles(insets);

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
                  setSelectedItem(item);
                  setConfirmationModalVisible(true);
                }}
                editItem={(item: AListItem) => {
                  setSelectedItem(item);
                  setModalVisible(true);
                }}
              ></AListItemComponent>
            )}
            keyExtractor={(item, _) => item.name}
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
            console.log(`Saving ${JSON.stringify(item)}`);
            const itemWithUser = {
              ...item,
              userId: item.userId ?? user?.uid,
            };
            if (old.name) {
              analytics()
                .logEvent('edit_item', {
                  name: itemWithUser.name,
                })
                .then((_) => console.log('item edit logged'))
                .catch((_) => console.error("Couldn't log edit item event"));
            } else {
              analytics()
                .logEvent('add_item', {
                  name: itemWithUser.name,
                })
                .then((_) => console.log('add item logged'))
                .catch((_) => console.log('add item log failed'));
            }
            // The subscription delivers the updated list; no
            // manual reload is needed to show the saved item.
            await replaceItem(old, itemWithUser);
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
