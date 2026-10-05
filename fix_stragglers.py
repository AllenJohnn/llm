import os

with open("room.js", "r", encoding="utf-8") as f:
    text = f.read()

text = text.replace("using local WebGPU swarm", "using local WebGPU WebSlice")
text = text.replace("using WebGPU Swarm", "using WebGPU WebSlice")

with open("room.js", "w", encoding="utf-8") as f:
    f.write(text)
