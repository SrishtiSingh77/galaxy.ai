import { task } from "@trigger.dev/sdk/v3";
import { GoogleGenAI } from "@google/genai";
import https from "https";
import http from "http";

interface GeminiPayload {
  modelName: string;
  prompt: string;
  systemPrompt?: string;
  imageUrls?: string[];
  videoUrl?: string;
  audioUrl?: string;
  fileUrl?: string;
  temperature?: number;
  maxTokens?: number;
}

// Download utility converting URLs to base64 inlineData for Gemini multimodal API.
// Supports both http (local /uploads assets) and https, and follows redirects.
const fetchAssetAsBase64 = (
  url: string,
  redirects = 0
): Promise<{ data: string; mimeType: string }> => {
  return new Promise((resolve, reject) => {
    if (redirects > 5) {
      reject(new Error("Too many redirects fetching asset"));
      return;
    }
    const client = url.startsWith("http:") ? http : https;
    client
      .get(url, (response) => {
        const status = response.statusCode || 0;
        if (status >= 300 && status < 400 && response.headers.location) {
          response.resume();
          const next = new URL(response.headers.location, url).toString();
          resolve(fetchAssetAsBase64(next, redirects + 1));
          return;
        }
        if (status !== 200) {
          response.resume();
          reject(new Error(`Asset fetch failed: HTTP ${status} for ${url}`));
          return;
        }
        const mimeType = response.headers["content-type"] || "image/png";
        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          resolve({ data: Buffer.concat(chunks).toString("base64"), mimeType });
        });
        response.on("error", (err) => reject(err));
      })
      .on("error", (err) => reject(err));
  });
};

export const runGemini = async (payload: GeminiPayload): Promise<string> => {
  console.log("Starting Gemini Task with payload:", payload);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not configured.");
  }

  const {
    modelName,
    prompt,
    systemPrompt,
    imageUrls = [],
    videoUrl,
    audioUrl,
    fileUrl,
    temperature,
    maxTokens,
  } = payload;

  // Explicitly select the Gemini Developer API. This prevents any host-level
  // Vertex AI / OAuth configuration from changing this AI Studio API-key flow.
  const genAI = new GoogleGenAI({ apiKey, vertexai: false });

  // Map model name to current Gemini API models (GA as of 2026).
  // The "*-latest" aliases auto-track the newest release so retired IDs
  // (e.g. 1.5/2.5) never break this path again.
  let apiModel = "gemini-pro-latest"; // Default robust model
  if (modelName.includes("flash")) {
    apiModel = "gemini-3.5-flash";
  } else if (modelName.includes("3.1-pro")) {
    apiModel = "gemini-3.1-pro";
  } else if (modelName.includes("pro")) {
    apiModel = "gemini-pro-latest";
  }

  console.log(`Using Gemini model: ${apiModel}`);

  const parts: any[] = [{ text: prompt }];

  // Process optional assets if they exist
  // Process remote images or base64 images
  for (const imgUrl of imageUrls) {
    if (imgUrl) {
      try {
        if (imgUrl.startsWith("data:image")) {
          const matches = imgUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
          if (matches && matches.length === 3) {
            parts.push({
              inlineData: {
                data: matches[2],
                mimeType: matches[1],
              },
            });
          }
        } else if (imgUrl.startsWith("http")) {
          console.log(`Fetching remote image asset: ${imgUrl}`);
          const asset = await fetchAssetAsBase64(imgUrl);
          parts.push({
            inlineData: {
              data: asset.data,
              mimeType: asset.mimeType,
            },
          });
        }
      } catch (err) {
        console.error(`Failed to fetch image asset from url: ${imgUrl}`, err);
      }
    }
  }

  if (videoUrl && videoUrl.startsWith("http")) {
    try {
      console.log(`Fetching remote video asset: ${videoUrl}`);
      const asset = await fetchAssetAsBase64(videoUrl);
      parts.push({
        inlineData: {
          data: asset.data,
          mimeType: asset.mimeType,
        },
      });
    } catch (err) {
      console.error(`Failed to fetch video asset from url: ${videoUrl}`, err);
    }
  }

  if (audioUrl && audioUrl.startsWith("http")) {
    try {
      console.log(`Fetching remote audio asset: ${audioUrl}`);
      const asset = await fetchAssetAsBase64(audioUrl);
      parts.push({
        inlineData: {
          data: asset.data,
          mimeType: asset.mimeType,
        },
      });
    } catch (err) {
      console.error(`Failed to fetch audio asset from url: ${audioUrl}`, err);
    }
  }

  if (fileUrl && fileUrl.startsWith("http")) {
    try {
      console.log(`Fetching remote file asset: ${fileUrl}`);
      const asset = await fetchAssetAsBase64(fileUrl);
      parts.push({
        inlineData: {
          data: asset.data,
          mimeType: asset.mimeType,
        },
      });
    } catch (err) {
      console.error(`Failed to fetch file asset from url: ${fileUrl}`, err);
    }
  }

  const generationConfig = {
    ...(systemPrompt && { systemInstruction: systemPrompt }),
    ...(temperature !== undefined && { temperature }),
    ...(maxTokens !== undefined && { maxOutputTokens: maxTokens }),
  };

  console.log(`Sending generateContent request to Gemini API with model: ${apiModel}...`);
  let responseResult;
  try {
    responseResult = await genAI.models.generateContent({
      model: apiModel,
      contents: [{ role: "user", parts }],
      config: generationConfig,
    });
  } catch (err: any) {
    const errMsg = err.message || String(err);
    if (errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("404")) {
      console.warn(`Gemini model ${apiModel} failed with quota/version error. Retrying with fallback gemini-flash-latest...`);
      responseResult = await genAI.models.generateContent({
        model: "gemini-flash-latest",
        contents: [{ role: "user", parts }],
        config: generationConfig,
      });
    } else {
      throw err;
    }
  }

  const responseText = responseResult.text ?? "";
  console.log("Gemini API response text received:", responseText);

  return responseText;
};

export const geminiTask = task({
  id: "gemini-llm",
  run: async (payload: GeminiPayload) => {
    return runGemini(payload);
  },
});
