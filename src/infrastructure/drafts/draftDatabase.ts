export const draftDatabaseVersion = 2;
export const draftDatabaseStores = ["drafts", "operations", "manualResendReceipts", "manualResendClaims"] as const;
export type DraftDatabaseStore = typeof draftDatabaseStores[number];

export function upgradeDraftDatabase(database: IDBDatabase): void {
  for (const name of draftDatabaseStores) {
    if (!database.objectStoreNames.contains(name)) database.createObjectStore(name);
  }
}

export function validateDraftDatabase(database: IDBDatabase): void {
  for (const name of draftDatabaseStores) {
    if (!database.objectStoreNames.contains(name)) throw new Error("Missing draft database store");
    const transaction = database.transaction(name);
    if (transaction.objectStore(name).keyPath !== null) throw new Error("Invalid draft database store");
  }
}
