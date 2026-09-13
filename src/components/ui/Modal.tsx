"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const widths = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-3xl" };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-100 grid place-items-center overflow-y-auto p-4 sm:p-6">
          <motion.div
            className="fixed inset-0 bg-ink-950/80 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            className={cn(
              "card-sheen relative w-full rounded-2xl border border-white/[0.09] bg-ink-880 shadow-[0_40px_120px_-30px_rgba(0,0,0,0.95)]",
              widths[size],
            )}
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] px-5 py-4">
              <div className="min-w-0">
                <h2 className="text-[17px] font-semibold text-white">{title}</h2>
                {subtitle && <p className="mt-0.5 text-[13px] text-slate-400">{subtitle}</p>}
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="focus-ring -mr-1 -mt-1 grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-white/[0.07] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-5 py-5">{children}</div>

            {footer && (
              <div className="flex items-center justify-end gap-3 border-t border-white/[0.06] px-5 py-4">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
