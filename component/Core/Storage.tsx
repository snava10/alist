import AListItem from "../AListItem";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BackupCadence, MembershipType, UserSettings } from "./DataModel";
import firestore from "@react-native-firebase/firestore";
import base64 from "react-native-base64";
import { EXPO_PUBLIC_ENCRYPTION, EXPO_PUBLIC_FIREBASE_EMULATOR } from "@env";
import auth from "@react-native-firebase/auth";
import { Platform } from "react-native";
import { decrypt, encrypt, getRSAKeys } from "./Security";

if (EXPO_PUBLIC_FIREBASE_EMULATOR === "true") {
  console.debug("Connecting to firebase emulator");
  if (Platform.OS === "android") {
    console.debug("Operating System ", Platform.OS);
    firestore().useEmulator("10.0.2.2", 8080);
    auth().useEmulator("http://10.0.2.2:9099");
  } else {
    console.debug("Operating System ", Platform.OS);
    firestore().useEmulator("127.0.0.1", 8080);
    auth().useEmulator("http://127.0.0.1:9099");
  }
}

export async function getItem(id: string): Promise<AListItem | null> {
  const value = await AsyncStorage.getItem(id);
  if (value === null) {
    return null;
  }
  var res: AListItem | null = null;
  try {
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
  const kvp = await AsyncStorage.multiGet(
    keys.filter((k) => k.startsWith("_ali_"))
  );
  return Promise.all(
    kvp
      .filter((kvp) => kvp[1] !== null)
      .map((kvp) => {
        return maybeDecrypt(JSON.parse(kvp[1] as string) as AListItem);
      })
  );
}

export async function getItems(filter: string): Promise<Array<AListItem>> {
  if (filter === "" || filter === null) {
    return getAllItems();
  }
  const keys = await AsyncStorage.getAllKeys();
  const kvp = await AsyncStorage.multiGet(
    keys.filter(
      (k) =>
        k.startsWith("_ali_") &&
        k.substring(5).toLowerCase().includes(filter.toLowerCase())
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
    console.debug("Item not encrypted ", JSON.stringify(item));
    saveItem(item);
  }
  return item;
}

/**
 * Saves an item to the local storage. The item should be encrypted,
 * this function will encrypt it before saving it.
 * @param item AListItem to save
 */
export async function saveItem(item: AListItem) {
  const res = { ...item, encrypted: true };
  res.value = await encrypt(item.value);
  await AsyncStorage.setItem("_ali_" + item.name, JSON.stringify(res));
}

export async function replaceItem(
  old: AListItem,
  newItem: AListItem,
  timestamp: boolean = true
) {
  await removeItem(old);
  if (timestamp) {
    newItem.timestamp = Date.now();
  }
  await saveItem(newItem);
}

export async function removeItem(item: AListItem) {
  if (item) {
    await AsyncStorage.removeItem("_ali_" + item.name);
  }
}

export async function getItemsCount(): Promise<number> {
  const keys = (await AsyncStorage.getAllKeys()).filter((k) =>
    k.startsWith("_ali_")
  );
  return keys.length;
}

export async function getUserSettings(
  userId?: string
): Promise<UserSettings | null> {
  return firestore()
    .collection("UserSettings")
    .doc(userId)
    .get()
    .then((doc) => {
      return doc.data() as UserSettings;
    });
}

export async function createUserSettings(
  userId: string
): Promise<UserSettings> {
  const userSettings = await getUserSettings(userId);
  if (userSettings) return userSettings;
  const defaultSettings = {
    userId,
    backup: BackupCadence.DAILY,
    membership: MembershipType.FREE,
  } as UserSettings;
  return firestore()
    .collection("UserSettings")
    .doc(userId)
    .set(defaultSettings)
    .then(() => defaultSettings);
}

const compareItems = (a: AListItem, b: AListItem) =>
  a.name.localeCompare(b.name);

export async function syncData(userId: string): Promise<Array<AListItem>> {
  const lastSync = parseInt((await AsyncStorage.getItem("lastSync")) ?? "0");
  const userSettings = await getUserSettings(userId);
  let intervalInMillis = 24 * 60 * 60 * 1000;

  if (userSettings?.backup === BackupCadence.NONE) {
    return [];
  } else if (userSettings?.backup === BackupCadence.INSTANT) {
    intervalInMillis = 0;
  }

  if (Date.now() - lastSync < intervalInMillis) {
    return [];
  }

  const localItems = (await getAllItems()).sort(compareItems);
  const remoteItems = (await pullItems(userId)).sort(compareItems);
  const mergedItems: Array<AListItem> = [];

  while (localItems.length > 0 || remoteItems.length > 0) {
    const local = localItems.shift();
    const remote = remoteItems.shift();
    if (!local) {
      mergedItems.push(remote as AListItem);
      continue;
    }
    if (!remote) {
      mergedItems.push(local as AListItem);
      continue;
    }

    if (compareItems(local, remote) < 0) {
      mergedItems.push(local);
      remoteItems.unshift(remote);
    } else if (compareItems(local, remote) > 0) {
      mergedItems.push(remote);
      localItems.unshift(local);
    } else {
      // The same item. Compare timestamps
      if (local.timestamp > remote.timestamp) {
        mergedItems.push(local);
      } else {
        mergedItems.push(remote);
      }
    }
  }

  return Promise.all(
    mergedItems.map(async (item) => {
      await replaceItem(item, item);
      await pushItem(item, userId);
    })
  ).then(() => {
    AsyncStorage.setItem("lastSync", Date.now().toString());
    return mergedItems;
  });
}

export async function pushItem(item: AListItem, userId: string) {
  const encodedValue = base64.encode(item.value);
  firestore()
    .collection("Items")
    .doc(`${userId}_${item.name}`)
    .set({ ...item, userId, value: encodedValue })
    .then(() => console.log("Item saved to firebase ", JSON.stringify(item)));
}

export async function pullItems(userId: string): Promise<Array<AListItem>> {
  return firestore()
    .collection("Items")
    .where("userId", "==", userId)
    .get()
    .then((querySnapshot) => {
      if (querySnapshot.empty) return [];
      return querySnapshot.docs.map((d) => {
        const item = d.data() as AListItem;
        item.value = base64.decode(item.value);
        return item;
      });
    });
}

export async function pullItem(
  item: AListItem,
  userId: string
): Promise<AListItem> {
  const doc = await firestore()
    .collection("Items")
    .doc(`${userId}_${item.name}`)
    .get();
  return doc.data() as AListItem;
}

export async function syncItem(item: AListItem, userSettings: UserSettings) {
  // Get the item from firestore
  const incoming = firestore().collection("Items").doc();
}

export async function deleteItems(userId: string): Promise<number> {
  return firestore()
    .collection("Items")
    .where("userId", "==", userId)
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
