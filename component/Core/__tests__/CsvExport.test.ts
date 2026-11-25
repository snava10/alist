import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { getAllItems } from '../Storage';
import { buildCsvContent, exportItemsToCsv } from '../CsvExport';
import type { AListItem } from '../DataModel';

jest.mock('../Storage', () => ({
  getAllItems: jest.fn(),
}));

const mockGetAllItems = getAllItems as jest.Mock;
const mockWrite = FileSystem.writeAsStringAsync as jest.Mock;
const mockSafWrite = FileSystem.StorageAccessFramework.writeAsStringAsync as jest.Mock;
const mockRequestPermissions = FileSystem.StorageAccessFramework
  .requestDirectoryPermissionsAsync as jest.Mock;
const mockCreateFile = FileSystem.StorageAccessFramework.createFileAsync as jest.Mock;

const FIXED_DATE = new Date('2026-11-25T10:20:30.000Z');
const FILE_NAME = 'alist-export-2026-11-25-10-20-30.csv';

describe('buildCsvContent', () => {
  it('writes only the header when there are no items', () => {
    expect(buildCsvContent([])).toBe('key,value\n');
  });

  it('writes one row per item', () => {
    const items: AListItem[] = [
      { name: 'email', value: 'secret-one', timestamp: 1, userId: 'u1' },
      { name: 'bank', value: 'secret-two', timestamp: 2, userId: 'u1' },
    ];

    expect(buildCsvContent(items)).toBe('key,value\nemail,secret-one\nbank,secret-two\n');
  });

  it('quotes fields containing commas, quotes, or newlines and doubles quotes', () => {
    const items: AListItem[] = [
      {
        name: 'weird, "name"',
        value: 'line one\nline "two", done\r\n',
        timestamp: 1,
        userId: 'u1',
      },
    ];

    expect(buildCsvContent(items)).toBe(
      'key,value\n"weird, ""name""","line one\nline ""two"", done\r\n"\n'
    );
  });
});

describe('exportItemsToCsv', () => {
  const originalOs = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    mockWrite.mockResolvedValue(undefined);
    mockSafWrite.mockResolvedValue(undefined);
    mockCreateFile.mockResolvedValue('content://exported-file');
  });

  afterEach(() => {
    (Platform as { OS: string }).OS = originalOs;
  });

  it('writes the CSV to the document directory on iOS', async () => {
    (Platform as { OS: string }).OS = 'ios';
    mockGetAllItems.mockResolvedValue([
      { name: 'email', value: 'secret-one', timestamp: 1, userId: 'u1' },
      { name: 'bank', value: 'secret-two', timestamp: 2, userId: 'u1' },
    ]);

    const result = await exportItemsToCsv('u1', FIXED_DATE);

    expect(mockGetAllItems).toHaveBeenCalledWith('u1');
    expect(result).toEqual({
      fileUri: `file:///documents/${FILE_NAME}`,
      fileName: FILE_NAME,
      exportedCount: 2,
    });
    expect(mockWrite).toHaveBeenCalledWith(
      `file:///documents/${FILE_NAME}`,
      'key,value\nemail,secret-one\nbank,secret-two\n'
    );
    expect(mockRequestPermissions).not.toHaveBeenCalled();
  });

  it('writes a header-only file when there are no items', async () => {
    (Platform as { OS: string }).OS = 'ios';
    mockGetAllItems.mockResolvedValue([]);

    const result = await exportItemsToCsv('u1', FIXED_DATE);

    expect(result.exportedCount).toBe(0);
    expect(mockWrite).toHaveBeenCalledWith(`file:///documents/${FILE_NAME}`, 'key,value\n');
  });

  it('uses the Storage Access Framework folder chosen by the user on Android', async () => {
    (Platform as { OS: string }).OS = 'android';
    mockRequestPermissions.mockResolvedValue({
      granted: true,
      directoryUri: 'content://picked-folder',
    });
    mockGetAllItems.mockResolvedValue([
      { name: 'email', value: 'secret-one', timestamp: 1, userId: 'u1' },
    ]);

    const result = await exportItemsToCsv('u1', FIXED_DATE);

    expect(mockRequestPermissions).toHaveBeenCalled();
    expect(mockCreateFile).toHaveBeenCalledWith(
      'content://picked-folder',
      'alist-export-2026-11-25-10-20-30',
      'text/csv'
    );
    expect(mockSafWrite).toHaveBeenCalledWith(
      'content://exported-file',
      'key,value\nemail,secret-one\n'
    );
    expect(result).toEqual({
      fileUri: 'content://exported-file',
      fileName: FILE_NAME,
      exportedCount: 1,
    });
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it('writes nothing when folder permission is not granted on Android', async () => {
    (Platform as { OS: string }).OS = 'android';
    mockRequestPermissions.mockResolvedValue({ granted: false });
    mockGetAllItems.mockResolvedValue([
      { name: 'email', value: 'secret-one', timestamp: 1, userId: 'u1' },
    ]);

    await expect(exportItemsToCsv('u1', FIXED_DATE)).rejects.toThrow(/permission/i);
    expect(mockCreateFile).not.toHaveBeenCalled();
    expect(mockSafWrite).not.toHaveBeenCalled();
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it('requires a signed-in user and reads no items without one', async () => {
    await expect(exportItemsToCsv('', FIXED_DATE)).rejects.toThrow(/signed-in/);
    expect(mockGetAllItems).not.toHaveBeenCalled();
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it('writes nothing when reading the stored items fails', async () => {
    (Platform as { OS: string }).OS = 'ios';
    mockGetAllItems.mockRejectedValue(new Error('Failed to decrypt value'));

    await expect(exportItemsToCsv('u1', FIXED_DATE)).rejects.toThrow('Failed to decrypt value');
    expect(mockWrite).not.toHaveBeenCalled();
  });
});
