"use client";

export type UploadQueueStatus = "queued" | "uploading" | "uploaded" | "skipped" | "error";

export interface UploadQueueItem {
  id: string;
  workspaceId: string;
  fingerprint: string;
  name: string;
  size: number;
  type: string;
  lastModified: number;
  status: UploadQueueStatus;
  error: string | null;
  file: File | null;
  createdAt: number;
  updatedAt: number;
}

const DB_NAME = "aura-upload-queue";
const DB_VERSION = 1;
const STORE_NAME = "upload-items";
const WORKSPACE_INDEX = "workspaceId";

function openUploadQueueDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex(WORKSPACE_INDEX, WORKSPACE_INDEX, { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open upload queue."));
  });
}

async function runUploadQueueTransaction<T>(
  mode: IDBTransactionMode,
  runner: (store: IDBObjectStore) => Promise<T> | T,
) {
  const database = await openUploadQueueDb();

  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);

    Promise.resolve(runner(store))
      .then((result) => {
        transaction.oncomplete = () => {
          database.close();
          resolve(result);
        };
        transaction.onerror = () => {
          database.close();
          reject(transaction.error ?? new Error("Upload queue transaction failed."));
        };
      })
      .catch((error) => {
        database.close();
        reject(error);
      });
  });
}

function requestAsPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

function sortQueueItems(items: UploadQueueItem[]) {
  return items.sort((left, right) => left.createdAt - right.createdAt);
}

export async function listUploadQueueItems(workspaceId: string) {
  return runUploadQueueTransaction("readonly", async (store) => {
    const index = store.index(WORKSPACE_INDEX);
    const items = await requestAsPromise(index.getAll(workspaceId));
    return sortQueueItems((items as UploadQueueItem[]) ?? []);
  });
}

export async function enqueueUploadFiles(workspaceId: string, files: File[]) {
  return runUploadQueueTransaction("readwrite", async (store) => {
    const index = store.index(WORKSPACE_INDEX);
    const existing = ((await requestAsPromise(index.getAll(workspaceId))) as UploadQueueItem[]) ?? [];
    const fingerprints = new Set(existing.map((item) => item.fingerprint));
    const addedItems: UploadQueueItem[] = [];

    for (const file of files) {
      const fingerprint = `${file.name}-${file.size}-${file.lastModified}`;
      if (fingerprints.has(fingerprint)) {
        continue;
      }

      const now = Date.now();
      const item: UploadQueueItem = {
        id: crypto.randomUUID(),
        workspaceId,
        fingerprint,
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
        status: "queued",
        error: null,
        file,
        createdAt: now,
        updatedAt: now,
      };

      await requestAsPromise(store.put(item));
      fingerprints.add(fingerprint);
      addedItems.push(item);
    }

    return {
      addedItems,
      duplicateCount: files.length - addedItems.length,
    };
  });
}

export async function updateUploadQueueItem(
  id: string,
  patch: Partial<UploadQueueItem>,
) {
  return runUploadQueueTransaction("readwrite", async (store) => {
    const existing = (await requestAsPromise(store.get(id))) as UploadQueueItem | undefined;
    if (!existing) {
      return null;
    }

    const nextItem: UploadQueueItem = {
      ...existing,
      ...patch,
      updatedAt: Date.now(),
    };

    await requestAsPromise(store.put(nextItem));
    return nextItem;
  });
}

export async function markInterruptedUploadsAsQueued(workspaceId: string) {
  return runUploadQueueTransaction("readwrite", async (store) => {
    const index = store.index(WORKSPACE_INDEX);
    const items = ((await requestAsPromise(index.getAll(workspaceId))) as UploadQueueItem[]) ?? [];

    await Promise.all(
      items.map(async (item) => {
        if (item.status !== "uploading") {
          return;
        }

        await requestAsPromise(
          store.put({
            ...item,
            status: "queued",
            error: "Upload paused. Resume whenever you are ready.",
            updatedAt: Date.now(),
          } satisfies UploadQueueItem),
        );
      }),
    );
  });
}

export async function clearCompletedUploadQueue(workspaceId: string) {
  return runUploadQueueTransaction("readwrite", async (store) => {
    const index = store.index(WORKSPACE_INDEX);
    const items = ((await requestAsPromise(index.getAll(workspaceId))) as UploadQueueItem[]) ?? [];

    await Promise.all(
      items.map(async (item) => {
        if (item.status === "uploaded" || item.status === "skipped") {
          await requestAsPromise(store.delete(item.id));
        }
      }),
    );
  });
}
