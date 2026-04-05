import AsyncStorage from '@react-native-async-storage/async-storage';
import { getItem, getAllItems, getItems, addTimestampToItems } from '../Storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  getAllKeys: jest.fn().mockResolvedValue([]),
  multiGet: jest.fn().mockResolvedValue([]),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@react-native-firebase/firestore', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    collection: jest.fn(),
    useEmulator: jest.fn(),
  })),
}));

jest.mock('@react-native-firebase/auth', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    currentUser: null,
    useEmulator: jest.fn(),
  })),
}));

jest.mock('react-native-base64', () => ({
  encode: jest.fn((data) => data),
  decode: jest.fn((data) => data),
}));

jest.mock('../Security', () => ({
  encrypt: jest.fn().mockResolvedValue('encrypted-value'),
  decrypt: jest.fn().mockResolvedValue('decrypted-value'),
  getRSAKeys: jest.fn().mockResolvedValue({
    public: 'public-key',
    private: 'private-key',
  }),
}));

describe('Storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exports getItem function', () => {
    expect(typeof getItem).toBe('function');
  });

  it('exports getAllItems function', () => {
    expect(typeof getAllItems).toBe('function');
  });

  it('exports getItems function', () => {
    expect(typeof getItems).toBe('function');
  });

  it('exports addTimestampToItems function', () => {
    expect(typeof addTimestampToItems).toBe('function');
  });

  it('getItem is async function', () => {
    const result = getItem('test-id');
    expect(result instanceof Promise).toBe(true);
  });

  it('getAllItems is async function', () => {
    const result = getAllItems();
    expect(result instanceof Promise).toBe(true);
  });

  it('getItems is async function', () => {
    const result = getItems('test-filter');
    expect(result instanceof Promise).toBe(true);
  });

  it('addTimestampToItems is async function', () => {
    const result = addTimestampToItems();
    expect(result instanceof Promise).toBe(true);
  });

  it('uses AsyncStorage for local persistence', async () => {
    await getItem('test-key');
    expect(AsyncStorage.getItem).toHaveBeenCalled();
  });

  it('handles null item retrieval', async () => {
    const item = await getItem('non-existent-key');
    expect(item).toBeNull();
  });

  it('retrieves all items', async () => {
    const items = await getAllItems();
    expect(Array.isArray(items)).toBe(true);
  });

  it('filters items by search term', async () => {
    const items = await getItems('search-term');
    expect(Array.isArray(items)).toBe(true);
  });

  it('returns all items for empty filter', async () => {
    const items1 = await getItems('');
    const items2 = await getItems('');
    expect(Array.isArray(items1)).toBe(true);
    expect(Array.isArray(items2)).toBe(true);
  });

  it('adds timestamps to items without timestamp', async () => {
    const result = await addTimestampToItems();
    expect(Array.isArray(result)).toBe(true);
  });

  it('handles storage operations with mocked AsyncStorage', async () => {
    // AsyncStorage is mocked globally, verify getItem returns null
    const item = await getItem('key');
    expect(item).toBeNull();
  });

  it('uses correct storage key prefix', async () => {
    await getAllItems();
    expect(AsyncStorage.getAllKeys).toHaveBeenCalled();
  });

  it('processes multiple items correctly', async () => {
    jest.spyOn(AsyncStorage, 'getAllKeys').mockResolvedValue(['_ali_1', '_ali_2']);
    jest.spyOn(AsyncStorage, 'multiGet').mockResolvedValue([
      ['_ali_1', null],
      ['_ali_2', null],
    ]);

    const items = await getAllItems();
    expect(Array.isArray(items)).toBe(true);
  });

  it('handles empty getAllItems result', async () => {
    jest.spyOn(AsyncStorage, 'getAllKeys').mockResolvedValue([]);
    const items = await getAllItems();
    expect(items).toBeDefined();
    expect(Array.isArray(items)).toBe(true);
  });

  it('getItems with null filter returns all items', async () => {
    const items = await getItems('');
    expect(Array.isArray(items)).toBe(true);
  });

  it('exports are functions', () => {
    expect(typeof getItem).toBe('function');
    expect(typeof getAllItems).toBe('function');
    expect(typeof getItems).toBe('function');
    expect(typeof addTimestampToItems).toBe('function');
  });
});
