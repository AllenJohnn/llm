// Groq API integration for SwarmLLM
// Model: Qwen 27B and mapped swarm models
import {
  GROQ_PROXY_URL,
  GROQ_DIRECT_URL,
  formatGroqError,
  parseGroqSSEChunk,
  streamGroqChat as clientStreamGroqChat,
  completeGroqChat as clientCompleteGroqChat,
} from "./groq-client.js";

export {
  GROQ_PROXY_URL,
  GROQ_DIRECT_URL,
  formatGroqError,
  parseGroqSSEChunk,
};

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

  try {
    const res = await fetch("/env.json?t=" + Date.now());
    if (res.ok) {
      const json = await res.json();
      Object.assign(envData, json);
    }
  } catch {}

  return envData;
}

if (typeof window !== "undefined") {
  loadBrowserEnv().catch(() => {});
}

/**
 * Streaming chat wrapper supporting both proxy and direct Groq endpoint.
 */
export async function streamGroqChat(opts) {
  let key = opts.apiKey;
  if (key === undefined) {
    // If running in browser and hitting proxy, apiKey is not required from browser
    if (typeof window !== "undefined" && !opts.endpoint) {
      key = undefined;
    } else {
      key = getGroqApiKey();
    }
  }
  if (opts.endpoint === GROQ_DIRECT_URL || (!opts.endpoint && typeof window === "undefined" && opts.apiKey !== undefined)) {
    if (!opts.apiKey) {
      throw new Error("Groq API key required. Please provide a key starting with 'gsk_'.");
    }
  }

  let full = "";
  for await (const piece of clientStreamGroqChat({
    ...opts,
    apiKey: key,
    model: opts.model || GROQ_QWEN_27B_MODEL,
    onToken: (tok, currentFull) => {
      full = currentFull;
      if (opts.onToken) opts.onToken(tok, currentFull);
    },
  })) {
    // collected
  }
  return full;
}

/**
 * Non-streaming chat wrapper.
 */
export async function completeGroqChat(opts) {
  if (opts.apiKey !== undefined && !opts.apiKey) {
    throw new Error("Groq API key required. Please provide a key starting with 'gsk_'.");
  }
  return clientCompleteGroqChat({
    ...opts,
    model: opts.model || GROQ_QWEN_27B_MODEL,
  });
}
