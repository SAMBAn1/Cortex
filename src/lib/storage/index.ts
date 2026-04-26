import { IdbAdapter } from "./idb-adapter";
import { SupabaseAdapter, getSupabaseConfig } from "./supabase-adapter";
import type { StorageAdapter } from "./types";

let _adapter: StorageAdapter | null = null;
let _supabase: SupabaseAdapter | null = null;

export function getStorage(): StorageAdapter {
  if (_adapter) return _adapter;
  const cfg = getSupabaseConfig();
  if (cfg) {
    _supabase = new SupabaseAdapter(cfg);
    _adapter = _supabase;
  } else {
    _adapter = new IdbAdapter();
  }
  return _adapter;
}

export function getSupabase(): SupabaseAdapter | null {
  // Force initialization
  getStorage();
  return _supabase;
}

export function isCloudMode(): boolean {
  return !!getSupabaseConfig();
}

export * from "./types";
