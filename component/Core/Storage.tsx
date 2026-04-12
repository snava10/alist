import AsyncStorage from '@react-native-async-storage/async-storage';
import { BackupCadence, MembershipType, UserSettings, AListItem } from './DataModel';
import firestore from '@react-native-firebase/firestore';
import base64 from 'react-native-base64';
import { EXPO_PUBLIC_FIREBASE_EMULATOR } from '@env';
import auth from '@react-native-firebase/auth';
import { Platform } from 'react-native';
import { decrypt, encrypt } from './Security';
import { validateUserSettings, validateFirestoreItem } from './Contracts';

if (EXPO_PUBLIC_FIREBASE_EMULATOR === 'true') {
  console.debug('Connecting to firebase emulator');
  if (Platform.OS === 'android') {
    console.debug('Operating System ', Platform.OS);
    firestore().useEmulator('10.0.2.2', 8080);
    auth().useEmulator('http://10.0.2.2:9099');
  } else {
    console.debug('Operating System ', Platform.OS);
    firestore().useEmulator('127.0.0.1', 8080);
    auth().useEmulator('http://127.0.0.1:9099');
  }
}

export async function getItem(id: string): Promise<AListItem | null> {
  const value = await AsyncStorage.getItem(id);
  if (value === null) {
    return null;
  }
  var res: AListItem | null = null;
  try {
    console.log('Value ', value);
    res = await maybeDecrypt(JSON.parse(value) as AListItem);
  } catch (e) {
    console.error(e);
  }
  return res;
}

export async function addTimestampToItems(): Promise<void[]> {
  return Promise.all(
    (await getAllItems())
      .filter((item) => !item.timestamp)
      .map((item) => {
        return replaceItem(item, { ...item, timestamp: Date.now() });
      })
  );
}

export async function getAllItems(): Promise<Array<AListItem>> {
  const keys = await AsyncStorage.getAllKeys();
  const kvp = await AsyncStorage.multiGet(keys.filter((k) => k.startsWith('_ali_')));
  return Promise.all(
    kvp
      .filter((kvp) => kvp[1] !== null)
      .map((kvp) => {
        console.log('Item ', kvp[1]);
        return maybeDecrypt(JSON.parse(kvp[1] as string) as AListItem);
      })
  );
}

export async function getItems(filter: string): Promise<Array<AListItem>> {
  if (filter === '' || filter === null) {
    return getAllItems();
  }
  const keys = await AsyncStorage.getAllKeys();
  const kvp = await AsyncStorage.multiGet(
    keys.filter(
      (k) => k.startsWith('_ali_') && k.substring(5).toLowerCase().includes(filter.toLowerCase())
    )
  );
  return Promise.all(
    kvp
      .filter((kvp) => kvp[1] !== null)
      .map((kvp) => {
        return maybeDecrypt(JSON.parse(kvp[1] as string) as AListItem);
      })
  );
}

async function maybeDecrypt(item: AListItem): Promise<AListItem> {
  if (item.encrypted) {
    return decrypt(item.value).then((value) => {
      const res = { ...item, value: value };
      return res;
    });
  } else {
    console.debug('Item not encrypted ', JSON.stringify(item));
    saveItem(item);
  }
  return item;
}

/**
 * Saves an item to the local storage. The item should be unencrypted,
 * this function will encrypt it before saving it.
 * @param item AListItem to save
 */
export async function saveItem(item: AListItem) {
  const res = { ...item, encrypted: true };
  res.value = await encrypt(item.value);
  await AsyncStorage.setItem('_ali_' + item.name, JSON.stringify(res));
}

export async function replaceItem(old: AListItem, newItem: AListItem, timestamp: boolean = true) {
  await removeItem(old);
  if (timestamp) {
    newItem.timestamp = Date.now();
  }
  await saveItem(newItem);
}

export async function removeItem(item: AListItem) {
  if (item) {
    await AsyncStorage.removeItem('_ali_' + item.name);
  }
}

export async function getItemsCount(): Promise<number> {
  const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith('_ali_'));
  return keys.length;
}

export async function getUserSettings(userId?: string): Promise<UserSettings | null> {
  return firestore()
    .collection('UserSettings')
    .doc(userId)
    .get()
    .then((doc) => {
      const data = doc.data();
      if (!data) return null;
      return validateUserSettings(data);
    });
}

export async function createUserSettings(userId: string): Promise<UserSettings> {
  const userSettings = await getUserSettings(userId);
  if (userSettings) return userSettings;
  const defaultSettings = {
    userId,
    backup: BackupCadence.DAILY,
    membership: MembershipType.FREE,
  } as UserSettings;
  const validated = validateUserSettings(defaultSettings);
  return firestore()
    .collection('UserSettings')
    .doc(userId)
    .set(validated)
    .then(() => validated);
}

const _compareItems = (a: AListItem, b: AListItem) => a.name.localeCompare(b.name);

// export async function pushItem(item: AListItem, userId: string) {
//   const encodedValue = base64.encode(item.value);
//   firestore()
//     .collection("Items")
//     .doc(`${userId}_${item.name}`)
//     .set({ ...item, userId, value: encodedValue })
//     .then(() => console.log("Item saved to firebase ", JSON.stringify(item)));
// }

export async function pullItems(userId: string): Promise<Array<AListItem>> {
  console.log('Pulling items for user ', userId);
  return firestore()
    .collection('Items')
    .where('userId', '==', userId)
    .get()
    .then((querySnapshot) => {
      if (querySnapshot.empty) return [];
      return querySnapshot.docs.map((d) => {
        const raw = validateFirestoreItem(d.data());
        console.log('Item pulled from firebase ', JSON.stringify(raw));
        const item: AListItem = {
          name: raw.name,
          value: base64.decode(raw.value),
          timestamp: raw.timestamp,
          userId: raw.userId,
          ...(raw.encrypted !== undefined && { encrypted: raw.encrypted }),
        };
        return item;
      });
    });
}

export async function deleteItems(userId: string): Promise<number> {
  return firestore()
    .collection('Items')
    .where('userId', '==', userId)
    .get()
    .then((querySnapshot) => {
      if (querySnapshot.empty) return [];
      return querySnapshot.docs;
    })
    .then((docs) =>
      Promise.all(
        docs.map((doc) =>
          doc.ref
            .delete()
            .then(() => 1)
            .catch(() => 0)
        )
      )
    )
    .then((result) => result.reduce((a, b) => a + b, 0));
}

export async function restoreFromBackup(userId: string): Promise<number> {
  // Get all items.
  const items = await pullItems(userId);
  console.log('Items pulled from firebase ', JSON.stringify(items));
  await AsyncStorage.clear();
  items.forEach(async (item) => {
    console.log('Restoring item ', JSON.stringify(item));
    if (item.encrypted) {
      console.log('Item is encrypted');
      await AsyncStorage.setItem('_ali_' + item.name, JSON.stringify(item));
    } else {
      console.log('Item is not encrypted');
      await saveItem(item);
    }
  });
  return items.length;
}
