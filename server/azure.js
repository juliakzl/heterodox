import OpenAI from 'openai';

const {
  AZURE_OPENAI_ENDPOINT,
  AZURE_OPENAI_API_KEY,
  AZURE_OPENAI_API_VERSION,
  AZURE_OPENAI_TRANSCRIBE_DEPLOYMENT,
} = process.env;

export const transcribeClient = new OpenAI({
  apiKey: AZURE_OPENAI_API_KEY,
  // IMPORTANT: point to your deployment
  baseURL: `${AZURE_OPENAI_ENDPOINT}/openai/deployments/${AZURE_OPENAI_TRANSCRIBE_DEPLOYMENT}`,
  // Azure requires the api-key header and api-version query
  defaultHeaders: { 'api-key': AZURE_OPENAI_API_KEY },
  defaultQuery: { 'api-version': AZURE_OPENAI_API_VERSION },
});

// (Optional) quick sanity log on boot:
console.log('Azure baseURL:', `${AZURE_OPENAI_ENDPOINT}/openai/deployments/${AZURE_OPENAI_TRANSCRIBE_DEPLOYMENT}`);
console.log('Azure api-version:', AZURE_OPENAI_API_VERSION);