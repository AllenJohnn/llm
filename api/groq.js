// Serverless / proxy endpoint for Groq API chat completions
// Holds GROQ_API_KEY server-side and forwards SSE streams to the browser.
// Never exposes GROQ_API_KEY to the client.
import fs from "node:fs";
import path from "node:path";

function loadServerApiKey() {
  if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim()) {
    return process.env.GROQ_API_KEY.trim();
  }
  try {
    if (typeof process.loadEnvFile === "function") {
      process.loadEnvFile();
      if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim()) {
        return process.env.GROQ_API_KEY.trim();
      }
    }
  } catch {}
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8");
      const match = content.match(/^\s*GROQ_API_KEY\s*=\s*(.+)$/m);
      if (match) {
        let val = match[1].trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        return val;
      }
    }
  } catch {}
  return "";
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 10 * 1024 * 1024) {
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

const GROQ_MODEL_ALIASES = {
  // Map to active high-capacity Groq models (8,000 TPM vs 1,000 OTPM on qwen)
  "llama-3.1-8b-instant": "openai/gpt-oss-20b",
  "qwen/qwen3-32b": "openai/gpt-oss-120b",
  "deepseek-r1-distill-qwen-32b": "openai/gpt-oss-120b",
  "qwen/qwen3.8-27b": "openai/gpt-oss-120b",

  // Model keys directly from room/models.js
  "qwen3.8-27b": "openai/gpt-oss-120b",
  "qwen2.5-coder-7b": "openai/gpt-oss-120b",
  "qwen2.5-coder-1.5b": "openai/gpt-oss-20b",
  "deepseek-r1-distill-qwen-14b": "openai/gpt-oss-120b",
  "qwq-32b": "openai/gpt-oss-120b",
  "qwen3-4b": "openai/gpt-oss-20b",
  "qwen3-1.7b": "openai/gpt-oss-20b",
  "qwen3-0.6b": "openai/gpt-oss-20b",
  "phi-4-mini": "openai/gpt-oss-20b",
  "smollm-135m": "openai/gpt-oss-20b",
};

const MODEL_PERSONAS = {
  "qwen2.5-coder-7b": "You are Qwen2.5-Coder (7B), created by Alibaba Cloud. You are an expert code intelligence and software engineering assistant. Write clean, idiomatic, well-commented code and provide clear explanations.",
  "qwen2.5-coder-1.5b": "You are Qwen2.5-Coder (1.5B), created by Alibaba Cloud. You are a fast, lightweight coding assistant.",
  "deepseek-r1-distill-qwen-14b": "You are DeepSeek-R1-Distill-Qwen (14B), created by DeepSeek. You are an advanced reasoning model that solves problems with deep, methodical analysis.",
  "deepseek-r1-distill-qwen-32b": "You are DeepSeek-R1-Distill-Qwen (32B), created by DeepSeek. You are an advanced reasoning model that solves problems with deep, methodical analysis.",
  "qwq-32b": "You are QwQ (32B), an experimental reasoning model developed by the Qwen team at Alibaba Cloud, designed for complex problem solving, logic, and deep analysis.",
  "qwen3.8-27b": "You are Qwen 3.8 (27B), created by Alibaba Cloud. You are a versatile, helpful, and insightful AI assistant.",
  "qwen3-4b": "You are Qwen3 4B, an efficient and balanced language model created by Alibaba Cloud.",
  "qwen3-1.7b": "You are Qwen3 1.7B, a lightweight and speedy language model created by Alibaba Cloud.",
  "qwen3-0.6b": "You are Qwen3 0.6B, an ultra-fast, lightweight model created by Alibaba Cloud.",
  "phi-4-mini": "You are Phi-4 mini, developed by Microsoft. You specialize in math, code, and high-density reasoning.",
  "smollm-135m": "You are SmolLM (135M), an ultra-compact language model developed by Hugging Face.",
};

function prepareMessagesWithPersona(messages, personaKey) {
  if (!personaKey) return messages;
  const persona = MODEL_PERSONAS[personaKey];
  if (!persona) return messages;
  const hasSystem = messages.some(m => m.role === "system");
  if (!hasSystem) {
    return [{ role: "system", content: persona }, ...messages];
  }
  return messages;
}

async function executeGroqCompletion({ apiKey, model, messages, temperature, max_tokens }) {
  const resolvedModel = GROQ_MODEL_ALIASES[model] || model;
  const reqMaxTokens = typeof max_tokens === "number" && max_tokens > 0
    ? Math.min(max_tokens, 8192)
    : 4096;

  const payload = {
    model: resolvedModel,
    messages,
    stream: true,
    temperature: typeof temperature === "number" ? temperature : 0.6,
    max_tokens: reqMaxTokens,
  };

  let resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  // Bulletproof resilience: handle 429 rate limits or 503 over-capacity
  if (!resp.ok && (resp.status === 429 || resp.status === 503)) {
    let errBody = "";
    try {
      errBody = await resp.text();
    } catch {}
    console.warn(`[Groq Proxy] ${resolvedModel} returned ${resp.status}. Attempting high-capacity fallback...`);

    // Tier 1 fallback: switch to alternative high-capacity model (openai/gpt-oss-20b or gpt-oss-120b)
    const fallbackModel = (resolvedModel === "openai/gpt-oss-20b")
      ? "openai/gpt-oss-120b"
      : "openai/gpt-oss-20b";
    const retryTokens = reqMaxTokens > 2048 ? 2048 : (reqMaxTokens > 1000 ? 1000 : reqMaxTokens);

    let retryResp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...payload, model: fallbackModel, max_tokens: retryTokens }),
    });

    if (retryResp.ok) {
      return retryResp;
    }

    // Tier 2 fallback: allam-2-7b (7000 RPM, 6000 TPM limit)
    let finalResp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...payload, model: "allam-2-7b", max_tokens: 1000 }),
    });

    if (finalResp.ok) {
      return finalResp;
    }

    return new Response(errBody, {
      status: resp.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  return resp;
}

async function handleWebRequest(request) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ error: { message: "Method not allowed. Use POST." } }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const apiKey = loadServerApiKey();
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: { message: "Server GROQ_API_KEY is not configured in .env." } }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let bodyData;
  try {
    bodyData = await request.json();
  } catch (e) {
    return new Response(
      JSON.stringify({ error: { message: "Invalid JSON: " + e.message } }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { model, impersonate, messages, prompt, temperature, max_tokens } = bodyData;
  const rawMsgs = messages || (prompt ? [{ role: "user", content: prompt }] : []);
  const msgs = prepareMessagesWithPersona(rawMsgs, impersonate || model);

  if (!model) {
    return new Response(
      JSON.stringify({ error: { message: "Model is required." } }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const groqResp = await executeGroqCompletion({
      apiKey,
      model,
      messages: msgs,
      temperature,
      max_tokens,
    });

    if (!groqResp.ok) {
      const errText = await groqResp.text();
      const contentType = groqResp.headers.get("content-type") || "application/json";
      return new Response(errText, {
        status: groqResp.status,
        headers: { ...corsHeaders, "Content-Type": contentType },
      });
    }

    return new Response(groqResp.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: { message: "Failed to connect to Groq API: " + err.message } }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

export default async function handler(req, res) {
  // Check if invoked as Web Standard Request (Edge runtime / Deno / Fetch)
  if (req instanceof Request || (req && typeof req.json === "function" && !res)) {
    return handleWebRequest(req);
  }

  // Node.js HTTP Serverless handler (Vercel Node runtime / local HTTP server)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: { message: "Method not allowed. Use POST." } }));
    return;
  }

  const apiKey = loadServerApiKey();
  if (!apiKey) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({
      error: {
        message: "Server GROQ_API_KEY is not configured in .env. Please configure GROQ_API_KEY on the server."
      }
    }));
    return;
  }

  let bodyData = req.body;
  if (!bodyData || typeof bodyData !== "object") {
    try {
      bodyData = await readJsonBody(req);
    } catch (err) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: { message: "Invalid JSON body: " + err.message } }));
      return;
    }
  }

  const { model, impersonate, messages, prompt, temperature, max_tokens } = bodyData;
  const rawMsgs = messages || (prompt ? [{ role: "user", content: prompt }] : []);
  const msgs = prepareMessagesWithPersona(rawMsgs, impersonate || model);

  if (!model) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: { message: "Model is required." } }));
    return;
  }

  if (!msgs || !msgs.length) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: { message: "Messages or prompt is required." } }));
    return;
  }

  try {
    const groqResp = await executeGroqCompletion({
      apiKey,
      model,
      messages: msgs,
      temperature,
      max_tokens,
    });

    if (!groqResp.ok) {
      const errText = await groqResp.text();
      res.statusCode = groqResp.status;
      const contentType = groqResp.headers.get("content-type") || "application/json";
      res.setHeader("Content-Type", contentType);
      res.end(errText);
      return;
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    });

    const reader = groqResp.body.getReader();
    req.on("close", () => {
      try { reader.cancel(); } catch {}
    });

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
      if (typeof res.flush === "function") res.flush();
    }
    res.end();
  } catch (fetchErr) {
    if (!res.headersSent) {
      res.statusCode = 502;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: { message: "Failed to connect to Groq API: " + fetchErr.message } }));
    } else {
      res.end();
    }
  }
}

export const POST = handler;
