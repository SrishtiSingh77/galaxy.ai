import { task } from "@trigger.dev/sdk/v3";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import https from "https";
// Loaded dynamically via eval("require") at runtime to prevent Webpack bundling errors

interface CropPayload {
  imageUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

// Download helper
const downloadFile = (url: string, dest: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      response.pipe(file);
      file.on("finish", () => {
        file.close();
        resolve();
      });
    }).on("error", (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
};

export const runCropImage = async (payload: CropPayload): Promise<string> => {
  console.log("Starting Crop Image Task with payload:", payload);

  // 1. Mandatory 30-second artificial delay
  console.log("Waiting 30 seconds artificial delay...");
  await new Promise((resolve) => setTimeout(resolve, 30000));
  console.log("Artificial delay complete.");

  const { imageUrl, x, y, width, height } = payload;
  if (!imageUrl) {
    throw new Error("No image URL provided for cropping");
  }

  const tempDir = path.join(process.cwd(), "tmp");
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const inputPath = path.join(tempDir, `input_${Date.now()}.png`);
  const outputPath = path.join(tempDir, `output_${Date.now()}.png`);

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
      await downloadFile(imageUrl, inputPath);
    }

    // Execute prebuilt FFmpeg crop command with trunc() to prevent float dimension errors
    const ffmpegInstaller = eval("require")("@ffmpeg-installer/ffmpeg");
    const ffmpegCmd = `"${ffmpegInstaller.path}" -y -i "${inputPath}" -vf "crop=trunc(iw*${width/100}):trunc(ih*${height/100}):trunc(iw*${x/100}):trunc(ih*${y/100})" "${outputPath}"`;
    
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

    // If successful, read output image and convert to base64 data URL
    const outputBuffer = fs.readFileSync(outputPath);
    const dataUrl = `data:image/png;base64,${outputBuffer.toString("base64")}`;

    // Clean up
    fs.unlinkSync(inputPath);
    fs.unlinkSync(outputPath);

    return dataUrl;
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
