import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import * as Clipboard from "expo-clipboard";
import { IconButton } from "react-native-paper";

type AListItem = {
  name: string;
  value: string;
};

const AListItem = (props: {
  item: AListItem;
  removeItem: any;
  editItem: any;
}) => {
  const [copied, setCopied] = useState(false);

  const copyValue = async (item: string) => {
    await Clipboard.setStringAsync(item);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 1000);
    console.log(`Copied: ${item}`);
  };

  return (
    <View style={styles.container}>
      {!copied && (
        <Pressable
          style={[styles.column, styles.contentColumn]}
          onPress={() => copyValue(props.item.value)}
        >
          <Text style={styles.valueText}>{props.item.value}</Text>
          <Text style={styles.nameText}>{props.item.name}</Text>
        </Pressable>
      )}

      {copied && (
        <View
          style={[
            styles.column,
            styles.contentColumn,
            { backgroundColor: "green" },
          ]}
        >
          <Text style={styles.copied}>Copied</Text>
        </View>
      )}

      <View style={[styles.column, styles.iconColumn]}>
        {/* <Provider>
          <Tooltip title="Copied"> */}
        <IconButton
          icon="pencil"
          size={20}
          onPress={() => props.editItem(props.item)}
        />
        <IconButton
          icon="delete"
          size={20}
          onPress={() => props.removeItem(props.item)}
        />
        {/* </Tooltip>
        </Provider> */}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 10,
    height: 80,
  },
  column: {
    marginHorizontal: 8,
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  contentColumn: {
    flex: 0.9,
    backgroundColor: "#f0f0f0",
  },
  iconColumn: {
    flex: 0.1,
    flexDirection: "row",
  },
  nameText: {
    fontSize: 18,
  },
  valueText: {
    fontSize: 20,
    fontWeight: "bold",
  },
  copied: {
    fontSize: 20,
    color: "white",
  },
});

export default AListItem;
