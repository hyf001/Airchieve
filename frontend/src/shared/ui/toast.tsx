import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

type ToastTone = "default" | "success" | "error";

interface ToastMessage {
  id: number;
  text: string;
  tone: ToastTone;
}

interface ToastContextValue {
  showToast: (text: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = useCallback((text: string, tone: ToastTone = "default") => {
    const id = Date.now();
    setToast({ id, text, tone });
    window.setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current));
    }, 2200);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "pointer-events-none fixed left-1/2 z-[200] rounded-full px-[18px] py-3 text-sm font-bold text-white shadow-[0_8px_30px_rgba(61,44,44,0.24)] transition-all duration-200",
          toast ? "bottom-7 translate-x-[-50%] opacity-100" : "bottom-2 translate-x-[-50%] opacity-0",
          toast?.tone === "success" && "bg-[var(--sage-deep)]",
          toast?.tone === "error" && "bg-destructive",
          (!toast || toast.tone === "default") && "bg-[var(--text-dark)]",
        )}
      >
        {toast?.text}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return context;
};
