import { get } from "@vercel/blob";
import { isAdminAuthed } from "@/server/adminAuth";

/**
 * Stream a private KYC document to an authenticated admin reviewer.
 *
 * The documents are stored PRIVATE in Vercel Blob, so they can't be linked to
 * directly — only this proxy, gated by the admin session, can read them (using
 * the store's read-write token). Restricted to the `kyc/` prefix so it can
 * never be used to read arbitrary blobs.
 */
export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!(await isAdminAuthed())) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return new Response("Document storage isn't configured.", { status: 503 });
  }

  const path = new URL(req.url).searchParams.get("path") ?? "";
  if (!path.startsWith("kyc/")) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const result = await get(path, { access: "private" });
    if (!result || result.statusCode !== 200) {
      return new Response("Not found", { status: 404 });
    }
    const contentType = result.headers.get("content-type") ?? "application/octet-stream";
    return new Response(result.stream, {
      status: 200,
      headers: {
        "content-type": contentType,
        "cache-control": "private, no-store",
        "content-disposition": "inline",
      },
    });
  } catch (err) {
    console.error("[admin/kyc/doc] failed:", err instanceof Error ? err.message : err);
    return new Response("Could not load document.", { status: 502 });
  }
}
