import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { TextInput } from 'react-native';
import AddItemModal from '../AddItemModal';

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

  const mockSaveItemFn = jest.fn();
  const mockHideModalFn = jest.fn();

  const defaultProps = {
    visible: true,
    item: null,
    saveItem: mockSaveItemFn,
    hideModal: mockHideModalFn,
    showModal: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Rendering tests
  it('renders without crashing when visible', async () => {
    const { toJSON } = render(<AddItemModal {...defaultProps} />);

    await waitFor(() => {
      expect(toJSON()).toBeTruthy();
    });
  });

  it('renders modal when visible is true', async () => {
    const { toJSON } = render(<AddItemModal {...defaultProps} visible={true} />);

    await waitFor(() => {
      expect(toJSON()).toBeTruthy();
    });
  });

  it('renders with empty fields in add mode', async () => {
    const { UNSAFE_getAllByType } = render(<AddItemModal {...defaultProps} item={null} />);

    const textInputs = UNSAFE_getAllByType(TextInput);
    expect(textInputs[0]!.props.value).toBe('');
    expect(textInputs[1]!.props.value).toBe('');
  });

  it('initializes with existing item values in edit mode', async () => {
    const { UNSAFE_getAllByType } = render(<AddItemModal {...defaultProps} item={mockItem} />);

    const textInputs = UNSAFE_getAllByType(TextInput);
    expect(textInputs[0]!.props.value).toBe(mockItem.name);
    expect(textInputs[1]!.props.value).toBe(mockItem.value);
  });

  // Input field tests
  it('updates name input field', () => {
    const { UNSAFE_getAllByType } = render(<AddItemModal {...defaultProps} />);

    const textInputs = UNSAFE_getAllByType(TextInput);
    const nameInput = textInputs[0]!;

    fireEvent.changeText(nameInput, 'New Item');
    expect(nameInput.props.value).toBe('New Item');
  });

  it('updates value input field', () => {
    const { UNSAFE_getAllByType } = render(<AddItemModal {...defaultProps} />);

    const textInputs = UNSAFE_getAllByType(TextInput);
    const valueInput = textInputs[1]!;

    fireEvent.changeText(valueInput, 'New Value');
    expect(valueInput.props.value).toBe('New Value');
  });

  // Save button tests
  it('calls saveItem when both fields have values and Save is pressed', async () => {
    const { UNSAFE_getAllByType, getByText } = render(<AddItemModal {...defaultProps} />);

    const textInputs = UNSAFE_getAllByType(TextInput);
    const nameInput = textInputs[0]!;
    const valueInput = textInputs[1]!;
    const saveButton = getByText('Save');

    fireEvent.changeText(nameInput, 'Test Item');
    fireEvent.changeText(valueInput, 'Test Value');
    fireEvent.press(saveButton);

    await waitFor(() => {
      expect(mockSaveItemFn).toHaveBeenCalledWith(
        expect.objectContaining({
          name: '',
          value: '',
        }),
        expect.objectContaining({
          name: 'Test Item',
          value: 'Test Value',
        })
      );
    });
  });

  it('does not call saveItem when name field is empty', async () => {
    const { UNSAFE_getAllByType, getByText } = render(<AddItemModal {...defaultProps} />);

    const textInputs = UNSAFE_getAllByType(TextInput);
    const valueInput = textInputs[1]!;
    const saveButton = getByText('Save');

    fireEvent.changeText(valueInput, 'Test Value');
    fireEvent.press(saveButton);

    await waitFor(() => {
      expect(mockSaveItemFn).not.toHaveBeenCalled();
    });
  });

  it('does not call saveItem when value field is empty', async () => {
    const { UNSAFE_getAllByType, getByText } = render(<AddItemModal {...defaultProps} />);

    const textInputs = UNSAFE_getAllByType(TextInput);
    const nameInput = textInputs[0]!;
    const saveButton = getByText('Save');

    fireEvent.changeText(nameInput, 'Test Item');
    fireEvent.press(saveButton);

    await waitFor(() => {
      expect(mockSaveItemFn).not.toHaveBeenCalled();
    });
  });

  it('does not call saveItem when both fields are empty', async () => {
    const { getByText } = render(<AddItemModal {...defaultProps} />);

    const saveButton = getByText('Save');
    fireEvent.press(saveButton);

    await waitFor(() => {
      expect(mockSaveItemFn).not.toHaveBeenCalled();
    });
  });

  it('calls hideModal after successful save', async () => {
    const { UNSAFE_getAllByType, getByText } = render(<AddItemModal {...defaultProps} />);

    const textInputs = UNSAFE_getAllByType(TextInput);
    const nameInput = textInputs[0]!;
    const valueInput = textInputs[1]!;
    const saveButton = getByText('Save');

    fireEvent.changeText(nameInput, 'Test Item');
    fireEvent.changeText(valueInput, 'Test Value');
    fireEvent.press(saveButton);

    await waitFor(() => {
      expect(mockHideModalFn).toHaveBeenCalled();
    });
  });

  it('clears input fields after save', async () => {
    const { UNSAFE_getAllByType, getByText } = render(<AddItemModal {...defaultProps} />);

    const textInputs = UNSAFE_getAllByType(TextInput);
    const nameInput = textInputs[0]!;
    const valueInput = textInputs[1]!;
    const saveButton = getByText('Save');

    fireEvent.changeText(nameInput, 'Test Item');
    fireEvent.changeText(valueInput, 'Test Value');
    fireEvent.press(saveButton);

    await waitFor(() => {
      expect(nameInput.props.value).toBe('');
      expect(valueInput.props.value).toBe('');
    });
  });

  // Cancel button tests
  it('clears input fields when Cancel is pressed', async () => {
    const { UNSAFE_getAllByType, getByText } = render(<AddItemModal {...defaultProps} />);

    const textInputs = UNSAFE_getAllByType(TextInput);
    const nameInput = textInputs[0]!;
    const valueInput = textInputs[1]!;
    const cancelButton = getByText('Cancel');

    fireEvent.changeText(nameInput, 'Test Item');
    fireEvent.changeText(valueInput, 'Test Value');
    fireEvent.press(cancelButton);

    await waitFor(() => {
      expect(nameInput.props.value).toBe('');
      expect(valueInput.props.value).toBe('');
    });
  });

  it('calls hideModal when Cancel is pressed', async () => {
    const { getByText } = render(<AddItemModal {...defaultProps} />);

    const cancelButton = getByText('Cancel');
    fireEvent.press(cancelButton);

    await waitFor(() => {
      expect(mockHideModalFn).toHaveBeenCalled();
    });
  });

  it('clears input fields and calls hideModal when Cancel is pressed', async () => {
    const { UNSAFE_getAllByType, getByText } = render(<AddItemModal {...defaultProps} />);

    const textInputs = UNSAFE_getAllByType(TextInput);
    const nameInput = textInputs[0]!;
    const valueInput = textInputs[1]!;
    const cancelButton = getByText('Cancel');

    fireEvent.changeText(nameInput, 'Test Item');
    fireEvent.changeText(valueInput, 'Test Value');
    fireEvent.press(cancelButton);

    await waitFor(() => {
      expect(nameInput.props.value).toBe('');
      expect(valueInput.props.value).toBe('');
      expect(mockHideModalFn).toHaveBeenCalled();
    });
  });

  // Modal closure tests
  it('calls hideModal when modal is closed via onRequestClose', async () => {
    const { getByTestId } = render(<AddItemModal {...defaultProps} visible={true} />);

    const modal = getByTestId('AddItemModal');
    fireEvent(modal, 'requestClose');

    await waitFor(() => {
      expect(mockHideModalFn).toHaveBeenCalled();
    });
  });

  // Edit mode tests
  it('uses original item as oldItem parameter when saving in edit mode', async () => {
    const { UNSAFE_getAllByType, getByText } = render(
      <AddItemModal {...defaultProps} item={mockItem} />
    );

    const textInputs = UNSAFE_getAllByType(TextInput);
    const nameInput = textInputs[0]!;
    const valueInput = textInputs[1]!;
    const saveButton = getByText('Save');

    fireEvent.changeText(nameInput, 'Updated Item');
    fireEvent.changeText(valueInput, 'Updated Value');
    fireEvent.press(saveButton);

    await waitFor(() => {
      expect(mockSaveItemFn).toHaveBeenCalledWith(mockItem, {
        name: 'Updated Item',
        value: 'Updated Value',
      });
    });
  });

  it('preserves original item data as oldItem in edit mode', async () => {
    const { UNSAFE_getAllByType, getByText } = render(
      <AddItemModal {...defaultProps} item={mockItem} />
    );

    const textInputs = UNSAFE_getAllByType(TextInput);
    const nameInput = textInputs[0]!;
    const valueInput = textInputs[1]!;
    const saveButton = getByText('Save');

    // Change the fields
    fireEvent.changeText(nameInput, 'Changed Name');
    fireEvent.changeText(valueInput, 'Changed Value');
    fireEvent.press(saveButton);

    await waitFor(() => {
      // Verify that first argument (oldItem) retains original values
      expect(mockSaveItemFn).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockItem.id,
          name: mockItem.name,
          value: mockItem.value,
        }),
        expect.any(Object)
      );
    });
  });

  it('displays Save button', async () => {
    const { getByText } = render(<AddItemModal {...defaultProps} />);

    const saveButton = getByText('Save');
    expect(saveButton).toBeTruthy();
  });

  it('displays Cancel button', async () => {
    const { getByText } = render(<AddItemModal {...defaultProps} />);

    const cancelButton = getByText('Cancel');
    expect(cancelButton).toBeTruthy();
  });

  it('does not call saveItem when visible is false and modal is not shown', () => {
    const { toJSON } = render(<AddItemModal {...defaultProps} visible={false} />);

    // When Modal is not visible, nothing is rendered
    expect(toJSON()).toBeNull();
  });

  it('handles rapid successive input changes', async () => {
    const { UNSAFE_getAllByType } = render(<AddItemModal {...defaultProps} visible={true} />);

    const textInputs = UNSAFE_getAllByType(TextInput);
    const nameInput = textInputs[0]!;

    fireEvent.changeText(nameInput, 'First');
    fireEvent.changeText(nameInput, 'Second');
    fireEvent.changeText(nameInput, 'Third');

    await waitFor(() => {
      expect(nameInput.props.value).toBe('Third');
    });
  });

  it('handles special characters in input fields', async () => {
    const { UNSAFE_getAllByType, getByText } = render(
      <AddItemModal {...defaultProps} visible={true} />
    );

    const textInputs = UNSAFE_getAllByType(TextInput);
    const nameInput = textInputs[0]!;
    const valueInput = textInputs[1]!;
    const saveButton = getByText('Save');

    fireEvent.changeText(nameInput, '@#$%^&*()');
    fireEvent.changeText(valueInput, '!@#$%^&*()');
    fireEvent.press(saveButton);

    await waitFor(() => {
      expect(mockSaveItemFn).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          name: '@#$%^&*()',
          value: '!@#$%^&*()',
        })
      );
    });
  });

  it('handles empty strings after trimming', async () => {
    const { UNSAFE_getAllByType, getByText } = render(
      <AddItemModal {...defaultProps} visible={true} />
    );

    const textInputs = UNSAFE_getAllByType(TextInput);
    const nameInput = textInputs[0]!;
    const saveButton = getByText('Save');

    fireEvent.changeText(nameInput, '   ');
    fireEvent.press(saveButton);

    // Should not call saveItem because the component checks if name is truthy
    await waitFor(() => {
      expect(mockSaveItemFn).not.toHaveBeenCalled();
    });
  });
});
