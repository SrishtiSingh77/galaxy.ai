import { task } from "@trigger.dev/sdk/v3";
import { GoogleGenerativeAI } from "@google/generative-ai";
import https from "https";

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

// Download utility converting URLs to base64 inlineData for Gemini multimodal API
const fetchAssetAsBase64 = (url: string): Promise<{ data: string; mimeType: string }> => {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      const mimeType = response.headers["content-type"] || "image/png";
      const chunks: Buffer[] = [];

      response.on("data", (chunk) => {
        chunks.push(chunk);
      });

      response.on("end", () => {
        const buffer = Buffer.concat(chunks);
        resolve({
          data: buffer.toString("base64"),
          mimeType,
        });
      });

      response.on("error", (err) => {
        reject(err);
      });
    }).on("error", (err) => {
      reject(err);
    });
  });
};

export const geminiTask = task({
  id: "gemini-llm",
  run: async (payload: GeminiPayload) => {
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

    const genAI = new GoogleGenerativeAI(apiKey);

    // Map model name to Gemini API models
    let apiModel = "gemini-1.5-pro"; // Default robust model
    if (modelName.includes("flash")) {
      apiModel = "gemini-1.5-flash";
    } else if (modelName.includes("1.5-pro")) {
      apiModel = "gemini-1.5-pro";
    } else if (modelName.includes("2.5-pro")) {
      apiModel = "gemini-2.5-pro";
    } else if (modelName.includes("3.1-pro")) {
      apiModel = "gemini-2.5-pro"; // Map gemini-3.1-pro to gemini-2.5-pro or gemini-1.5-pro since 3.1 is the custom name
    }

    console.log(`Using Gemini model: ${apiModel}`);

    const modelInstance = genAI.getGenerativeModel({
      model: apiModel,
      ...(systemPrompt && { systemInstruction: systemPrompt }),
    });

    const contents: any[] = [prompt];

    // Download and attach images (supports multi-image connections)
    for (const url of imageUrls) {
      if (url && url.startsWith("http")) {
        try {
          console.log(`Fetching image asset: ${url}`);
          const asset = await fetchAssetAsBase64(url);
          contents.push({
            inlineData: {
              data: asset.data,
              mimeType: asset.mimeType,
            },
          });
        } catch (err) {
          console.error(`Failed to fetch image asset from url: ${url}`, err);
        }
      }
    }

    // Download and attach video
    if (videoUrl && videoUrl.startsWith("http")) {
      try {
        console.log(`Fetching video asset: ${videoUrl}`);
        const asset = await fetchAssetAsBase64(videoUrl);
        contents.push({
          inlineData: {
            data: asset.data,
            mimeType: asset.mimeType,
          },
        });
      } catch (err) {
        console.error(`Failed to fetch video asset from url: ${videoUrl}`, err);
      }
    }

    // Download and attach audio
    if (audioUrl && audioUrl.startsWith("http")) {
      try {
        console.log(`Fetching audio asset: ${audioUrl}`);
        const asset = await fetchAssetAsBase64(audioUrl);
        contents.push({
          inlineData: {
            data: asset.data,
            mimeType: asset.mimeType,
          },
        });
      } catch (err) {
        console.error(`Failed to fetch audio asset from url: ${audioUrl}`, err);
      }
    }

    // Download and attach generic file
    if (fileUrl && fileUrl.startsWith("http")) {
      try {
        console.log(`Fetching file asset: ${fileUrl}`);
        const asset = await fetchAssetAsBase64(fileUrl);
        contents.push({
          inlineData: {
            data: asset.data,
            mimeType: asset.mimeType,
          },
        });
      } catch (err) {
        console.error(`Failed to fetch file asset from url: ${fileUrl}`, err);
      }
    }

    console.log("Sending generateContent request to Gemini API...");
    const generationConfig = {
      ...(temperature !== undefined && { temperature }),
      ...(maxTokens !== undefined && { maxOutputTokens: maxTokens }),
    };

    const responseResult = await modelInstance.generateContent({
      contents,
      generationConfig,
    });

    const responseText = responseResult.response.text();
    console.log("Gemini API response text received:", responseText);

    return responseText;
  },
});
