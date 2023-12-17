import AListItem from "../AListItem";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { UserSettings } from "./DataModel";
import firestore from "@react-native-firebase/firestore";

const userSettings = firestore().collection("UserSettings");

export async function getItem(key: string): Promise<AListItem> {
  const value = await AsyncStorage.getItem(key);
  if (value === null) {
    return new Promise(() => null);
  }
  var res: AListItem | null = null;
  try {
    res = JSON.parse(value) as AListItem;
  } catch (e) {
    console.log(e);
  }
  return new Promise(() => {
    return res;
  });
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

export async function replaceItem(old: AListItem, newItem: AListItem) {
  await Promise.all([removeItem(old), saveItem(newItem)]);
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

export async function getUserSettings(userId?: string): Promise<any> {
  return (
    firestore()
      .collection("UserSettings")
      // Filter results
      .where("userId", "==", userId)
      .get()
      .then((querySnapshot) => {
        if (querySnapshot.empty) return null;
        return querySnapshot.docs[0].data();
      })
  );
}

export async function createUserSettings(
  userId: string
): Promise<UserSettings> {
  const userSettings = await getUserSettings(userId);
  return new Promise((resolve, reject) => {});
}
