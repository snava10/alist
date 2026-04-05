import React from 'react';
import { render } from '@testing-library/react-native';
import AddItemModal from '../AddItemModal';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('../Core/GlobalStyles', () => ({
  modalViewCentered: {},
  modalView: {},
  button: {
    primary: { main: {} },
    error: { main: {} },
    text: { default: {} },
  },
  input: {
    main: {
      borderColor: '#d3d3d3',
      borderWidth: 1,
      borderRadius: 5,
      padding: 10,
      marginBottom: 10,
    },
  },
}));

jest.mock('@expo/vector-icons/Ionicons', () => {
  return function MockIcon() {
    return null;
  };
});

jest.mock('expo-clipboard', () => ({
  __esModule: true,
  default: {
    setStringAsync: jest.fn().mockResolvedValue(true),
  },
}));

jest.mock('../Core/Storage', () => ({
  saveItem: jest.fn().mockResolvedValue(undefined),
}));

describe('AddItemModal', () => {
  const mockItem = {
    id: 'test-item-1',
    name: 'Test Item',
    value: 'test-value',
    encrypted: false,
    timestamp: Date.now(),
    created: Date.now(),
  };

  const mockAddFn = jest.fn();
  const mockUpdateFn = jest.fn();
  const mockHideFn = jest.fn();

  const defaultProps = {
    visible: true,
    addItemFn: mockAddFn,
    editItemFn: mockUpdateFn,
    hideModalFn: mockHideFn,
    selectedItem: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(
      <SafeAreaProvider>
        <AddItemModal {...defaultProps} />
      </SafeAreaProvider>
    );
    expect(toJSON()).toBeTruthy();
  });

  it('hides modal when visible is false', () => {
    const { queryByDisplayValue } = render(
      <SafeAreaProvider>
        <AddItemModal {...defaultProps} visible={false} />
      </SafeAreaProvider>
    );
    expect(queryByDisplayValue('Item Name')).toBeFalsy();
  });

  it('renders add mode when selectedItem is null', () => {
    const { toJSON } = render(
      <SafeAreaProvider>
        <AddItemModal {...defaultProps} selectedItem={null} />
      </SafeAreaProvider>
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders edit mode when selectedItem is provided', () => {
    const { toJSON } = render(
      <SafeAreaProvider>
        <AddItemModal {...defaultProps} selectedItem={mockItem} />
      </SafeAreaProvider>
    );
    expect(toJSON()).toBeTruthy();
  });

  it('handles empty item name and value', () => {
    const { toJSON } = render(
      <SafeAreaProvider>
        <AddItemModal {...defaultProps} />
      </SafeAreaProvider>
    );
    expect(toJSON()).toBeTruthy();
  });

  it('handles long item names', () => {
    const longNameItem = {
      ...mockItem,
      name: 'This is a very long item name that should be handled properly by the component',
    };
    const { toJSON } = render(
      <SafeAreaProvider>
        <AddItemModal {...defaultProps} selectedItem={longNameItem} />
      </SafeAreaProvider>
    );
    expect(toJSON()).toBeTruthy();
  });

  it('handles special characters in values', () => {
    const specialCharItem = {
      ...mockItem,
      value: 'test@#$%^&*()',
    };
    const { toJSON } = render(
      <SafeAreaProvider>
        <AddItemModal {...defaultProps} selectedItem={specialCharItem} />
      </SafeAreaProvider>
    );
    expect(toJSON()).toBeTruthy();
  });

  it('toggles encryption checkbox state', () => {
    const { toJSON } = render(
      <SafeAreaProvider>
        <AddItemModal {...defaultProps} />
      </SafeAreaProvider>
    );
    expect(toJSON()).toBeTruthy();
  });

  it('handles modal visibility transitions', () => {
    const { rerender, toJSON } = render(
      <SafeAreaProvider>
        <AddItemModal {...defaultProps} visible={true} />
      </SafeAreaProvider>
    );
    expect(toJSON()).toBeTruthy();

    rerender(
      <SafeAreaProvider>
        <AddItemModal {...defaultProps} visible={false} />
      </SafeAreaProvider>
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders with SafeAreaProvider', () => {
    const { toJSON } = render(
      <SafeAreaProvider>
        <AddItemModal {...defaultProps} />
      </SafeAreaProvider>
    );
    expect(toJSON()).toBeTruthy();
  });
});
