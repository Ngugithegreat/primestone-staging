"use client";

import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";

const TOPICS = [
  "General enquiry",
  "Help with my account",
  "Deposits & withdrawals",
  "Becoming a strategy provider",
  "Partnerships & press",
  "Complaint",
];

export function ContactForm() {
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    topic: TOPICS[0]!,
    message: "",
  });
  const [error, setError] = useState<string>();

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setError(undefined);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.name.trim().length < 2) return setError("Please enter your name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email))
      return setError("Please enter a valid email address.");
    if (form.message.trim().length < 10)
      return setError("Please add a little more detail to your message.");
    setSent(true);
  };

  if (sent) {
    return (
      <div className="grid place-items-center rounded-xl border border-mint-500/25 bg-mint-500/[0.06] px-6 py-12 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-full border border-mint-500/30 bg-mint-500/15">
          <CheckCircle2 className="h-6 w-6 text-mint-400" />
        </div>
        <p className="mt-4 text-[15px] font-semibold text-white">Message sent</p>
        <p className="mt-1.5 max-w-sm text-[13.5px] text-slate-400">
          Thanks {form.name.split(" ")[0]} — we have your message and will reply to{" "}
          {form.email} within one business day.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" htmlFor="c-name">
          <Input
            id="c-name"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Amara Okafor"
            autoComplete="name"
          />
        </Field>
        <Field label="Email" htmlFor="c-email">
          <Input
            id="c-email"
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </Field>
      </div>

      <Field label="What is this about?" htmlFor="c-topic">
        <Select id="c-topic" value={form.topic} onChange={(e) => set("topic", e.target.value)}>
          {TOPICS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Message" error={error} htmlFor="c-message">
        <Textarea
          id="c-message"
          value={form.message}
          onChange={(e) => set("message", e.target.value)}
          placeholder="How can we help?"
          rows={5}
        />
      </Field>

      <Button type="submit" className="w-full">
        Send message
      </Button>
    </form>
  );
}
