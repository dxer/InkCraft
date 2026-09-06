"use client";

import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type ToastKind = "error" | "success" | "info";

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

type PushToast = (message: string, kind?: ToastKind) => void;

const ToastContext = createContext<PushToast>(() => {});

/** 工坊页内轻量提示：选题/起草/编审等各环节失败不再静默 */
export function useWorkshopToast(): PushToast {
  return useContext(ToastContext);
}

export function WorkshopToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seqRef = useRef(0);

  const push = useCallback<PushToast>((message, kind = "info") => {
    const id = ++seqRef.current;
    setItems((prev) => [...prev.slice(-2), { id, kind, message }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-5 bottom-5 z-[60] flex w-80 flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-start gap-2 rounded-lg border px-3.5 py-2.5 text-xs shadow-lg backdrop-blur",
              t.kind === "error" && "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
              t.kind === "success" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
              t.kind === "info" && "border-border bg-card/95 text-foreground"
            )}
          >
            {t.kind === "error" ? (
              <XCircle className="mt-0.5 size-3.5 shrink-0" />
            ) : t.kind === "success" ? (
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
            ) : (
              <Info className="mt-0.5 size-3.5 shrink-0" />
            )}
            <span className="flex-1 leading-relaxed">{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="opacity-50 transition-opacity hover:opacity-100">
              <X className="size-3" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
