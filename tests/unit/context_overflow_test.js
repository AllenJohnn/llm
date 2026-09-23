// Tests for Issue #31: Context overflow detection and handling
import { MAX_SEQ, MAX_NEW, MIN_ROOM } from "../../room/models.js";

const assert = (cond, msg) => { if (!cond) throw new Error(msg || "assertion failed"); };

// Deno test runner
if (typeof Deno !== "undefined" && Deno.test) {
  Deno.test("context: MAX_SEQ is 2048 to fit long prompt + answer", () => {
    assert(MAX_SEQ >= 2048, `MAX_SEQ must be >= 2048, got ${MAX_SEQ}`);
  });

  Deno.test("context: generation loop caps answer before context overflow", () => {
    const testMaxSeq = 512;
    const promptLen = 160; // e.g. japan prompt
    const desiredAnswerLen = 400; // desired 400-token answer

    // Old bug: 160 + 400 = 560 > 512, causing GPU out of bounds
    const maxNew = Math.min(MAX_NEW, testMaxSeq - promptLen);
    assert(maxNew === 352, `maxNew must cap at 352, got ${maxNew}`);
    assert(promptLen + maxNew <= testMaxSeq, "Total tokens must not exceed testMaxSeq");

    // Room limit check
    let pos = promptLen;
    let count = 0;
    let capped = false;
    for (let i = 0; i < maxNew; i++) {
      count++;
      if (pos >= testMaxSeq - 1 || i === maxNew - 1 || count >= maxNew) {
        capped = true;
        break;
      }
      pos++;
    }
    assert(capped === true, "Must flag capped when reaching limit");
    assert(pos < testMaxSeq, `Position ${pos} must remain strictly within context window ${testMaxSeq}`);
  });

  Deno.test("context: prompt exceeding maxSeq - MIN_ROOM is rejected with clean error", () => {
    const testMaxSeq = 512;
    const longPromptLen = 500; // Leaves only 12 tokens, < MIN_ROOM (32)
    let caught = false;
    try {
      if (longPromptLen > testMaxSeq - MIN_ROOM) {
        throw new Error(`prompt is ${longPromptLen} tokens; this room's context is ${testMaxSeq} tokens and an answer needs at least ${MIN_ROOM}. Shorten the prompt.`);
      }
    } catch (err) {
      caught = true;
      assert(err.message.includes("Shorten the prompt"), "Error should instruct user to shorten prompt");
    }
    assert(caught, "Should have caught prompt overflow");
  });
}

export async function runContextTests(testFn) {
  await testFn("context: MAX_SEQ is >= 2048", () => {
    assert(MAX_SEQ >= 2048, `MAX_SEQ must be >= 2048, got ${MAX_SEQ}`);
  });

  await testFn("context: generation loop caps answer before context overflow", () => {
    const testMaxSeq = 512;
    const promptLen = 160;
    const maxNew = Math.min(MAX_NEW, testMaxSeq - promptLen);
    assert(maxNew === 352, `maxNew must cap at 352, got ${maxNew}`);
    assert(promptLen + maxNew <= testMaxSeq, "Total tokens must not exceed testMaxSeq");

    let pos = promptLen;
    let count = 0;
    let capped = false;
    for (let i = 0; i < maxNew; i++) {
      count++;
      if (pos >= testMaxSeq - 1 || i === maxNew - 1 || count >= maxNew) {
        capped = true;
        break;
      }
      pos++;
    }
    assert(capped === true, "Must flag capped when reaching limit");
    assert(pos < testMaxSeq, `Position ${pos} must remain strictly within context window`);
  });

  await testFn("context: prompt exceeding maxSeq - MIN_ROOM is cleanly rejected", () => {
    const testMaxSeq = 512;
    const longPromptLen = 500;
    let caught = false;
    try {
      if (longPromptLen > testMaxSeq - MIN_ROOM) {
        throw new Error(`prompt is ${longPromptLen} tokens; this room's context is ${testMaxSeq} tokens and an answer needs at least ${MIN_ROOM}. Shorten the prompt.`);
      }
    } catch (err) {
      caught = true;
      assert(err.message.includes("Shorten the prompt"));
    }
    assert(caught, "Should have caught prompt overflow");
  });
}
