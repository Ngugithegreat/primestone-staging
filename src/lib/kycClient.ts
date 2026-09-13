"use client";

import type { KycDocType, KycStatus } from "./kyc";

/** Client wrappers for the real KYC API (upload → submit → status). */

export type UploadedDoc = {
  type: KycDocType;
  storageKey: string;
  fileName: string;
  fileSize: number;
  contentType: string;
};

export type KycStatusResponse = {
  status: KycStatus;
  profile: {
    idType: string;
    idNumberMasked: string;
    dateOfBirth: string;
    residentialAddress: string;
    submittedAt: string | null;
    reviewedAt: string | null;
    rejectionReason: string | null;
  } | null;
  documents: { type: string; fileName: string }[];
};

/** Upload a single document to secure storage; returns its storage reference. */
export async function uploadKycDoc(
  type: KycDocType,
  file: File,
): Promise<{ ok: true; doc: UploadedDoc } | { ok: false; error: string }> {
  const form = new FormData();
  form.append("file", file);
  form.append("type", type);
  try {
    const res = await fetch("/api/kyc/upload", { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error ?? "Upload failed." };
    return {
      ok: true,
      doc: {
        type,
        storageKey: data.storageKey,
        fileName: data.fileName,
        fileSize: data.fileSize,
        contentType: data.contentType,
      },
    };
  } catch {
    return { ok: false, error: "Network error during upload." };
  }
}

export async function submitKycApplication(input: {
  idType: string;
  idNumber: string;
  dateOfBirth: string;
  residentialAddress: string;
  documents: UploadedDoc[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/kyc/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error ?? "Submission failed." };
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error. Please try again." };
  }
}

export async function fetchKycStatus(): Promise<KycStatusResponse | null> {
  try {
    const res = await fetch("/api/kyc/status", { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as KycStatusResponse;
  } catch {
    return null;
  }
}
