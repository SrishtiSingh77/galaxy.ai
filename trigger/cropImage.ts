import { task } from "@trigger.dev/sdk/v3";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import https from "https";
import http from "http";
import { saveBuffer } from "@/lib/storage";
// Loaded dynamically via eval("require") at runtime to prevent Webpack bundling errors

interface CropPayload {
  imageUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

// Download helper — validates status, follows redirects, verifies non-empty output.
// A fresh Transloadit CDN URL can briefly 302/404 until it propagates; without
// these checks the redirect/error body was written to disk and FFmpeg choked on it.
const downloadFile = (url: string, dest: string, redirects = 0): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (redirects > 5) {
      reject(new Error("Too many redirects while downloading image"));
      return;
    }
    const client = url.startsWith("http:") ? http : https;
    client
      .get(url, (response) => {
        const status = response.statusCode || 0;

        // Follow redirects
        if (status >= 300 && status < 400 && response.headers.location) {
          response.resume(); // drain
          const nextUrl = new URL(response.headers.location, url).toString();
          resolve(downloadFile(nextUrl, dest, redirects + 1));
          return;
        }

        // Reject anything that isn't a success — triggers retry/fallback instead
        // of writing an error page to disk
        if (status !== 200) {
          response.resume();
          reject(new Error(`Download failed: HTTP ${status} for ${url}`));
          return;
        }

        const file = fs.createWriteStream(dest);
        response.pipe(file);
        file.on("finish", () => {
          file.close(() => {
            try {
              if (fs.statSync(dest).size < 10) {
                reject(new Error("Downloaded image is empty"));
                return;
              }
              resolve();
            } catch (e) {
              reject(e as Error);
            }
          });
        });
        file.on("error", (err) => {
          fs.unlink(dest, () => {});
          reject(err);
        });
      })
      .on("error", (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
  });
};

// Retry the download a few times with backoff — a just-uploaded CDN asset can
// take a moment to become fetchable (the cause of "crops only after 3-4 tries").
const downloadWithRetry = async (url: string, dest: string, attempts = 4): Promise<void> => {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      await downloadFile(url, dest);
      return;
    } catch (e) {
      lastErr = e;
      console.warn(`Image download attempt ${i + 1}/${attempts} failed:`, (e as Error).message);
      await new Promise((r) => setTimeout(r, 700 * (i + 1)));
    }
  }
  throw lastErr;
};

export const runCropImage = async (payload: CropPayload): Promise<string> => {
  console.log("Starting Crop Image Task with payload:", payload);

  const { imageUrl, x, y, width, height } = payload;
  if (!imageUrl) {
    throw new Error("No image URL provided for cropping");
  }

  // Clamp so the crop rectangle stays inside the image (offset + size <= 100).
  // Otherwise FFmpeg errors ("crop area out of bounds") and returns uncropped.
  const safeX = Math.max(0, Math.min(99, x));
  const safeY = Math.max(0, Math.min(99, y));
  const safeWidth = Math.max(1, Math.min(100 - safeX, width));
  const safeHeight = Math.max(1, Math.min(100 - safeY, height));

  const tempDir = path.join(process.cwd(), "tmp");
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  // Unique per-invocation names so concurrent crop nodes don't clobber each other's temp files
  const uid = `${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
  const inputPath = path.join(tempDir, `input_${uid}.png`);
  const outputPath = path.join(tempDir, `output_${uid}.png`);

  try {
    if (imageUrl.startsWith("data:image")) {
      console.log("Data URL image received. Decoding base64...");
      const commaIndex = imageUrl.indexOf(",");
      if (commaIndex !== -1) {
        const base64Data = imageUrl.substring(commaIndex + 1);
        const buffer = Buffer.from(base64Data, "base64");
        fs.writeFileSync(inputPath, buffer);
      } else {
        throw new Error("Invalid base64 data URL format");
      }
    } else {
      console.log("Remote URL image received. Downloading image to temp path:", inputPath);
      await downloadWithRetry(imageUrl, inputPath);
    }

    // Execute prebuilt FFmpeg crop command with trunc() to prevent float dimension errors
    const ffmpegInstaller = eval("require")("@ffmpeg-installer/ffmpeg");
    const ffmpegCmd = `"${ffmpegInstaller.path}" -y -i "${inputPath}" -vf "crop=trunc(iw*${safeWidth/100}):trunc(ih*${safeHeight/100}):trunc(iw*${safeX/100}):trunc(ih*${safeY/100})" "${outputPath}"`;
    
    console.log("Executing ffmpeg command:", ffmpegCmd);
    await new Promise<void>((resolve, reject) => {
      exec(ffmpegCmd, (error, stdout, stderr) => {
        if (error) {
          console.warn("FFmpeg execution failed:", error);
          reject(error);
        } else {
          resolve();
        }
      });
    });

    // Save the cropped result (Cloudinary in prod, disk in dev) and return its URL
    const resultUrl = await saveBuffer(fs.readFileSync(outputPath), "png");
    console.log("Cropped image saved:", resultUrl);

    // Clean up
    fs.unlinkSync(inputPath);
    fs.unlinkSync(outputPath);

    return resultUrl;
  } catch (err) {
    console.error("FFmpeg cropping failed. Returning source image as fallback.", err);
    // Clean up if files exist
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    return imageUrl; // Fallback
  }
};

export const cropImageTask = task({
  id: "crop-image",
  run: async (payload: CropPayload) => {
    return runCropImage(payload);
  },
});
