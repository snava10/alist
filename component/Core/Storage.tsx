import AListItem from "../AListItem";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BackupCadence, MembershipType, UserSettings } from "./DataModel";
import firestore from "@react-native-firebase/firestore";

const userSettings = firestore().collection("UserSettings");
const decode = (str: string): string =>
  Buffer.from(str, "base64").toString("binary");
const encode = (str: string): string =>
  Buffer.from(str, "binary").toString("base64");

export async function getItem(id: string): Promise<AListItem | null> {
  const value = await AsyncStorage.getItem(id);
  if (value === null) {
    return null;
  }
  var res: AListItem | null = null;
  try {
    res = JSON.parse(value) as AListItem;
  } catch (e) {
    console.log(e);
  }
  return res;
}

export async function addTimestampToItems(
  items: Array<AListItem>
): Promise<void[]> {
  console.log("Add timestamp to items");
  return Promise.all(
    items.map((item) => {
      return replaceItem(item, {
        name: item.name,
        value: item.value,
        timestamp: Date.now(),
      });
    })
  );
}

export async function getAllItems(): Promise<Array<AListItem>> {
  const keys = await AsyncStorage.getAllKeys();
  const kvp = await AsyncStorage.multiGet(
    keys.filter((k) => k.startsWith("_ali_"))
  );
  return kvp
    .filter((kvp) => kvp[1] !== null)
    .map((kvp) => JSON.parse(kvp[1] as string) as AListItem);
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
  return kvp
    .filter((kvp) => kvp[1] !== null)
    .map((kvp) => JSON.parse(kvp[1] as string) as AListItem);
}

export async function saveItem(item: AListItem) {
  await AsyncStorage.setItem("_ali_" + item.name, JSON.stringify(item));
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
  const keys = await AsyncStorage.getAllKeys();
  return keys.length;
}

export async function getUserSettings(
  userId?: string
): Promise<UserSettings | null> {
  return firestore()
    .collection("UserSettings")
    .where("userId", "==", userId)
    .get()
    .then((querySnapshot) => {
      if (querySnapshot.empty) return null;
      return querySnapshot.docs[0].data() as UserSettings;
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
    .add(defaultSettings)
    .then(() => defaultSettings);
}

const compareItems = (a: AListItem, b: AListItem) =>
  a.name.localeCompare(b.name);

export async function syncData(userId: string): Promise<void> {
  const lastSync = parseInt((await AsyncStorage.getItem("lastSync")) ?? "0");
  console.log("Last sync ", lastSync);
  const twentyFourHoursInMillis = 24 * 60 * 60 * 1000;
  if (Date.now() - lastSync < twentyFourHoursInMillis) {
    return;
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

  console.log("Merge Items ", JSON.stringify(mergedItems));
  return Promise.all(
    mergedItems.map(async (item) => {
      await replaceItem(item, item);
      await pushItem(item, userId);
    })
  ).then(() => {
    AsyncStorage.setItem("lastSync", Date.now().toString());
  });
}

export async function pushItem(item: AListItem, userId: string) {
  firestore()
    .collection("Items")
    .doc(`${userId}_${item.name}`)
    .set({ ...item, userId })
    .then(() => console.log("Item saved to firebase ", JSON.stringify(item)));
}

export async function pullItems(userId: string): Promise<Array<AListItem>> {
  return firestore()
    .collection("Items")
    .where("userId", "==", userId)
    .get()
    .then((querySnapshot) => {
      if (querySnapshot.empty) return [];
      return querySnapshot.docs.map((d) => d.data() as AListItem);
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