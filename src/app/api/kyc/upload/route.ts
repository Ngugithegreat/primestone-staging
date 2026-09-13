import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { currentUser } from "@/server/session";

/**
 * Upload one KYC document to encrypted object storage (Vercel Blob).
 *
 * The bytes never touch our database — only the returned storage URL and
 * metadata do (persisted later by /api/kyc/submit). The pathname is namespaced
 * per user and given a random suffix so it is unguessable; the URL is only ever
 * surfaced to the owner and to admin-authed reviewers.
 */
export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];
const DOC_TYPES = new Set(["id-front", "id-back", "selfie", "proof-of-address"]);

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Document storage isn't configured yet. Add a Vercel Blob store." },
      { status: 503 },
    );
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const docType = String(form?.get("type") ?? "");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  if (!DOC_TYPES.has(docType)) {
    return NextResponse.json({ error: "Invalid document type." }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "That file is empty." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File is over 8 MB. Please upload a smaller one." }, { status: 400 });
  }
  if (file.type && !ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: "Only JPG, PNG, WebP or PDF are accepted." }, { status: 400 });
  }

  const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
  try {
    // Stored PRIVATE — identity documents must not be readable by URL. They are
    // served only to admin reviewers through /api/admin/kyc/doc. We persist the
    // pathname (not a URL), which that proxy reads back with the store token.
    const blob = await put(`kyc/${user.id}/${docType}.${ext}`, file, {
      access: "private",
      addRandomSuffix: true,
      contentType: file.type || undefined,
    });
    return NextResponse.json({
      ok: true,
      storageKey: blob.pathname,
      fileName: file.name,
      fileSize: file.size,
      contentType: file.type || "application/octet-stream",
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown storage error";
    console.error("[kyc/upload] failed:", detail);
    return NextResponse.json(
      { error: "Upload failed. Please try again.", detail },
      { status: 502 },
    );
  }
}
