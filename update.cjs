const fs = require('fs');
let room = fs.readFileSync('room.js', 'utf8');

// Replace Groq with Cloud
room = room.replace(/via Groq/g, 'via Cloud')
           .replace(/Groq mode active/g, 'Cloud mode active')
           .replace(/Groq Mode/g, 'Cloud Mode')
           .replace(/Groq API/g, 'Cloud API')
           .replace(/Groq error:/g, 'Cloud error:')
           .replace(/Groq Error/g, 'Cloud Error')
           .replace(/Groq \(On\)/g, 'Cloud (On)')
           .replace(/Groq Cloud/g, 'Cloud API')
           .replace(/via Groq!/g, 'via Cloud!');

// Add repetition penalty
room = room.replace(/let id = argmax\(logits\);/g, 'let id = argmax(logits, ai.chain, 1.15);');

// Fix ChatML system prompt formatting for Qwen
const oldPrompt = `: [imStart, ...ai.tok.encode("user\\n" + text), imEnd, ...ai.tok.encode("\\n"), imStart, ...ai.tok.encode("assistant\\n")];`;
const newPrompt = `: [imStart, ...ai.tok.encode("system\\nYou are a helpful assistant."), imEnd, ...ai.tok.encode("\\n"), imStart, ...ai.tok.encode("user\\n" + text), imEnd, ...ai.tok.encode("\\n"), imStart, ...ai.tok.encode("assistant\\n")];`;
room = room.replace(oldPrompt, newPrompt);

// Remove think bypass for qwen3-0.6b to fix system prompt injection issue
const oldBypass = `if (isThinkingModel && !wantThinking && ai.model !== "qwen3-0.6b") {`;
const newBypass = `if (isThinkingModel && !wantThinking) {`;
room = room.replace(oldBypass, newBypass);

fs.writeFileSync('room.js', room);
console.log("Updated room.js");
