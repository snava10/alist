import React, { useState } from "react";
import { View, Modal, StyleSheet } from "react-native";
import { TextInput, Provider, Button } from "react-native-paper";
import AListItem from "./AListItem";

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
    <Provider>
      <View>
        <Modal
          transparent={true}
          visible={props.visible}
          onRequestClose={() => {
            props.hideModal();
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
                  style={styles.button}
                  mode="outlined"
                  onPress={handleSave}
                >
                  Save
                </Button>
                <Button
                  style={styles.button}
                  mode="contained"
                  onPress={() => {
                    setName("");
                    setValue("");
                    props.hideModal();
                  }}
                >
                  Cancel
                </Button>
              </View>
            </View>
          </View>
        </Modal>
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
    marginRight: 3,
    marginLeft: 3,
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
