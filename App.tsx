import { useEffect, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import AListItem from "./component/AListItem";
import AddItemModal from "./component/AddItemModal";
import {
  getAllItems,
  saveItem,
  removeItem as storageRemoveItem,
} from "./component/Storage";
import { Button, FAB } from "react-native-paper";

export default function App() {
  const [alistItems, setAListItems] = useState([] as AListItem[]);
  const [selectedItem, setSelectedItem] = useState(null as AListItem | null);
  const [modalVisible, setModalVisible] = useState(false);

  const loadItemsFromLocalStorage = async () => {
    try {
      getAllItems().then((items) => {
        setAListItems(items);
      });
    } catch (e) {
      console.log(e);
    }
  };

  const removeItem = async (item: AListItem) => {
    await storageRemoveItem(item);
    loadItemsFromLocalStorage();
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
      {/* <Text>Open up App.tsx to start working on your app!</Text>
      <StatusBar style="auto" /> */}
      <FlatList
        style={{ alignSelf: "stretch", flex: 0.8, marginBottom: 20 }}
        data={alistItems}
        renderItem={({ item }) => (
          <AListItem
            item={item}
            removeItem={removeItem}
            editItem={(item: AListItem) => {
              setSelectedItem(item);
              setModalVisible(true);
            }}
          ></AListItem>
        )}
        keyExtractor={(item, index) => item.name}
      />
      {/* <View style={{ flex: 0.2, justifyContent: "center" }}> */}
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
        // <View style={{ alignSelf: "flex-end" }}>
        <FAB
          icon="plus"
          color="white"
          size="medium"
          style={styles.fab}
          onPress={() => setModalVisible(true)}
        />
        // </View>
      )}
      {/* </View> */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    justifyContent: "center",
    paddingTop: 50,
  },
  item: {
    padding: 10,
    fontSize: 18,
    height: 44,
  },
  fab: {
    position: "absolute",
    margin: 40,
    bottom: 0,
    right: 0,
    backgroundColor: "#6750a4",
    borderRadius: 100,
  },
});
