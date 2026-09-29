with open('room.js', 'r', encoding='utf-8') as f:
    text = f.read()
text = text.replace('if ($("ai-row")) // $("ai-row").style.display = "none";', '/* if ($("ai-row")) $("ai-row").style.display = "none"; */')
with open('room.js', 'w', encoding='utf-8') as f:
    f.write(text)
