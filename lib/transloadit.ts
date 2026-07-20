import https from "https";

const AUTH_KEY =
  process.env.TRANSLOADIT_AUTH_KEY || process.env.NEXT_PUBLIC_TRANSLOADIT_AUTH_KEY || "";
const TEMPLATE_ID =
  process.env.TRANSLOADIT_TEMPLATE_ID || process.env.NEXT_PUBLIC_TRANSLOADIT_TEMPLATE_ID || "";

// Transloadit is only usable when BOTH an auth key and a template are present.
// (A missing/invalid key surfaces as GET_ACCOUNT_UNKNOWN_AUTH_KEY at upload time,
// so we gate on config here and let storage.ts fall through to the next provider.)
export const TRANSLOADIT_READY = !!(AUTH_KEY && TEMPLATE_ID);

// Poll a Transloadit assembly until it completes, then resolve its result URL
const pollAssembly = (
  assemblyUrl: string,
  resolve: (url: string) => void,
  reject: (err: Error) => void,
  attempts = 0
): void => {
  if (attempts > 20) {
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
            const firstStep = Object.keys(results).find((k) => k !== ":original");
            const url =
              results.export?.[0]?.ssl_url ||
              (firstStep && results[firstStep]?.[0]?.ssl_url) ||
              results[":original"]?.[0]?.ssl_url;
            if (url) resolve(url);
            else reject(new Error("Transloadit assembly returned no result URL"));
          } else if (json.error) {
            reject(new Error(`Transloadit error: ${json.error}`));
          } else {
            setTimeout(() => pollAssembly(assemblyUrl, resolve, reject, attempts + 1), 1200);
          }
        } catch (e) {
          reject(e as Error);
        }
      });
    })
    .on("error", reject);
};

// Upload a buffer to Transloadit and resolve its CDN (ssl_url). Single attempt.
const uploadOnce = (buffer: Buffer, filename: string, mime: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const params = JSON.stringify({ auth: { key: AUTH_KEY }, template_id: TEMPLATE_ID });
    const boundary = `----galaxyai${Date.now()}${Math.floor(Math.random() * 1e6)}`;
    const preamble = Buffer.from(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="params"\r\n\r\n${params}\r\n` +
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
        `Content-Type: ${mime}\r\n\r\n`
    );
    const epilogue = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([preamble, buffer, epilogue]);

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

// Upload with retry/backoff — makes the CDN upload reliable in one call.
export const uploadBufferToTransloadit = async (
  buffer: Buffer,
  filename: string,
  mime = "application/octet-stream",
  attempts = 3
): Promise<string> => {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await uploadOnce(buffer, filename, mime);
    } catch (e) {
      lastErr = e;
      console.warn(`Transloadit upload attempt ${i + 1}/${attempts} failed:`, (e as Error).message);
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
  throw lastErr;
};
