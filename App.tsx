import { useEffect, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import AListItem from "./component/AListItem";
import AddItemModal from "./component/AddItemModal";
import { getAllItems, saveItem } from "./component/Storage";

export default function App() {
  const [alistItems, setAListItems] = useState([] as AListItem[]);

  const loadItemsFromLocalStorage = async () => {
    console.log("Loading all items");
    var items: AListItem[] = [];
    try {
      getAllItems().then((items) => {
        console.log("Items " + JSON.stringify(items));
        setAListItems(items);
      });
    } catch (e) {
      console.log(e);
    }
  };

  useEffect(() => {
    loadItemsFromLocalStorage();
    console.log(alistItems);
  }, []);

  return (
    <View style={styles.container}>
      {/* <Text>Open up App.tsx to start working on your app!</Text>
      <StatusBar style="auto" /> */}
      <FlatList
        style={{ alignSelf: "stretch", flex: 0.85, marginBottom: 20 }}
        data={alistItems}
        renderItem={({ item }) => (
          <AListItem name={item.name} value={item.value}></AListItem>
        )}
        keyExtractor={(item, index) => item.name}
      />
      <View style={{ flex: 0.15, justifyContent: "center" }}>
        <AddItemModal
          saveItem={async (item: AListItem) => {
            await saveItem(item);
            await loadItemsFromLocalStorage();
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 50,
  },
  item: {
    padding: 10,
    fontSize: 18,
    height: 44,
  },
});
