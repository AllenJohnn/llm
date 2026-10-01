import re

with open('room.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Replace the top variable declarations
content = re.sub(
    r'var isGroqMode = true;\nvar fallbackmode = true;',
    'var fallbackMode = false;\ntry {\n  fallbackMode = localStorage.getItem("swarm_fallbackmode") === "true";\n} catch(e){}',
    content
)

content = content.replace('window.isGroqMode = isGroqMode;', '')
content = content.replace('window.fallbackmode = fallbackmode;', 'window.fallbackMode = fallbackMode;')

# Replace all occurrences of isGroqMode with fallbackMode
content = content.replace('isGroqMode', 'fallbackMode')

# Replace all occurrences of fallbackmode with fallbackMode
content = content.replace('fallbackmode', 'fallbackMode')

# 2. Fix the forced fallback for Qwen3.8-27B
# Original: if (fallbackMode || (url && url.includes("Qwen3.8-27B"))) {
content = content.replace(
    'if (fallbackMode || (url && url.includes("Qwen3.8-27B")))',
    'if (fallbackMode)'
)

# Fix duplicate assignments in toggleFallbackMode function
content = content.replace('fallbackMode = fallbackMode;\n', '')

# Update HTML desc
pattern = r'const sfcDesc = \$\("sfc-desc"\);\n\s*if \(sfcDesc\) \{\n\s*sfcDesc\.textContent = enabled\n\s*\?[^\n]*\n\s*:[^\n]*;\n\s*\}'
replacement = '''const sfcDesc = $("sfc-desc");
  if (sfcDesc) {
    sfcDesc.innerHTML = enabled
      ? "● <b>Groq Fallback</b><br><span style=\\"opacity:0.8;font-size:9.5px\\">Inference through Groq API</span>"
      : "● <b>Distributed Local</b><br><span style=\\"opacity:0.8;font-size:9.5px\\">WebGPU + peer inference</span>";
  }'''
content = re.sub(pattern, replacement, content)

with open('room.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("room.js refactored")
