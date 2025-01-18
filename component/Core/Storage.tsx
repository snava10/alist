import AListItem from "../AListItem";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BackupCadence, MembershipType, UserSettings } from "./DataModel";
import firestore from "@react-native-firebase/firestore";
import base64 from "react-native-base64";
import { Platform } from "react-native";
import auth, { FirebaseAuthTypes } from "@react-native-firebase/auth";

export default class Storage {
  private static storageInstance: Storage;
  public static getInstance() {
    if (!this.storageInstance) {
      this.storageInstance = new Storage();
    }
    return this.storageInstance;
  }

  private constructor() {
    if (process.env.EXPO_PUBLIC_FIREBASE_EMULATOR === "true") {
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
    return res;
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
    return kvp
      .filter((kvp) => kvp[1] !== null)
      .map((kvp) => JSON.parse(kvp[1] as string) as AListItem);
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
    return kvp
      .filter((kvp) => kvp[1] !== null)
      .map((kvp) => JSON.parse(kvp[1] as string) as AListItem);
  }

  public async saveItem(item: AListItem, userId: string) {
    await AsyncStorage.setItem("_ali_" + item.name, JSON.stringify(item));
    this.syncData(userId).then((items) =>
      console.log(`Items synced: ${items.length}`)
    );
  }

  public async replaceItem(
    old: AListItem,
    newItem: AListItem,
    userId: string,
    timestamp: boolean = true
  ) {
    await this.removeItem(old);
    if (timestamp) {
      newItem.timestamp = Date.now();
    }
    await this.saveItem(newItem, userId);
  }

  public async removeItem(item: AListItem) {
    if (item) {
      await AsyncStorage.removeItem("_ali_" + item.name);
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
    const lastSync = parseInt((await AsyncStorage.getItem("lastSync")) ?? "0");
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
    }

    return Promise.all(
      mergedItems.map(async (item) => {
        await this.replaceItem(item, item);
        await this.pushItem(item, userId);
      })
    ).then(() => {
      AsyncStorage.setItem("lastSync", Date.now().toString());
      return mergedItems;
    });
  }

  public async pushItem(item: AListItem, userId: string) {
    const encodedValue = base64.encode(item.value);
    firestore()
      .collection("Items")
      .doc(`${userId}_${item.name}`)
      .set({ ...item, userId, value: encodedValue })
      .then(() => console.log("Item saved to firebase ", JSON.stringify(item)));
  }

  public async pullItems(userId: string): Promise<Array<AListItem>> {
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
