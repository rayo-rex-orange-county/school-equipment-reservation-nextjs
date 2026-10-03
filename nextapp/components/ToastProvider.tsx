"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

type ToastKind = "ok" | "bad" | "warn";
type Toast = { id: number; title: string; body?: string; kind: ToastKind };
type ToastFn = (title: string, body?: string, kind?: ToastKind) => void;

const ToastContext = createContext<ToastFn>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const toast = useCallback<ToastFn>((title, body, kind = "ok") => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, title, body, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "bad" ? 7000 : 4800);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-wrap" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            <b>{t.title}</b>
            {t.body && <p>{t.body}</p>}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
