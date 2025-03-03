export enum BackupCadence {
  NONE = "NONE",
  DAILY = "DAILY",
  INSTANT = "INSTANT",
}

export enum MembershipType {
  FREE = "FREE",
  PREMIUM = "PREMIUM",
}

export type UserSettings = {
  userId: string;
  backup: BackupCadence;
  membership: MembershipType;
};

export type HomeTabParamList = {
  Home: { itemsReload?: number }; // Define the Home screen params
};
