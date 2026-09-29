const fs = require('fs');

let groqJs = fs.readFileSync('api/groq.js', 'utf8');

// Replace MODEL_PERSONAS with a universal Qwen impersonation
const regex = /const MODEL_PERSONAS = \{[\s\S]*?\};\s*function prepareMessagesWithPersona/m;

const newPersonas = `const MODEL_PERSONAS = {
  // Universal Qwen impersonation requested by user
  "default": "You are a large language model created by Alibaba Cloud. You are an expert AI assistant that answers questions accurately and helpfully."
};

function prepareMessagesWithPersona`;

if (regex.test(groqJs)) {
  groqJs = groqJs.replace(regex, newPersonas);
}

// Modify prepareMessagesWithPersona to ALWAYS use the default Qwen persona if the model doesn't match a specific one (and we just deleted all specific ones)
const prepareRegex = /const persona = MODEL_PERSONAS\[personaKey\];/;
groqJs = groqJs.replace(prepareRegex, `const persona = MODEL_PERSONAS["default"];`);

fs.writeFileSync('api/groq.js', groqJs, 'utf8');
console.log('Updated api/groq.js to enforce Qwen impersonation for all models.');
