import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { currentUser } from "@/server/session";
import { getKyc } from "@/server/kyc";

/** The signed-in user's own KYC status + submission summary (server truth). */
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { profile, documents } = await getKyc(getDb(), user.id);
  return NextResponse.json({
    status: profile?.status ?? "unverified",
    profile: profile
      ? {
          idType: profile.idType,
          idNumberMasked: profile.idNumberMasked,
          dateOfBirth: profile.dateOfBirth,
          residentialAddress: profile.residentialAddress,
          submittedAt: profile.submittedAt,
          reviewedAt: profile.reviewedAt,
          rejectionReason: profile.rejectionReason,
        }
      : null,
    documents: documents.map((d) => ({ type: d.type, fileName: d.fileName })),
  });
}
