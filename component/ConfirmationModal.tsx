import { Modal, View, Text, Pressable } from "react-native";
import globalStyles from "./Core/GlobalStyles";
import AListItem from "./AListItem";

const ConfirmationModal = (props: {
  visible: boolean;
  message: string;
  item: AListItem | null;
  acceptCallbackFn: any;
  rejectCallbackFn: any;
  hideModalFn: any;
}) => {
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={props.visible}
      onRequestClose={() => {
        props.hideModalFn();
      }}
    >
      <View style={globalStyles.modalViewCentered}>
        <View style={globalStyles.modalView}>
          <Text style={{ fontSize: 20 }}>{props.message}</Text>
          <View style={{ flexDirection: "row", marginTop: 10 }}>
            <Pressable
              style={[globalStyles.button, globalStyles.button.primary.main]}
              onPress={props.acceptCallbackFn}
            >
              <Text style={globalStyles.button.text.defaut}>Yes</Text>
            </Pressable>
            <Pressable
              style={[globalStyles.button, globalStyles.button.error.main]}
              onPress={props.rejectCallbackFn}
            >
              <Text style={globalStyles.button.text.defaut}>No</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default ConfirmationModal;
