import fs from "fs";
import path from "path";
import https from "https";
import http from "http";
import { v2 as cloudinary } from "cloudinary";
import { uploadBufferToTransloadit, TRANSLOADIT_READY } from "./transloadit";

// Base URL for locally-served assets (dev fallback only)
const BASE_URL = process.env.APP_URL || "http://localhost:3003";
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

const CLOUD_NAME =
  process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

const CLOUDINARY_CONFIGURED = !!(
  CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (CLOUDINARY_CONFIGURED) {
  cloudinary.config({
    cloud_name: CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

// Map a MIME type to a file extension for saved uploads
export const extFromMime = (mime: string): string => {
  const m = (mime || "").toLowerCase();
  if (m.includes("png")) return "png";
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  if (m.includes("webp")) return "webp";
  if (m.includes("gif")) return "gif";
  if (m.includes("svg")) return "svg";
  if (m.includes("mp4")) return "mp4";
  if (m.includes("webm")) return "webm";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  if (m.includes("wav")) return "wav";
  if (m.includes("ogg")) return "ogg";
  if (m.includes("pdf")) return "pdf";
  return "bin";
};

// Upload a buffer to Cloudinary and return its secure CDN URL
const uploadToCloudinary = (buffer: Buffer): Promise<string> =>
  new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        { resource_type: "auto", folder: "galaxyai" },
        (err, result) => {
          if (err || !result) reject(err || new Error("Cloudinary upload failed"));
          else resolve(result.secure_url);
        }
      )
      .end(buffer);
  });

// Save a buffer to local disk (dev fallback) and return its absolute URL
const saveToDisk = (buffer: Buffer, ext: string): string => {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const name = `${Date.now()}_${Math.floor(Math.random() * 1e9)}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buffer);
  return `${BASE_URL}/uploads/${name}`;
};

// Download a remote URL into a Buffer (follows redirects, rejects non-200).
const fetchBuffer = (url: string, redirects = 0): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error("Too many redirects"));
    const client = url.startsWith("http:") ? http : https;
    client
      .get(url, (res) => {
        const status = res.statusCode || 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          resolve(fetchBuffer(new URL(res.headers.location, url).toString(), redirects + 1));
          return;
        }
        if (status !== 200) {
          res.resume();
          return reject(new Error(`Fetch failed: HTTP ${status} for ${url}`));
        }
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c as Buffer));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      })
      .on("error", reject);
  });

// Persist a buffer and return its public CDN URL.
// Provider order: Transloadit (assignment CDN) → Cloudinary → local disk (dev only).
// Never returns base64, blobs, or Buffers.
export const saveBuffer = async (buffer: Buffer, ext: string): Promise<string> => {
  if (TRANSLOADIT_READY) {
    try {
      return await uploadBufferToTransloadit(buffer, `asset.${ext}`, `image/${ext}`);
    } catch (e) {
      console.error("Transloadit upload failed, falling back to Cloudinary:", e);
    }
  }
  if (CLOUDINARY_CONFIGURED) {
    return uploadToCloudinary(buffer);
  }
  return saveToDisk(buffer, ext);
};

// Re-host an already-public URL on the Transloadit CDN so every image output in
// the graph is a Transloadit URL. No-op (returns the input) when Transloadit is
// not configured, so the Cloudinary CDN URL is used instead.
export const publishToCdn = async (url: string, ext = "png"): Promise<string> => {
  if (!TRANSLOADIT_READY || !url || url.startsWith("data:")) return url;
  try {
    const buffer = await fetchBuffer(url);
    return await uploadBufferToTransloadit(buffer, `asset.${ext}`, `image/${ext}`);
  } catch (e) {
    console.error("Transloadit re-host failed, keeping source CDN URL:", e);
    return url;
  }
};

// True when Cloudinary creds are present — crop runs on Cloudinary (serverless-safe)
export const CLOUDINARY_READY = CLOUDINARY_CONFIGURED;

// Crop an image via a Cloudinary transformation (no FFmpeg / no local disk, so it
// works identically in dev and serverless production). x/y/width/height are
// percentages (0-100); Cloudinary takes them as 0-1 fractions of the original.
export const cropImageOnCloudinary = async (
  imageUrl: string,
  region: { x: number; y: number; width: number; height: number }
): Promise<string> => {
  const clampX = Math.max(0, Math.min(99, region.x));
  const clampY = Math.max(0, Math.min(99, region.y));
  const clampW = Math.max(1, Math.min(100 - clampX, region.width));
  const clampH = Math.max(1, Math.min(100 - clampY, region.height));

  const result = await cloudinary.uploader.upload(imageUrl, {
    folder: "galaxyai",
    transformation: [
      {
        crop: "crop",
        width: (clampW / 100).toFixed(4),
        height: (clampH / 100).toFixed(4),
        x: (clampX / 100).toFixed(4),
        y: (clampY / 100).toFixed(4),
      },
    ],
  });
  return result.secure_url;
};
