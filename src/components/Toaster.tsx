import { useToasts } from "../store/toast";
import { CheckCircle2, X, Info, AlertCircle } from "lucide-react";
import { cn } from "../lib/cn";

const ICONS = {
  info: Info,
  success: CheckCircle2,
  error: AlertCircle,
};

export default function Toaster() {
  const toasts = useToasts(s => s.toasts);
  const dismiss = useToasts(s => s.dismiss);
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => {
        const Icon = ICONS[t.kind];
        return (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto panel px-3 py-2 flex items-center gap-2 shadow-soft animate-slide-up text-sm min-w-[260px] max-w-sm",
              t.kind === "success" && "border-success/40",
              t.kind === "error" && "border-danger/40",
            )}
          >
            <Icon size={16} className={cn(
              t.kind === "success" && "text-success",
              t.kind === "error" && "text-danger",
              t.kind === "info" && "text-accent",
            )} />
            <div className="flex-1">{t.message}</div>
            {t.actionLabel && (
              <button
                onClick={() => { t.onAction?.(); dismiss(t.id); }}
                className="text-xs px-2 py-1 rounded-md bg-accent text-white hover:opacity-90"
              >{t.actionLabel}</button>
            )}
            <button onClick={() => dismiss(t.id)} className="icon-btn h-6 w-6"><X size={12} /></button>
          </div>
        );
      })}
    </div>
  );
}
