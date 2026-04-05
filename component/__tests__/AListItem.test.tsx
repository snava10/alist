/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import AListItem from '../AListItem';

// Mock expo-clipboard
jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(),
}));

// Mock Ionicons
jest.mock('@expo/vector-icons/Ionicons', () => {
  return function MockIonicons(props: any) {
    return null;
  };
});

import * as Clipboard from 'expo-clipboard';

describe('AListItem', () => {
  const mockItem = {
    name: 'API Key',
    value: 'secret-key-12345',
    timestamp: 1609459200,
    userId: 'user-123',
    encrypted: false,
  };

  const mockRemoveItem = jest.fn();
  const mockEditItem = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(
      <AListItem item={mockItem} removeItem={mockRemoveItem} editItem={mockEditItem} />
    );
    expect(toJSON()).toBeTruthy();
  });

  it('displays item value and name', () => {
    const { getByText } = render(
      <AListItem item={mockItem} removeItem={mockRemoveItem} editItem={mockEditItem} />
    );

    expect(getByText(mockItem.value)).toBeTruthy();
    expect(getByText(mockItem.name)).toBeTruthy();
  });

  it('copies item value to clipboard when pressed', async () => {
    (Clipboard.setStringAsync as jest.Mock).mockResolvedValue(undefined);

    const { getByText } = render(
      <AListItem item={mockItem} removeItem={mockRemoveItem} editItem={mockEditItem} />
    );

    const valueText = getByText(mockItem.value);
    fireEvent.press(valueText);

    await waitFor(() => {
      expect(Clipboard.setStringAsync).toHaveBeenCalledWith(mockItem.value);
    });
  });

  it('shows "Copied" feedback after copying to clipboard', async () => {
    (Clipboard.setStringAsync as jest.Mock).mockResolvedValue(undefined);

    const { getByText, queryByText } = render(
      <AListItem item={mockItem} removeItem={mockRemoveItem} editItem={mockEditItem} />
    );

    const valueText = getByText(mockItem.value);
    fireEvent.press(valueText);

    await waitFor(() => {
      expect(getByText('Copied')).toBeTruthy();
    });

    // Value should not be visible when copied
    expect(queryByText(mockItem.value)).toBeFalsy();
  });

  it('hides "Copied" feedback after 1 second', async () => {
    (Clipboard.setStringAsync as jest.Mock).mockResolvedValue(undefined);

    const { getByText, queryByText } = render(
      <AListItem item={mockItem} removeItem={mockRemoveItem} editItem={mockEditItem} />
    );

    const valueText = getByText(mockItem.value);
    fireEvent.press(valueText);

    await waitFor(() => {
      expect(getByText('Copied')).toBeTruthy();
    });

    // Fast-forward time by 1 second
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(queryByText('Copied')).toBeFalsy();
      expect(getByText(mockItem.value)).toBeTruthy();
    });
  });

  it('calls editItem callback when edit icon is pressed', async () => {
    const { root } = render(
      <AListItem item={mockItem} removeItem={mockRemoveItem} editItem={mockEditItem} />
    );

    // Find and press the edit icon (first Ionicons element for create-outline)
    const editButton = root.findByProps({ name: 'create-outline' });
    fireEvent.press(editButton);

    expect(mockEditItem).toHaveBeenCalledWith(mockItem);
  });

  it('calls removeItem callback when delete icon is pressed', async () => {
    const { root } = render(
      <AListItem item={mockItem} removeItem={mockRemoveItem} editItem={mockEditItem} />
    );

    // Find and press the delete icon (trash-outline)
    const deleteButton = root.findByProps({ name: 'trash-outline' });
    fireEvent.press(deleteButton);

    expect(mockRemoveItem).toHaveBeenCalledWith(mockItem);
  });

  it('handles encrypted items', () => {
    const encryptedItem = { ...mockItem, encrypted: true };
    const { toJSON } = render(
      <AListItem item={encryptedItem} removeItem={mockRemoveItem} editItem={mockEditItem} />
    );

    expect(toJSON()).toBeTruthy();
  });

  it('displays different items on re-render', () => {
    const item1 = { ...mockItem, name: 'Item 1', value: 'value-1' };
    const item2 = { ...mockItem, name: 'Item 2', value: 'value-2' };

    const { getByText, rerender } = render(
      <AListItem item={item1} removeItem={mockRemoveItem} editItem={mockEditItem} />
    );

    expect(getByText('Item 1')).toBeTruthy();
    expect(getByText('value-1')).toBeTruthy();

    rerender(<AListItem item={item2} removeItem={mockRemoveItem} editItem={mockEditItem} />);

    expect(getByText('Item 2')).toBeTruthy();
    expect(getByText('value-2')).toBeTruthy();
  });

  it('handles rapid copy button presses', async () => {
    (Clipboard.setStringAsync as jest.Mock).mockResolvedValue(undefined);

    const { getByText, queryByText } = render(
      <AListItem item={mockItem} removeItem={mockRemoveItem} editItem={mockEditItem} />
    );

    const valueText = getByText(mockItem.value);

    // First press
    fireEvent.press(valueText);
    await waitFor(() => {
      expect(getByText('Copied')).toBeTruthy();
    });

    // Advance time by 500ms (half of the timeout)
    act(() => {
      jest.advanceTimersByTime(500);
    });

    // Second press while still showing "Copied"
    fireEvent.press(queryByText('Copied') || valueText);

    // Should still show "Copied" with updated timer
    await waitFor(() => {
      expect(getByText('Copied')).toBeTruthy();
    });

    // Advance another 1100ms to exceed the second timeout
    act(() => {
      jest.advanceTimersByTime(1100);
    });

    await waitFor(() => {
      expect(queryByText('Copied')).toBeFalsy();
    });
  });
});
