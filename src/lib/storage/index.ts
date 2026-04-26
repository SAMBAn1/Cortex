import { IdbAdapter } from "./idb-adapter";
import type { StorageAdapter } from "./types";

let _adapter: StorageAdapter | null = null;

export function getStorage(): StorageAdapter {
  if (!_adapter) _adapter = new IdbAdapter();
  return _adapter;
}

export * from "./types";
