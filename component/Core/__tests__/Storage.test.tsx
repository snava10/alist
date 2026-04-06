import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getItem,
  getAllItems,
  getItems,
  addTimestampToItems,
  replaceItem,
  getItemsCount,
  createUserSettings,
  pullItems,
  deleteItems,
  restoreFromBackup,
} from '../Storage';
import { decrypt } from '../Security';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  getAllKeys: jest.fn().mockResolvedValue([]),
  multiGet: jest.fn().mockResolvedValue([]),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
  clear: jest.fn().mockResolvedValue(undefined),
}));

const mockDocGet = jest.fn().mockResolvedValue({ exists: false, data: () => undefined });
const mockDocSet = jest.fn().mockResolvedValue(undefined);
const mockWhereGet = jest.fn().mockResolvedValue({ empty: true, docs: [] });

jest.mock('@react-native-firebase/firestore', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: mockDocGet,
        set: mockDocSet,
      })),
      where: jest.fn(() => ({
        get: mockWhereGet,
      })),
    })),
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
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([]);
    (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([]);
    mockDocGet.mockResolvedValue({ exists: false, data: () => undefined });
    mockDocSet.mockResolvedValue(undefined);
    mockWhereGet.mockResolvedValue({ empty: true, docs: [] });
  });

  it('getItem parses stored JSON and returns item', async () => {
    const storedItem = { name: 'test', value: 'hello', timestamp: 1, encrypted: false };
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(storedItem));

    const result = await getItem('_ali_test');
    expect(result).not.toBeNull();
    expect(result?.name).toBe('test');
    // Non-encrypted items trigger saveItem (which encrypts them)
    expect(AsyncStorage.setItem).toHaveBeenCalled();
  });

  it('getItem decrypts encrypted items', async () => {
    const storedItem = { name: 'secret', value: 'enc-data', timestamp: 1, encrypted: true };
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(storedItem));

    const result = await getItem('_ali_secret');
    expect(result).not.toBeNull();
    expect(decrypt).toHaveBeenCalledWith('enc-data');
    expect(result?.value).toBe('decrypted-value');
  });

  it('replaceItem removes old and saves new item', async () => {
    const oldItem = { name: 'old', value: 'v1', timestamp: 1, encrypted: false };
    const newItem = { name: 'new', value: 'v2', timestamp: 0, encrypted: false };

    await replaceItem(oldItem, newItem);

    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('_ali_old');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('_ali_new', expect.any(String));
  });

  it('getItemsCount returns count of ali-prefixed keys', async () => {
    (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue(['_ali_a', '_ali_b', 'other']);

    const count = await getItemsCount();
    expect(count).toBe(2);
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
    const item1 = { name: 'apple', value: 'v1', timestamp: 1, encrypted: false };
    const item2 = { name: 'banana', value: 'v2', timestamp: 2, encrypted: false };
    (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue(['_ali_apple', '_ali_banana']);
    (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([['_ali_apple', JSON.stringify(item1)]]);

    const items = await getItems('apple');
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('apple');
  });

  it('returns all items for empty filter', async () => {
    const items1 = await getItems('');
    const items2 = await getItems('');
    expect(Array.isArray(items1)).toBe(true);
    expect(Array.isArray(items2)).toBe(true);
  });

  it('adds timestamps to items without timestamp', async () => {
    const item = { name: 'notime', value: 'v', encrypted: false };
    (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue(['_ali_notime']);
    (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([['_ali_notime', JSON.stringify(item)]]);

    const result = await addTimestampToItems();
    expect(result).toHaveLength(1);
    // replaceItem calls removeItem then saveItem
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('_ali_notime');
    expect(AsyncStorage.setItem).toHaveBeenCalled();
  });

  it('handles storage operations with invalid JSON', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('not-valid-json');
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

  it('handles empty results across operations', async () => {
    (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([]);
    const items = await getAllItems();
    expect(items).toBeDefined();
    expect(items).toHaveLength(0);

    // Empty firestore results
    const pulled = await pullItems('no-user');
    expect(pulled).toHaveLength(0);
    const deleted = await deleteItems('no-user');
    expect(deleted).toBe(0);
  });

  it('createUserSettings creates defaults for new user', async () => {
    mockDocGet.mockResolvedValue({ data: () => undefined });
    mockDocSet.mockResolvedValue(undefined);

    const settings = await createUserSettings('user123');
    expect(settings.userId).toBe('user123');
    expect(mockDocSet).toHaveBeenCalled();
  });

  it('createUserSettings returns existing settings', async () => {
    const existing = { userId: 'user123', backup: 'daily', membership: 'free' };
    mockDocGet.mockResolvedValue({ data: () => existing });

    const settings = await createUserSettings('user123');
    expect(settings).toEqual(existing);
    expect(mockDocSet).not.toHaveBeenCalled();
  });

  it('pullItems retrieves items from firestore', async () => {
    mockWhereGet.mockResolvedValue({
      empty: false,
      docs: [{ data: () => ({ name: 'item1', value: 'val1', encrypted: false, userId: 'u1' }) }],
    });

    const items = await pullItems('u1');
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('item1');
  });

  it('deleteItems removes items from firestore', async () => {
    const mockRefDelete = jest
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('fail'));
    mockWhereGet.mockResolvedValue({
      empty: false,
      docs: [{ ref: { delete: mockRefDelete } }, { ref: { delete: mockRefDelete } }],
    });

    const count = await deleteItems('u1');
    // First succeeds (1), second fails (0)
    expect(count).toBe(1);
    expect(mockRefDelete).toHaveBeenCalledTimes(2);
  });

  it('restoreFromBackup clears storage and restores items', async () => {
    mockWhereGet.mockResolvedValue({
      empty: false,
      docs: [
        { data: () => ({ name: 'item1', value: 'val1', encrypted: true, userId: 'u1' }) },
        { data: () => ({ name: 'item2', value: 'val2', encrypted: false, userId: 'u1' }) },
      ],
    });

    const count = await restoreFromBackup('u1');
    expect(count).toBe(2);
    expect(AsyncStorage.clear).toHaveBeenCalled();
  });
});
