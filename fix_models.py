import re
with open('room/models.js', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('  "phi-4-mini": 3.0,', '  "phi-4-mini": 3.0,\n  "smollm-135m": 0.3,')

text = text.replace('  "qwen3.8-27b": { label: "Qwen 3.8 27B', '  "smollm-135m": { label: "SmolLM 135M \u00b7 bf16", kind: "st", thinking: false,\n    st: "https://huggingface.co/HuggingFaceTB/SmolLM-135M-Instruct/resolve/main/model.safetensors",\n    cfg: "https://huggingface.co/HuggingFaceTB/SmolLM-135M-Instruct/resolve/main/config.json",\n    tok: "https://huggingface.co/HuggingFaceTB/SmolLM-135M-Instruct/resolve/main/tokenizer.json" },\n  "qwen3.8-27b": { label: "Qwen 3.8 27B')

with open('room/models.js', 'w', encoding='utf-8') as f:
    f.write(text)
