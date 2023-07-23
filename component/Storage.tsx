import AListItem from "./AListItem";
import AsyncStorage from "@react-native-async-storage/async-storage";

export async function getItem(name: string): Promise<AListItem> {
  return { name: "_empty", value: "empty" };
}

export async function getAllItems(): Promise<Array<AListItem>> {
  const keys = await AsyncStorage.getAllKeys();
  const items = Promise.all(
    keys.flatMap(async (k) => {
      const item = await getItem(k);
      return item;
    })
  );
  return items;
}

export async function saveItem(item: AListItem) {
  await AsyncStorage.setItem(item.name, JSON.stringify(item));
}
