import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";

type AListItemProps = {
  name: string;
  value: string;
};

const AListItem = (props: AListItemProps) => {
  const copyValue = (item: string) => {
    // You can implement the logic to copy the name to the clipboard here
    // For simplicity, let's just log the copied name for demonstration purposes.
    console.log(`Copied: ${item}`);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.column, styles.contentColumn]}>
        <Text>{props.name}</Text>
        <Text>{props.value}</Text>
      </View>
      <View style={[styles.column, styles.iconColumn]}>
        <Icon
          name="copy"
          size={20}
          color="#007AFF"
          onPress={() => copyValue(props.value)}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
  },
  column: {
    marginHorizontal: 8,
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  contentColumn: {
    flex: 3,
    backgroundColor: "#f0f0f0",
  },
  iconColumn: {
    flex: 1,
  },
  text: {
    fontSize: 18,
    fontWeight: "bold",
  },
});

export default AListItem;
