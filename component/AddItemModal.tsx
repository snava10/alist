import React, { useState } from "react";
import {
  View,
  Modal,
  StyleSheet,
  TextInput,
  Pressable,
  Text,
} from "react-native";
import AListItem from "./AListItem";
import globalStyles from "./GlobalStyles";

const AddItemModal = (props: {
  item?: AListItem | null;
  saveItem: any;
  hideModal: any;
  showModal: any;
  visible: boolean;
}) => {
  const [name, setName] = useState(props.item !== null ? props.item?.name : "");
  const [value, setValue] = useState(
    props.item !== null ? props.item?.value : ""
  );

  const handleSave = () => {
    if (name && value) {
      props.saveItem({ name, value } as AListItem);
      setName("");
      setValue("");
      props.hideModal();
    }
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={props.visible}
      onRequestClose={() => {
        props.hideModal();
      }}
    >
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          <TextInput
            value={name}
            onChangeText={(text) => setName(text)}
            style={styles.input}
            placeholder="Name"
          />
          <TextInput
            value={value}
            onChangeText={(text) => setValue(text)}
            style={styles.input}
            placeholder="Value"
          />
          <View style={{ flexDirection: "row" }}>
            <Pressable
              style={[globalStyles.button, globalStyles.button.primary.main]}
              onPress={handleSave}
            >
              <Text style={globalStyles.button.text.defaut}>Save</Text>
              {/* <Button title="Save" onPress={handleSave} /> */}
            </Pressable>
            <Pressable
              style={[globalStyles.button, globalStyles.button.error.main]}
              onPress={() => {
                setName("");
                setValue("");
                props.hideModal();
              }}
            >
              <Text style={globalStyles.button.text.defaut}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: "center",
    marginTop: 22,
  },
  modalView: {
    margin: 20,
    backgroundColor: "white",
    borderRadius: 20,
    padding: 35,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  input: {
    marginBottom: 10,
    alignSelf: "stretch",
  },
  column: {
    marginHorizontal: 8,
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
  },
});

export default AddItemModal;
