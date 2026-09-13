import "server-only";
import { createHash } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { auditLog, kycDocuments, kycProfiles, users } from "@/db/schema";

/**
 * KYC.
 *
 * The identity document *files* are uploaded to encrypted object storage
 * (Vercel Blob / S3) by the upload route; here we persist their storage keys
 * and metadata, plus the profile. The raw ID number is never stored — only a
 * display mask and a salted hash.
 *
 * `users.kyc_status_cache` mirrors the profile status so gates (like
 * withdrawals) are a single indexed read, but the profile row is the source of
 * truth.
 */

type DocType = "id_front" | "id_back" | "selfie" | "proof_of_address";

function maskIdNumber(value: string): string {
  const clean = value.replace(/\s+/g, "");
  if (clean.length <= 4) return clean;
  return `${"•".repeat(clean.length - 4)}${clean.slice(-4)}`;
}

function hashIdNumber(value: string): string {
  const salt = process.env.KYC_HASH_SALT ?? "primestone-dev-salt";
  return createHash("sha256").update(`${salt}:${value.replace(/\s+/g, "")}`).digest("hex");
}

export async function submitKyc(
  db: Database,
  input: {
    userId: string;
    idType: string;
    idNumber: string;
    dateOfBirth: string;
    residentialAddress: string;
    documents: {
      type: DocType;
      storageKey: string;
      fileName: string;
      fileSize: number;
      contentType: string;
    }[];
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (input.documents.length < 4) {
    return { ok: false, error: "All four documents are required." };
  }

  await db.transaction(async (tx) => {
    // Upsert the profile back to pending (also covers a rejected re-submission).
    const existing = await tx
      .select({ id: kycProfiles.id })
      .from(kycProfiles)
      .where(eq(kycProfiles.userId, input.userId))
      .limit(1);

    const values = {
      status: "pending" as const,
      idType: input.idType,
      idNumberMasked: maskIdNumber(input.idNumber),
      idNumberHash: hashIdNumber(input.idNumber),
      dateOfBirth: input.dateOfBirth,
      residentialAddress: input.residentialAddress,
      submittedAt: new Date(),
      reviewedAt: null,
      reviewedBy: null,
      rejectionReason: null,
    };

    if (existing[0]) {
      await tx.update(kycProfiles).set(values).where(eq(kycProfiles.userId, input.userId));
    } else {
      await tx.insert(kycProfiles).values({ userId: input.userId, ...values });
    }

    // Replace any previous documents with this submission's set.
    await tx.delete(kycDocuments).where(eq(kycDocuments.userId, input.userId));
    await tx.insert(kycDocuments).values(
      input.documents.map((d) => ({
        userId: input.userId,
        type: d.type,
        storageKey: d.storageKey,
        fileName: d.fileName,
        fileSize: d.fileSize,
        contentType: d.contentType,
      })),
    );

    await tx.update(users).set({ kycStatusCache: "pending" }).where(eq(users.id, input.userId));
  });

  return { ok: true };
}

/** Approve or reject a submission. `reviewerId` must be an admin/owner. */
export async function reviewKyc(
  db: Database,
  input: {
    reviewerId: string;
    userId: string;
    decision: "verified" | "rejected";
    reason?: string;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const [reviewer] = await db.select().from(users).where(eq(users.id, input.reviewerId)).limit(1);
  if (!reviewer || (reviewer.role !== "admin" && reviewer.role !== "owner")) {
    return { ok: false, error: "Not authorised to review KYC." };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(kycProfiles)
      .set({
        status: input.decision,
        reviewedAt: new Date(),
        reviewedBy: input.reviewerId,
        rejectionReason: input.decision === "rejected" ? (input.reason ?? "Not verified.") : null,
      })
      .where(eq(kycProfiles.userId, input.userId));

    await tx
      .update(users)
      .set({ kycStatusCache: input.decision })
      .where(eq(users.id, input.userId));

    await tx.insert(auditLog).values({
      actorId: input.reviewerId,
      action: `kyc.${input.decision}`,
      targetType: "user",
      targetId: input.userId,
      metadata: input.reason ? { reason: input.reason } : null,
    });
  });

  return { ok: true };
}

export async function getKyc(db: Database, userId: string) {
  const [profile] = await db
    .select()
    .from(kycProfiles)
    .where(eq(kycProfiles.userId, userId))
    .limit(1);
  const docs = await db
    .select()
    .from(kycDocuments)
    .where(eq(kycDocuments.userId, userId))
    .orderBy(desc(kycDocuments.uploadedAt));
  return { profile: profile ?? null, documents: docs };
}

/** Everyone currently awaiting a compliance decision. */
export async function listPendingKyc(db: Database) {
  return db
    .select({ user: users, profile: kycProfiles })
    .from(kycProfiles)
    .innerJoin(users, eq(kycProfiles.userId, users.id))
    .where(eq(kycProfiles.status, "pending"))
    .orderBy(desc(kycProfiles.submittedAt));
}
