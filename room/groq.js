// Groq API integration for fallback mode
// Model: Qwen 27B (Groq model identifier: qwen/qwen3.8-27b)

try {
  if (typeof process !== "undefined" && typeof process.loadEnvFile === "function") {
    process.loadEnvFile();
  }
} catch {}

export const GROQ_QWEN_27B_MODEL = "qwen/qwen3.8-27b";
export const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

/**
 * Retrieve the active Groq API key from environment, URL parameters, or local storage.
 */
export function getGroqApiKey() {
  if (typeof process !== "undefined" && process.env?.GROQ_API_KEY) {
    return process.env.GROQ_API_KEY.trim();
  }
  if (typeof window !== "undefined") {
    if (window.groqApiKey && typeof window.groqApiKey === "string") {
      return window.groqApiKey.trim();
    }
    try {
      const urlKey = new URLSearchParams(window.location?.search).get("groq_api_key") ||
                     new URLSearchParams(window.location?.search).get("groq_key");
      if (urlKey) return urlKey.trim();
      const stored = localStorage.getItem("swarm_groq_api_key") || localStorage.getItem("groq_api_key");
      if (stored) return stored.trim();
    } catch {}
  }
  return "";
}

/**
 * Store the Groq API key in memory and local storage.
 */
export function setGroqApiKey(key) {
  const cleanKey = (key || "").trim();
  if (typeof window !== "undefined") {
    window.groqApiKey = cleanKey;
    try {
      if (cleanKey) {
        localStorage.setItem("swarm_groq_api_key", cleanKey);
      } else {
        localStorage.removeItem("swarm_groq_api_key");
      }
    } catch {}
  }
}

/**
 * Asynchronously load environment variables from /env.json and /.env in browser.
 */
export async function loadBrowserEnv() {
  if (typeof window === "undefined") {
    return {
      GROQ_API_KEY: process.env?.GROQ_API_KEY || "",
      FALLBACKMODE: process.env?.FALLBACKMODE === "true" || process.env?.FALLBACKMODE === "1",
    };
  }

  const envData = {};

  // 1. Try env.json
  try {
    const res = await fetch("/env.json?t=" + Date.now());
    if (res.ok) {
      const json = await res.json();
      Object.assign(envData, json);
    }
  } catch {}

  // 2. Try .env
  try {
    const res = await fetch("/.env?t=" + Date.now());
    if (res.ok) {
      const text = await res.text();
      for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx !== -1) {
          const k = trimmed.slice(0, eqIdx).trim();
          let v = trimmed.slice(eqIdx + 1).trim();
          if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
            v = v.slice(1, -1);
          }
          if (v === "true") v = true;
          else if (v === "false") v = false;
          if (envData[k] === undefined) {
            envData[k] = v;
          }
        }
      }
    }
  } catch {}

  if (envData.GROQ_API_KEY) {
    setGroqApiKey(envData.GROQ_API_KEY);
  }

  if (envData.FALLBACKMODE === true || envData.FALLBACKMODE === "true" || envData.FALLBACKMODE === "1") {
    window.fallbackmode = true;
    try { localStorage.setItem("swarm_fallbackmode", "true"); } catch {}
    if (typeof window.toggleFallbackMode === "function") {
      window.toggleFallbackMode(true);
    }
  }

  return envData;
}

// Auto-trigger in browser environment
if (typeof window !== "undefined") {
  loadBrowserEnv().catch(() => {});
}

/**
 * Parses an SSE text chunk and extracts token deltas.
 */
export function parseGroqSSEChunk(chunk, onToken) {
  let textExtracted = "";
  let isDone = false;
  const lines = chunk.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(":")) continue; // ignore keep-alives and empty lines
    if (trimmed === "data: [DONE]") {
      isDone = true;
      continue;
    }
    if (trimmed.startsWith("data: ")) {
      try {
        const payload = JSON.parse(trimmed.slice(6));
        const delta = payload.choices?.[0]?.delta?.content || "";
        if (delta) {
          textExtracted += delta;
          if (onToken) onToken(delta);
        }
      } catch {
        // partial json chunk, will be handled by stream buffer
      }
    }
  }

  return { text: textExtracted, isDone };
}

/**
 * Streams chat completion using the Groq API with Qwen 27B model.
 */
export async function streamGroqChat({
  prompt,
  messages,
  apiKey,
  model = GROQ_QWEN_27B_MODEL,
  onToken,
  signal,
  temperature = 0.6,
  max_tokens = 2048,
}) {
  const key = (apiKey !== undefined ? apiKey : getGroqApiKey()).trim();
  if (!key) {
    throw new Error("Groq API key required. Please provide a key starting with 'gsk_'.");
  }

  const msgs = messages || [{ role: "user", content: prompt }];
  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: msgs,
      stream: true,
      temperature,
      max_tokens,
    }),
    signal,
  });

  if (!response.ok) {
    let errDetail = "";
    try {
      const errJson = await response.json();
      errDetail = errJson.error?.message || JSON.stringify(errJson);
    } catch {
      errDetail = await response.text();
    }
    throw new Error(`Groq API returned HTTP ${response.status}: ${errDetail}`);
  }

  if (!response.body) {
    throw new Error("ReadableStream not supported on this fetch response body.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop(); // preserve last incomplete line for next iteration

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(":")) continue;
      if (trimmed === "data: [DONE]") return fullText;
      if (trimmed.startsWith("data: ")) {
        try {
          const parsed = JSON.parse(trimmed.slice(6));
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            fullText += delta;
            if (onToken) onToken(delta, fullText);
          }
        } catch {
          // ignore corrupted/partial chunks
        }
      }
    }
  }

  if (buffer.trim().startsWith("data: ")) {
    try {
      const parsed = JSON.parse(buffer.trim().slice(6));
      const delta = parsed.choices?.[0]?.delta?.content;
      if (delta) {
        fullText += delta;
        if (onToken) onToken(delta, fullText);
      }
    } catch {}
  }

  return fullText;
}

/**
 * Executes a non-streaming chat completion request to the Groq API.
 */
export async function completeGroqChat({
  prompt,
  messages,
  apiKey,
  model = GROQ_QWEN_27B_MODEL,
  temperature = 0.6,
  max_tokens = 2048,
}) {
  const key = (apiKey !== undefined ? apiKey : getGroqApiKey()).trim();
  if (!key) {
    throw new Error("Groq API key required. Please provide a key starting with 'gsk_'.");
  }

  const msgs = messages || [{ role: "user", content: prompt }];
  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: msgs,
      stream: false,
      temperature,
      max_tokens,
    }),
  });

  if (!response.ok) {
    let errDetail = "";
    try {
      const errJson = await response.json();
      errDetail = errJson.error?.message || JSON.stringify(errJson);
    } catch {
      errDetail = await response.text();
    }
    throw new Error(`Groq API returned HTTP ${response.status}: ${errDetail}`);
  }

  const json = await response.json();
  return json.choices?.[0]?.message?.content || "";
}
