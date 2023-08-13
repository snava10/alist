import AListItem from "./AListItem";
import AsyncStorage from "@react-native-async-storage/async-storage";

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

export async function saveItem(item: AListItem) {
  await AsyncStorage.setItem("_ali_" + item.name, JSON.stringify(item));
}

export async function removeItem(item: AListItem) {
  await AsyncStorage.removeItem("_ali_" + item.name);
}
