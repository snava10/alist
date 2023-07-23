import { useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import AListItem from "./component/AListItem";
import AddItemModal from "./component/AddItemModal";

export default function App() {
  const [alistItems, setAListItems] = useState(["Item 1", "Item 2"]);

  return (
    <View style={styles.container}>
      {/* <Text>Open up App.tsx to start working on your app!</Text>
      <StatusBar style="auto" /> */}
      <FlatList
        style={{ alignSelf: "stretch" }}
        data={alistItems}
        renderItem={({ item }) => (
          <AListItem name={item} value={"value"}></AListItem>
        )}
        keyExtractor={(item, index) => index.toString()}
      />
      <AddItemModal />
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
