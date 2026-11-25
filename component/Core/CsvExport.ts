import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { AListItem } from './DataModel';
import { getAllItems } from './Storage';

export type CsvExportResult = {
  fileUri: string;
  fileName: string;
  exportedCount: number;
};

function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildCsvContent(items: AListItem[]): string {
  const rows = items.map((item) => `${escapeCsvField(item.name)},${escapeCsvField(item.value)}`);
  return ['key,value', ...rows].join('\n') + '\n';
}

function buildFileBaseName(now: Date): string {
  return `alist-export-${now.toISOString().slice(0, 19).replace(/[:T]/g, '-')}`;
}

/**
 * Exports the user's currently stored items (Firestore, decrypted on this
 * device by {@link getAllItems}) to a plaintext CSV file in the user's
 * files: the folder the user picks on Android, or the app's document
 * directory (visible in Files) on iOS. The file is left for the user to
 * delete; this function never deletes it. A single undecryptable item
 * fails the export, matching the current behaviour of {@link getAllItems}.
 * Nothing in this module logs item names or values.
 */
export async function exportItemsToCsv(
  userId: string,
  now: Date = new Date()
): Promise<CsvExportResult> {
  if (!userId) {
    throw new Error('exportItemsToCsv requires a signed-in user.');
  }

  const fileBaseName = buildFileBaseName(now);
  const fileName = `${fileBaseName}.csv`;

  let safDirectoryUri: string | null = null;
  if (Platform.OS === 'android') {
    const permission = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!permission.granted) {
      throw new Error(
        'Folder permission was not granted. Choose a folder to save the export file.'
      );
    }
    safDirectoryUri = permission.directoryUri;
  }

  const items = await getAllItems(userId);
  const csv = buildCsvContent(items);

  if (safDirectoryUri !== null) {
    const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
      safDirectoryUri,
      fileBaseName,
      'text/csv'
    );
    await FileSystem.StorageAccessFramework.writeAsStringAsync(fileUri, csv);
    return { fileUri, fileName, exportedCount: items.length };
  }

  const directory = FileSystem.documentDirectory;
  if (!directory) {
    throw new Error('File storage is not available on this device.');
  }
  const fileUri = `${directory}${fileName}`;
  await FileSystem.writeAsStringAsync(fileUri, csv);
  return { fileUri, fileName, exportedCount: items.length };
}
