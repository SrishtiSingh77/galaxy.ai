import fs from "fs";
import path from "path";
import { v2 as cloudinary } from "cloudinary";

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

// Persist a buffer and return its public URL. Uses Cloudinary in production
// (when configured), falling back to local disk for dev. Never stores base64.
export const saveBuffer = async (buffer: Buffer, ext: string): Promise<string> => {
  if (CLOUDINARY_CONFIGURED) {
    return uploadToCloudinary(buffer);
  }
  return saveToDisk(buffer, ext);
};
