import { getGroqModelId, MODELS } from "../room/models.js";
import { streamGroqChat } from "../room/groq-client.js";

const modelsToTest = [
  "qwen3.8-27b",
  "qwen2.5-coder-7b",
  "deepseek-r1-distill-qwen-14b",
  "qwq-32b",
  "qwen3-0.6b"
];

console.log("=== Testing 5 Mapped Models via Proxy (/api/groq) ===\n");

async function main() {
  const results = [];
  for (const mKey of modelsToTest) {
    const groqId = getGroqModelId(mKey);
    const label = MODELS[mKey]?.label?.split("·")[0]?.trim() || mKey;
    console.log(`Checking "${label}" (Key: ${mKey}) -> Groq ID: "${groqId}"`);

    try {
      let tokens = [];
      for await (const tok of streamGroqChat({
        model: groqId,
        messages: [{ role: "user", content: "Say hello in 2 words" }],
        endpoint: "http://localhost:8080/api/groq",
        max_tokens: 10
      })) {
        tokens.push(tok);
      }
      const output = tokens.join("");
      console.log(`  -> Status: SUCCESS`);
      console.log(`  -> Output: ${JSON.stringify(output)}\n`);
      results.push({ label, key: mKey, groqId, status: "OK", output });
    } catch (err) {
      console.log(`  -> Status: ERROR`);
      console.log(`  -> Error Message: ${err.message}\n`);
      results.push({ label, key: mKey, groqId, status: "ERROR", error: err.message });
    }
  }

  console.log("=== Summary of Results ===");
  console.table(results);
}

main().catch(console.error);
