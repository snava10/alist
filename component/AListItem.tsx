import React from "react";
import { View, Text, StyleSheet } from "react-native";
import * as Clipboard from "expo-clipboard";
import { IconButton, Provider, Tooltip } from "react-native-paper";

type AListItem = {
  name: string;
  value: string;
};

const AListItem = (props: AListItem) => {
  const copyValue = async (item: string) => {
    await Clipboard.setStringAsync(item);
    console.log(`Copied: ${item}`);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.column, styles.contentColumn]}>
        <Text style={styles.valueText}>{props.name}</Text>
        <Text style={styles.nameText}>{props.value}</Text>
      </View>
      <View style={[styles.column, styles.iconColumn]}>
        <Provider>
          <Tooltip title="Copied">
            <IconButton
              icon="content-copy"
              size={20}
              onPress={() => copyValue(props.value)}
            />
          </Tooltip>
        </Provider>
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
  nameText: {
    fontSize: 18,
  },
  valueText: {
    fontSize: 20,
    fontWeight: "bold",
  },
});

export default AListItem;
