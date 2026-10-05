import re

with open('room/models.js', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace thinking: true with thinking: false for the specified models
text = re.sub(r'("qwen3-0\.6b":.*?thinking:\s*)true', r'\g<1>false', text, flags=re.DOTALL)
text = re.sub(r'("qwen3-1\.7b":.*?thinking:\s*)true', r'\g<1>false', text, flags=re.DOTALL)
text = re.sub(r'("qwen3-4b":.*?thinking:\s*)true', r'\g<1>false', text, flags=re.DOTALL)
text = re.sub(r'("qwen3\.8-27b":.*?thinking:\s*)true', r'\g<1>false', text, flags=re.DOTALL)

with open('room/models.js', 'w', encoding='utf-8') as f:
    f.write(text)

print("Done")
