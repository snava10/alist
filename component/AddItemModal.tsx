import React, { useState } from "react";
import { View, Modal, StyleSheet, Text } from "react-native";
import {
  TextInput,
  Provider,
  Button,
  Dialog,
  PaperProvider,
  Portal,
} from "react-native-paper";
import AListItem from "./AListItem";

const AddItemModal = (props: { saveItem: any }) => {
  const [visible, setVisible] = useState(false);
  const [name, setName] = useState("");
  const [value, setValue] = useState("");

  const showModal = () => setVisible(true);
  const hideModal = () => setVisible(false);
  const handleSave = () => {
    // Here you can save the new user details to your database or state management system
    // For simplicity, we will just log the user details
    console.log("New User Details:", { name, value });
    hideModal();
  };

  return (
    <Provider>
      <View>
        <Modal
          animationType="slide"
          transparent={true}
          visible={visible}
          onRequestClose={() => {
            setVisible(!visible);
          }}
        >
          <View style={styles.centeredView}>
            <View style={styles.modalView}>
              <TextInput
                label="Name"
                value={name}
                onChangeText={(text) => setName(text)}
                style={styles.input}
              />
              <TextInput
                label="Value"
                value={value}
                onChangeText={(text) => setValue(text)}
                style={styles.input}
              />
              <View style={{ flexDirection: "row" }}>
                <Button
                  mode="outlined"
                  onPress={() => {
                    props.saveItem({ name, value } as AListItem);
                    setVisible(!visible);
                  }}
                >
                  Save
                </Button>
                <Button
                  mode="contained"
                  onPress={() => {
                    setName("");
                    setValue("");
                    setVisible(!visible);
                  }}
                >
                  Cancel
                </Button>
              </View>
            </View>
          </View>
        </Modal>
        <Button mode="contained" onPress={() => setVisible(true)}>
          New
        </Button>
      </View>
    </Provider>
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
  button: {
    borderRadius: 20,
    padding: 10,
    elevation: 2,
  },
  buttonOpen: {
    backgroundColor: "#F194FF",
  },
  buttonClose: {
    backgroundColor: "#2196F3",
  },
  textStyle: {
    color: "white",
    fontWeight: "bold",
    textAlign: "center",
  },
  modalText: {
    marginBottom: 15,
    textAlign: "center",
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
