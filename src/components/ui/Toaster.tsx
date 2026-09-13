"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useStore } from "@/lib/store";

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
} as const;

const TONES = {
  success: "text-mint-400 border-mint-500/25",
  error: "text-rose-400 border-rose-500/25",
  info: "text-iris-300 border-iris-500/25",
} as const;

export function Toaster() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-200 flex w-[min(92vw,360px)] flex-col gap-2.5">
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const Icon = ICONS[t.tone];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 40, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.96 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className={`card-sheen pointer-events-auto flex items-start gap-3 rounded-xl border bg-ink-850/95 p-3.5 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl ${TONES[t.tone]}`}
            >
              <Icon className="mt-0.5 h-[18px] w-[18px] shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-semibold text-white">{t.title}</p>
                {t.body && (
                  <p className="mt-0.5 text-[12.5px] leading-snug text-slate-400">{t.body}</p>
                )}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
                className="shrink-0 text-slate-500 transition-colors hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
