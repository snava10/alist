import React, { useEffect, useState } from "react";
import { FlatList, StyleSheet, View, Text, TextInput } from "react-native";
import AListItem from "./AListItem";
import AddItemModal from "./AddItemModal";
import ConfirmationModal from "./ConfirmationModal";
import {
  getItems,
  getItemsCount,
  replaceItem,
  removeItem as storageRemoveItem,
} from "./Storage";
import Ionicons from "@expo/vector-icons/Ionicons";
import globalStyles from "./GlobalStyles";
import analytics from "@react-native-firebase/analytics";

export default function HomeScreen() {
  const [alistItems, setAListItems] = useState([] as AListItem[]);
  const [itemsCount, setItemsCount] = useState(0);
  const [selectedItem, setSelectedItem] = useState(null as AListItem | null);
  const [modalVisible, setModalVisible] = useState(false);
  const [confirmationModalVisible, setConfirmationModalVisible] =
    useState(false);
  const [searchText, setSearchText] = useState("");

  const loadItemsFromLocalStorage = async (st: string) => {
    try {
      getItems(st).then((items) => {
        setAListItems(items);
      });
      getItemsCount().then((itemsCount) => {
        setItemsCount(itemsCount);
      });
    } catch (e) {
      console.log(e);
    }
  };

  const removeItem = async (item: AListItem | null) => {
    if (item !== null) {
      await storageRemoveItem(item);
      loadItemsFromLocalStorage(searchText);
    }
  };

  const hideModal = () => {
    setModalVisible(false);
    setSelectedItem(null);
  };
  const showModal = () => setModalVisible(true);

  const onSearchTextInput = (text: string) => {
    setSearchText(text);
    loadItemsFromLocalStorage(text);
  };

  const clearSearchFn = () => {
    setSearchText("");
    loadItemsFromLocalStorage("");
  };

  useEffect(() => {
    loadItemsFromLocalStorage(searchText);
  }, []);

  return (
    <View style={styles.container}>
      {itemsCount > 0 ? (
        <View style={{ alignSelf: "stretch", flex: 0.8, marginBottom: 20 }}>
          <View style={{ paddingLeft: 16, paddingRight: 16 }}>
            <View style={[globalStyles.searchContainer]}>
              <Ionicons
                style={globalStyles.searchIcon}
                name="search-outline"
                size={20}
              />
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
            data={alistItems}
            renderItem={({ item }) => (
              <AListItem
                item={item}
                removeItem={(item: AListItem) => {
                  setSelectedItem(item);
                  setConfirmationModalVisible(true);
                }}
                editItem={(item: AListItem) => {
                  setSelectedItem(item);
                  setModalVisible(true);
                }}
              ></AListItem>
            )}
            keyExtractor={(item, index) => item.name}
          />
        </View>
      ) : (
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 22, textAlign: "center" }}>
            Tap{" "}
            <Ionicons
              name="add-circle"
              style={(styles.fab, { marginLeft: 10 })}
              size={25}
              onPress={() => setModalVisible(true)}
            />{" "}
            to add a new item
          </Text>
        </View>
      )}

      {modalVisible ? (
        <AddItemModal
          item={selectedItem}
          saveItem={async (old: AListItem, item: AListItem) => {
            if (old.name) {
              await analytics().logEvent("edit_item", {
                name: item.name,
              });
            } else {
              await analytics().logEvent("add_item", {
                name: item.name,
              });
            }
            await replaceItem(old, item);
            await loadItemsFromLocalStorage(searchText);
          }}
          hideModal={hideModal}
          showModal={showModal}
          visible={modalVisible}
        />
      ) : (
        <Ionicons
          name="add-circle"
          style={styles.fab}
          size={60}
          onPress={() => setModalVisible(true)}
        />
      )}
      <ConfirmationModal
        message={"Are you sure you wish to delete " + selectedItem?.name}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  item: {
    padding: 10,
    fontSize: 18,
    height: 44,
  },
  fab: {
    width: 60,
    height: 60,
    position: "absolute",
    bottom: 20,
    right: 20,
    borderRadius: 100,
    alignContent: "center",
  },
});
