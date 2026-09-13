import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { currentUser } from "@/server/session";
import { submitKyc } from "@/server/kyc";

/**
 * Submit a KYC application: identity details + the four uploaded documents
 * (already stored via /api/kyc/upload). The raw ID number is sent once over
 * HTTPS and immediately masked + hashed server-side — it is never stored raw.
 */
const TYPE_MAP: Record<string, "id_front" | "id_back" | "selfie" | "proof_of_address"> = {
  "id-front": "id_front",
  "id-back": "id_back",
  selfie: "selfie",
  "proof-of-address": "proof_of_address",
};

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const idType = typeof body?.idType === "string" ? body.idType : "";
  const idNumber = typeof body?.idNumber === "string" ? body.idNumber : "";
  const dateOfBirth = typeof body?.dateOfBirth === "string" ? body.dateOfBirth : "";
  const residentialAddress = typeof body?.residentialAddress === "string" ? body.residentialAddress.trim() : "";
  const rawDocs: unknown[] = Array.isArray(body?.documents) ? body.documents : [];

  if (idNumber.trim().length < 4) {
    return NextResponse.json({ error: "Enter your document number." }, { status: 400 });
  }
  if (!dateOfBirth) {
    return NextResponse.json({ error: "Select your date of birth." }, { status: 400 });
  }
  if (residentialAddress.length < 3) {
    return NextResponse.json({ error: "Enter your residential address." }, { status: 400 });
  }

  const documents = rawDocs
    .map((raw) => {
      const d = (raw ?? {}) as Record<string, unknown>;
      return {
        type: TYPE_MAP[String(d.type)],
        storageKey: typeof d.storageKey === "string" ? d.storageKey : "",
        fileName: typeof d.fileName === "string" ? d.fileName : "document",
        fileSize: Number(d.fileSize) || 0,
        contentType: typeof d.contentType === "string" ? d.contentType : "application/octet-stream",
      };
    })
    .filter((d): d is { type: NonNullable<typeof d.type>; storageKey: string; fileName: string; fileSize: number; contentType: string } => Boolean(d.type && d.storageKey));

  // De-duplicate by type (keep the last upload of each).
  const byType = new Map(documents.map((d) => [d.type, d]));
  const finalDocs = [...byType.values()];

  if (finalDocs.length < 4) {
    return NextResponse.json({ error: "All four documents are required." }, { status: 400 });
  }

  const result = await submitKyc(getDb(), {
    userId: user.id,
    idType,
    idNumber,
    dateOfBirth,
    residentialAddress,
    documents: finalDocs,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json({ ok: true, status: "pending" });
}
