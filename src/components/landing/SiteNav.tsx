"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Logo } from "@/components/ui/Logo";
import { ButtonLink } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/#traders", label: "Strategy Providers" },
  { href: "/#how", label: "How it works" },
  { href: "/#accounts", label: "Accounts" },
  { href: "/#platform", label: "Platform" },
  { href: "/#faq", label: "FAQ" },
];

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-90 transition-all duration-300",
        scrolled
          ? "border-b border-white/[0.07] bg-ink-950/80 backdrop-blur-xl"
          : "border-b border-transparent",
      )}
    >
      <nav className="mx-auto flex h-17 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Logo />

        <div className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg px-3.5 py-2 text-[13.5px] font-medium text-slate-300 transition-colors hover:bg-white/[0.05] hover:text-white"
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-2.5 lg:flex">
          <ButtonLink href="/login" variant="ghost" size="sm">
            Sign in
          </ButtonLink>
          <ButtonLink href="/signup" size="sm" className="group">
            Open account
            <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </ButtonLink>
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          className="focus-ring grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-white lg:hidden"
        >
          {open ? <X className="h-4.5 w-4.5" /> : <Menu className="h-4.5 w-4.5" />}
        </button>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t border-white/[0.07] bg-ink-950/97 backdrop-blur-2xl lg:hidden"
          >
            <div className="space-y-1 px-5 py-5">
              {LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between rounded-xl px-3.5 py-3 text-[15px] font-medium text-slate-200 transition-colors hover:bg-white/[0.05]"
                >
                  {l.label}
                  <ChevronRight className="h-4 w-4 text-slate-500" />
                </Link>
              ))}
              <div className="grid gap-2.5 pt-3">
                <ButtonLink href="/login" variant="secondary" onClick={() => setOpen(false)}>
                  Sign in
                </ButtonLink>
                <ButtonLink href="/signup" onClick={() => setOpen(false)}>
                  Open a free account
                </ButtonLink>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
