import re
import os

def bump_fonts(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Bump simple pixel values (e.g., font-size: 12px)
        def px_repl(match):
            size = float(match.group(1))
            if size < 40:
                size += 3
            # Format nicely, remove .0 if it's an integer
            size_str = f"{size:g}"
            return f"font-size: {size_str}px"
            
        new_content = re.sub(r'font-size:\s*([0-9.]+)(px)', px_repl, content)

        # Bump clamped pixel values (e.g., font-size: clamp(24px, 4vw, 30px))
        def clamp_repl(match):
            inner = match.group(1)
            def clamp_px_repl(m):
                s = float(m.group(1))
                if s < 60: s += 4
                return f"{s:g}px"
            new_inner = re.sub(r'([0-9.]+)(px)', clamp_px_repl, inner)
            return f"font-size: clamp({new_inner})"
            
        new_content = re.sub(r'font-size:\s*clamp\(([^)]+)\)', clamp_repl, new_content)

        if content != new_content:
            with open(file_path, 'w', encoding='utf-8', newline='') as f:
                f.write(new_content)
            print(f"Updated {file_path}")
            
    except Exception as e:
        print(f"Error processing {file_path}: {e}")

bump_fonts('index.html')
bump_fonts('room/index.html')
