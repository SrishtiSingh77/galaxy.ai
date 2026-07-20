import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { saveBuffer, extFromMime } from "@/lib/storage";

// Browsers occasionally hand over a file with an empty or unhelpful MIME type
// (notably on some mobile pickers). Falling straight through to "bin" then
// produces a .bin upload that Transloadit stores as an opaque blob and Gemini
// vision refuses, so fall back to the filename's own extension first.
const resolveExt = (file: File): string => {
  const fromMime = extFromMime(file.type || "");
  if (fromMime !== "bin") return fromMime;

  const match = /\.([a-z0-9]{2,5})$/i.exec(file.name || "");
  const fromName = match?.[1]?.toLowerCase();
  const known = ["png", "jpg", "jpeg", "webp", "gif", "svg", "mp4", "webm", "mp3", "wav", "ogg", "pdf"];
  if (fromName && known.includes(fromName)) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }
  return "bin";
};

// Saves an upload to the configured CDN (or local disk in dev) and returns its
// URL. Keeps flaky client uploads and base64 blobs out of the app entirely.
export async function POST(request: Request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const form = await request.formData();
    const file = form.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await saveBuffer(buffer, resolveExt(file));

    return NextResponse.json({ url });
  } catch (error: any) {
    console.error("POST /api/upload error:", error);
    return NextResponse.json(
      { error: error?.message || "Upload failed" },
      { status: 500 }
    );
  }
}
