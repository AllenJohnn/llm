import os
import subprocess

def replace_in_file(path):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Perform replacements for known casings
        new_content = content.replace("SwarmLLM", "WebSlice")
        new_content = new_content.replace("swarmllm", "webslice")
        new_content = new_content.replace("Swarmllm", "WebSlice")
        
        if new_content != content:
            with open(path, 'w', encoding='utf-8', newline='') as f:
                f.write(new_content)
            print(f"Updated {path}")
    except Exception as e:
        # Some files might be binary or inaccessible
        pass

# get all tracked files
result = subprocess.run(['git', 'ls-files'], stdout=subprocess.PIPE, text=True)
files = result.stdout.split('\n')
for file in files:
    if file and os.path.isfile(file):
        replace_in_file(file)
