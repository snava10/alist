import { render } from "@testing-library/react-native";
import HomeScreen from "../component/HomeScreen";
import React from "react";

jest.mock("../component/Core/Storage");
jest.mock("@react-native-async-storage/async-storage", () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
}));

jest.mock(
  '@react-native/Libraries/Utilities/Platform',
  (): object => ({
    ...require.requireActual('react-native/Libraries/Utilities/Platform'),
    isTesting: (): boolean => true,
  })
);

describe("<HomeScreen />", () => {
  test("Text renders correctly on HomeScreen", () => {
    const { getByText } = render(<HomeScreen />);
    getByText("Welcome!");
  });
});
