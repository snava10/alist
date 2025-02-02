import AListItem from "../AListItem";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BackupCadence, MembershipType, UserSettings } from "./DataModel";
import firestore from "@react-native-firebase/firestore";
import { Platform } from "react-native";
import auth from "@react-native-firebase/auth";
import { encrypt, decrypt } from "./Security";
import { EXPO_PUBLIC_FIREBASE_EMULATOR } from "@env";

export default class Storage {
  private static storageInstance: Storage;
  public static getInstance() {
    if (!this.storageInstance) {
      this.storageInstance = new Storage();
    }
    return this.storageInstance;
  }

  private constructor() {
    if (EXPO_PUBLIC_FIREBASE_EMULATOR === "true") {
      console.log("Connecting to firebase emulator");
      if (Platform.OS === "android") {
        console.log("Operating System ", Platform.OS);
        firestore().useEmulator("10.0.2.2", 8080);
        auth().useEmulator("http://10.0.2.2:9099");
      } else {
        console.log("Operating System ", Platform.OS);
        firestore().useEmulator("127.0.0.1", 8080);
        auth().useEmulator("http://127.0.0.1:9099");
      }
    }
  }

  public async getItem(id: string): Promise<AListItem | null> {
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
    const decryptedItem = { ...(res as AListItem) };
    decryptedItem.value = await decrypt(decryptedItem.value);
    return decryptedItem;
  }

  public async addTimestampToItems(): Promise<void[]> {
    return Promise.all(
      (await this.getAllItems())
        .filter((item) => !item.timestamp)
        .map((item) => {
          return this.replaceItem(item, {
            name: item.name,
            value: item.value,
            timestamp: Date.now(),
          });
        })
    );
  }

  public async getAllItems(): Promise<Array<AListItem>> {
    const keys = await AsyncStorage.getAllKeys();
    const kvp = await AsyncStorage.multiGet(
      keys.filter((k) => k.startsWith("_ali_"))
    );
    return Promise.all(
      kvp
        .filter((kvp) => kvp[1] !== null)
        .map(async (kvp) => {
          const res = JSON.parse(kvp[1] as string) as AListItem;
          const decryptedItem = { ...(res as AListItem) };
          decryptedItem.value = await decrypt(decryptedItem.value);
          return decryptedItem;
        })
    );
  }

  public async getItems(filter: string): Promise<Array<AListItem>> {
    if (filter === "" || filter === null) {
      return this.getAllItems();
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
        .map(async (kvp) => {
          const res = JSON.parse(kvp[1] as string) as AListItem;
          const decryptedItem = { ...(res as AListItem) };
          decryptedItem.value = await decrypt(decryptedItem.value);
          return decryptedItem;
        })
    );
  }

  public async saveItem(item: AListItem, sync: boolean = false) {
    const encryptedItem: AListItem = { ...item };
    encryptedItem.value = await encrypt(item.value);
    await AsyncStorage.setItem(
      "_ali_" + item.name,
      JSON.stringify(encryptedItem)
    );
    if (auth().currentUser && sync) {
      this.pushItem(encryptedItem, auth().currentUser?.uid as string).then(() =>
        console.log(`Item saved: ${item.name}`)
      );
      // const userId = auth().currentUser?.uid as string;
      // this.syncData(userId).then((items) =>
      //   console.log(`Items synced: ${items.length}`)
      // );
    }
  }

  public async replaceItem(
    old: AListItem,
    newItem: AListItem,
    timestamp: boolean = true,
    sync: boolean = true
  ) {
    await this.removeItem(old, sync);
    if (timestamp) {
      newItem.timestamp = Date.now();
    }
    await this.saveItem(newItem, sync);
  }

  public async removeItem(item: AListItem, sync: boolean = true) {
    if (item) {
      await AsyncStorage.removeItem("_ali_" + item.name);
      if (auth().currentUser && sync) {
        await this.deleteItem(item, auth().currentUser?.uid as string)
          .then((count) => console.log(`Items deleted: ${count}`))
          .catch((error) => console.log("Delete item ", error));
      }
    }
  }

  public async getItemsCount(): Promise<number> {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) =>
      k.startsWith("_ali_")
    );
    return keys.length;
  }

  public async getUserSettings(userId?: string): Promise<UserSettings | null> {
    return firestore()
      .collection("UserSettings")
      .doc(userId)
      .get()
      .then((doc) => {
        return doc.data() as UserSettings;
      });
  }

  public async createUserSettings(userId: string): Promise<UserSettings> {
    const userSettings = await this.getUserSettings(userId);
    if (userSettings) return userSettings;
    const defaultSettings = {
      userId,
      backup: BackupCadence.INSTANT,
      membership: MembershipType.FREE,
    } as UserSettings;
    return firestore()
      .collection("UserSettings")
      .doc(userId)
      .set(defaultSettings)
      .then(() => defaultSettings);
  }

  compareItems = (a: AListItem, b: AListItem) => a.name.localeCompare(b.name);

  public async syncData(userId: string): Promise<Array<AListItem>> {
    const userSettings = await this.getUserSettings(userId);
    if (userSettings?.backup === BackupCadence.NONE) {
      return [];
    }
    const localItems = (await this.getAllItems()).sort(this.compareItems);
    const remoteItems = (await this.pullItems(userId)).sort(this.compareItems);
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

      if (this.compareItems(local, remote) < 0) {
        mergedItems.push(local);
        remoteItems.unshift(remote);
      } else if (this.compareItems(local, remote) > 0) {
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
      break;
    }

    return Promise.all(
      mergedItems.map(async (item) => {
        await this.replaceItem(item, item, true, false);
        await this.pushItem(item, userId);
      })
    ).then(() => {
      AsyncStorage.setItem("lastSync", Date.now().toString());
      return mergedItems;
    });
  }

  public async pushItem(item: AListItem, userId: string) {
    firestore()
      .collection("Items")
      .doc(`${userId}_${item.name}`)
      .set({ ...item, userId, value: item.value })
      .then(() => console.log("Item saved to firebase ", JSON.stringify(item)));
  }

  public async pullItems(userId: string): Promise<Array<AListItem>> {
    return firestore()
      .collection("Items")
      .where("userId", "==", userId)
      .get()
      .then((querySnapshot) => {
        if (querySnapshot.empty) return [];
        return Promise.all(
          querySnapshot.docs.map(async (d) => {
            const item = d.data() as AListItem;
            item.value = await decrypt(item.value);
            return item;
          })
        );
      });
  }

  async pullItem(item: AListItem, userId: string): Promise<AListItem> {
    const doc = await firestore()
      .collection("Items")
      .doc(`${userId}_${item.name}`)
      .get();
    return doc.data() as AListItem;
  }

  async syncItem(item: AListItem, userSettings: UserSettings) {
    // Get the item from firestore
    const incoming = firestore().collection("Items").doc();
  }

  async deleteItem(item: AListItem, userId: string): Promise<number> {
    const doc = firestore().collection("Items").doc(`${userId}_${item.name}`);

    return doc
      .delete()
      .then(() => 1)
      .catch(() => 0);
  }

  async deleteItems(userId: string): Promise<number> {
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
}
