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

// Poll a Transloadit assembly until it completes, then resolve its result URL
const pollAssembly = (
  assemblyUrl: string,
  resolve: (url: string) => void,
  reject: (err: Error) => void,
  attempts = 0
): void => {
  if (attempts > 40) {
    reject(new Error("Transloadit assembly timed out"));
    return;
  }
  https
    .get(assemblyUrl, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => {
        try {
          const json = JSON.parse(raw);
          if (json.ok === "ASSEMBLY_COMPLETED") {
            const results = json.results || {};
            // Prefer an explicit export step, then any encode step, then the original
            const firstStep = Object.keys(results).find((k) => k !== ":original");
            const url =
              results.export?.[0]?.ssl_url ||
              (firstStep && results[firstStep]?.[0]?.ssl_url) ||
              results[":original"]?.[0]?.ssl_url;
            if (url) {
              resolve(url);
            } else {
              reject(new Error("Transloadit assembly returned no result URL"));
            }
          } else if (json.error) {
            reject(new Error(`Transloadit error: ${json.error}`));
          } else {
            // Still uploading / executing — keep polling
            setTimeout(() => pollAssembly(assemblyUrl, resolve, reject, attempts + 1), 1500);
          }
        } catch (e) {
          reject(e as Error);
        }
      });
    })
    .on("error", reject);
};

// Upload a local file to Transloadit and return its CDN (ssl_url).
// Uses the same public auth key + template the client uploader uses.
const uploadToTransloadit = (filePath: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const authKey = process.env.NEXT_PUBLIC_TRANSLOADIT_AUTH_KEY || "srish011";
    const templateId =
      process.env.NEXT_PUBLIC_TRANSLOADIT_TEMPLATE_ID || "b11d22eefc3b42ab9a9685710e74b9f9";
    const params = JSON.stringify({ auth: { key: authKey }, template_id: templateId });

    const fileBuffer = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    const boundary = `----galaxyaiCrop${Date.now()}`;

    const preamble = Buffer.from(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="params"\r\n\r\n${params}\r\n` +
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
        `Content-Type: image/png\r\n\r\n`
    );
    const epilogue = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([preamble, fileBuffer, epilogue]);

    const req = https.request(
      {
        method: "POST",
        hostname: "api2.transloadit.com",
        path: "/assemblies",
        headers: {
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
          "Content-Length": body.length,
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => {
          try {
            const json = JSON.parse(raw);
            if (json.error) {
              reject(new Error(`Transloadit error: ${json.error} ${json.message || ""}`));
              return;
            }
            const assemblyUrl = json.assembly_ssl_url || json.assembly_url;
            if (!assemblyUrl) {
              reject(new Error("Transloadit did not return an assembly URL"));
              return;
            }
            pollAssembly(assemblyUrl, resolve, reject);
          } catch (e) {
            reject(e as Error);
          }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
};

export const runCropImage = async (payload: CropPayload): Promise<string> => {
  console.log("Starting Crop Image Task with payload:", payload);

  const { imageUrl, x, y, width, height } = payload;
  if (!imageUrl) {
    throw new Error("No image URL provided for cropping");
  }

  const safeX = Math.max(0, Math.min(100, x));
  const safeY = Math.max(0, Math.min(100, y));
  const safeWidth = Math.max(1, Math.min(100, width));
  const safeHeight = Math.max(1, Math.min(100, height));

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

    // Upload the cropped result to the Transloadit CDN and return its URL.
    // Fall back to an inline base64 data URL if the upload fails.
    let resultUrl: string;
    try {
      resultUrl = await uploadToTransloadit(outputPath);
      console.log("Cropped image uploaded to Transloadit CDN:", resultUrl);
    } catch (uploadErr) {
      console.error("Transloadit upload failed, falling back to base64 data URL.", uploadErr);
      const outputBuffer = fs.readFileSync(outputPath);
      resultUrl = `data:image/png;base64,${outputBuffer.toString("base64")}`;
    }

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
