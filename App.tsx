import React, { useEffect, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import AListItem from "./component/AListItem";
import AddItemModal from "./component/AddItemModal";
import ConfirmationModal from "./component/ConfirmationModal";
import {
  getAllItems,
  saveItem,
  removeItem as storageRemoveItem,
} from "./component/Storage";
import Ionicons from "@expo/vector-icons/Ionicons";

export default function App() {
  const [alistItems, setAListItems] = useState([] as AListItem[]);
  const [selectedItem, setSelectedItem] = useState(null as AListItem | null);
  const [modalVisible, setModalVisible] = useState(false);
  const [confirmationModalVisible, setConfirmationModalVisible] =
    useState(false);

  const loadItemsFromLocalStorage = async () => {
    try {
      getAllItems().then((items) => {
        setAListItems(items);
      });
    } catch (e) {
      console.log(e);
    }
  };

  const removeItem = async (item: AListItem | null) => {
    if (item !== null) {
      await storageRemoveItem(item);
      loadItemsFromLocalStorage();
    }
  };

  const hideModal = () => {
    setModalVisible(false);
    setSelectedItem(null);
  };
  const showModal = () => setModalVisible(true);

  useEffect(() => {
    loadItemsFromLocalStorage();
  }, []);

  return (
    <View style={styles.container}>
      <FlatList
        style={{ alignSelf: "stretch", flex: 0.8, marginBottom: 20 }}
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
      {modalVisible ? (
        <AddItemModal
          item={selectedItem}
          saveItem={async (item: AListItem) => {
            await saveItem(item);
            await loadItemsFromLocalStorage();
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
    justifyContent: "center",
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
