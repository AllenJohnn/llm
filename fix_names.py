import re
import os

with open("room.js", "r", encoding="utf-8") as f:
    text = f.read()

# Replace leftover lowercase prefixes and phrases
text = text.replace('log("swarm"', 'log("webslice"')
text = text.replace('swarm room', 'WebSlice room')
text = text.replace('swarm ', 'WebSlice ')
text = text.replace('Swarm ', 'WebSlice ')
text = text.replace('Swarmy', 'WebSlicey')
text = text.replace('window.swarmDebug', 'window.websliceDebug')
text = text.replace('x-swarm-len', 'x-webslice-len')
text = text.replace('swarm-crumb', 'webslice-crumb')
text = text.replace('swarm_think_mode', 'webslice_think_mode')
text = text.replace('swarm_fallbackmode', 'webslice_fallbackmode')

with open("room.js", "w", encoding="utf-8") as f:
    f.write(text)

with open("room/index.html", "r", encoding="utf-8") as f:
    html = f.read()
    html = html.replace('swarm', 'webslice').replace('Swarm', 'WebSlice')
with open("room/index.html", "w", encoding="utf-8") as f:
    f.write(html)
