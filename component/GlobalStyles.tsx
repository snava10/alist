import { StyleSheet } from "react-native";

const theme = {
  palette: {
    primary: {
      light: "#42a5f5", // Adjust the color to your preference
      main: "#1976d2",
      dark: "#1565c0",
    },
    secondary: {
      main: "#FF5722", // Adjust the color to your preference
    },
    error: {
      light: "#ef5350",
      main: "#d32f2f",
      dark: "#c62828",
    },
  },
};

const globalStyles = StyleSheet.create({
  button: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 4,
    elevation: 3,
    marginRight: 3,
    marginLeft: 3,
    primary: StyleSheet.create({
      main: {
        backgroundColor: theme.palette.primary.main,
      },
    }),
    error: StyleSheet.create({
      main: {
        backgroundColor: theme.palette.error.main,
      },
    }),
    text: StyleSheet.create({
      defaut: {
        fontSize: 16,
        lineHeight: 21,
        letterSpacing: 0.25,
        color: "white",
      },
    }),
  },
  modalViewCentered: {
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
  container: {},
});

export default globalStyles;
