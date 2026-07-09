import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { saveBuffer, extFromMime } from "@/lib/storage";

// Saves an upload to local disk (/public/uploads) and returns its URL.
// Keeps flaky client uploads and base64 blobs out of the app entirely.
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
    const url = await saveBuffer(buffer, extFromMime(file.type || ""));

    return NextResponse.json({ url });
  } catch (error: any) {
    console.error("POST /api/upload error:", error);
    return NextResponse.json(
      { error: error?.message || "Upload failed" },
      { status: 500 }
    );
  }
}
