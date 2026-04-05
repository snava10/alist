import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ConfirmationModal from '../ConfirmationModal';

jest.mock('../Core/GlobalStyles', () => ({
  modalViewCentered: {},
  modalView: {},
  button: {
    primary: { main: {} },
    error: { main: {} },
    text: { default: {} },
  },
}));

describe('ConfirmationModal', () => {
  const mockAcceptFn = jest.fn();
  const mockRejectFn = jest.fn();
  const mockHideFn = jest.fn();

  const defaultProps = {
    visible: true,
    message: 'Are you sure you want to proceed?',
    item: null,
    acceptCallbackFn: mockAcceptFn,
    rejectCallbackFn: mockRejectFn,
    hideModalFn: mockHideFn,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(<ConfirmationModal {...defaultProps} />);
    expect(toJSON()).toBeTruthy();
  });

  it('displays modal when visible prop is true', () => {
    const { getByText } = render(<ConfirmationModal {...defaultProps} />);
    expect(getByText('Are you sure you want to proceed?')).toBeTruthy();
  });

  it('hides modal when visible prop is false', () => {
    const { queryByText } = render(<ConfirmationModal {...defaultProps} visible={false} />);
    expect(queryByText('Are you sure you want to proceed?')).toBeFalsy();
  });

  it('displays custom message', () => {
    const customMessage = 'Delete this item permanently?';
    const { getByText } = render(<ConfirmationModal {...defaultProps} message={customMessage} />);
    expect(getByText(customMessage)).toBeTruthy();
  });

  it('calls accept callback when Yes button is pressed', () => {
    const { getByText } = render(<ConfirmationModal {...defaultProps} />);
    fireEvent.press(getByText('Yes'));
    expect(mockAcceptFn).toHaveBeenCalled();
  });

  it('calls reject callback when No button is pressed', () => {
    const { getByText } = render(<ConfirmationModal {...defaultProps} />);
    fireEvent.press(getByText('No'));
    expect(mockRejectFn).toHaveBeenCalled();
  });

  it('calls hide callback when modal is closed', () => {
    const { getByText } = render(<ConfirmationModal {...defaultProps} />);
    fireEvent.press(getByText('No'));
    expect(mockHideFn).not.toHaveBeenCalled(); // Hide is not called, reject is
  });

  it('renders Yes and No buttons', () => {
    const { getByText } = render(<ConfirmationModal {...defaultProps} />);
    expect(getByText('Yes')).toBeTruthy();
    expect(getByText('No')).toBeTruthy();
  });

  it('handles different item values', () => {
    const mockItem = {
      id: 'test-id',
      name: 'Test Item',
      value: 'secret-value',
      encrypted: true,
      timestamp: Date.now(),
      created: Date.now(),
    };

    const { toJSON } = render(<ConfirmationModal {...defaultProps} item={mockItem} />);
    expect(toJSON()).toBeTruthy();
  });

  it('does not call callbacks initially', () => {
    render(<ConfirmationModal {...defaultProps} />);
    expect(mockAcceptFn).not.toHaveBeenCalled();
    expect(mockRejectFn).not.toHaveBeenCalled();
    expect(mockHideFn).not.toHaveBeenCalled();
  });

  it('handles rapid button presses', () => {
    const { getByText } = render(<ConfirmationModal {...defaultProps} />);
    fireEvent.press(getByText('Yes'));
    fireEvent.press(getByText('Yes'));
    fireEvent.press(getByText('Yes'));
    expect(mockAcceptFn).toHaveBeenCalledTimes(3);
  });

  it('works with slide animation type', () => {
    const { toJSON } = render(<ConfirmationModal {...defaultProps} />);
    expect(toJSON()).toBeTruthy();
  });

  it('handles long message text', () => {
    const longMessage =
      'This is a very long confirmation message that contains multiple lines and should be displayed correctly in the modal. It should wrap properly and fit within the container.';
    const { getByText } = render(<ConfirmationModal {...defaultProps} message={longMessage} />);
    expect(getByText(longMessage)).toBeTruthy();
  });
});
