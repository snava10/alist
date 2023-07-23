import { useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import AListItem from "./component/AListItem";
import AddItemModal from "./component/AddItemModal";

export default function App() {
  const [alistItems, setAListItems] = useState([
    { name: "Item1", value: "Value1" } as AListItem,
  ]);

  function addItemToList(item: AListItem) {
    setAListItems([...alistItems, item]);
  }

  return (
    <View style={styles.container}>
      {/* <Text>Open up App.tsx to start working on your app!</Text>
      <StatusBar style="auto" /> */}
      <FlatList
        style={{ alignSelf: "stretch" }}
        data={alistItems}
        renderItem={({ item }) => (
          <AListItem name={item.name} value={item.value}></AListItem>
        )}
        keyExtractor={(item, index) => item.name}
      />
      <AddItemModal saveItem={(item: AListItem) => addItemToList(item)} />
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
