import { create } from "zustand";
import { uid } from "../lib/cn";

export interface Toast {
  id: string;
  message: string;
  kind: "info" | "success" | "error";
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastState {
  toasts: Toast[];
  push: (t: Omit<Toast, "id">) => void;
  dismiss: (id: string) => void;
}

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: (t) => {
    const toast: Toast = { ...t, id: uid("t") };
    set(s => ({ toasts: [...s.toasts, toast] }));
    setTimeout(() => {
      set(s => ({ toasts: s.toasts.filter(x => x.id !== toast.id) }));
    }, 4500);
  },
  dismiss: (id) => set(s => ({ toasts: s.toasts.filter(x => x.id !== id) })),
}));
