import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

const html = fs.readFileSync('room/index.html', 'utf8');
const dom = new JSDOM(html, { url: 'http://localhost:8080/room' });
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.localStorage = dom.window.localStorage;
global.performance = dom.window.performance;
global.fetch = async (url, opts) => {
  if (url === '/api/groq') url = 'http://localhost:8080/api/groq';
  return await globalThis.fetch(url, opts);
};

// mock basic canvas for Chart.js
global.HTMLCanvasElement.prototype.getContext = () => ({
  fillRect: () => {},
  clearRect: () => {},
  getImageData: () => ({ data: new Array(4) }),
  putImageData: () => {},
  createImageData: () => [],
  setTransform: () => {},
  drawImage: () => {},
  save: () => {},
  fillText: () => {},
  restore: () => {},
  beginPath: () => {},
  moveTo: () => {},
  lineTo: () => {},
  closePath: () => {},
  stroke: () => {},
  translate: () => {},
  scale: () => {},
  rotate: () => {},
  arc: () => {},
  fill: () => {},
  measureText: () => ({ width: 0 }),
  transform: () => {},
  rect: () => {},
  clip: () => {}
});

// Import everything
await import('./room.js');

setTimeout(async () => {
  console.log('--- STARTING GENERATION ---');
  window.fallbackMode = true;
  document.getElementById('ai-model').value = 'llama-3.1-8b-instant'; // ensure valid groq model
  document.getElementById('ai-prompt').value = 'hi';
  
  // mock some missing functions
  window.toast = console.log;
  window.mascot = console.log;
  window.aiStatus = console.log;
  
  // mock bot start/update
  let mockReply = '';
  window.chatBotStart = () => { console.log('chatBotStart called'); };
  window.chatBotUpdate = (reply) => { mockReply = reply; console.log('update:', reply); };
  window.chatBotEnd = (reply) => { console.log('end:', reply); };
  
  // mock sendChat
  window.sendChat = (msg) => { console.log('sendChat:', msg.t); };
  
  try {
    await window.aiGenerate('hi', 'TestUser', 'id-123');
    console.log('Finished! Reply:', mockReply);
  } catch(e) {
    console.error('CRASH:', e);
  }
  process.exit(0);
}, 2000);
