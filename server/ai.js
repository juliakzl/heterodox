import OpenAI from "openai";

// Azure OpenAI via environment variables (no hardcoded secrets)
const AZURE_OPENAI_ENDPOINT =
  process.env.AZURE_OPENAI_ENDPOINT || process.env.AZURE_ENDPOINT;
const AZURE_OPENAI_API_VERSION =
  process.env.AZURE_OPENAI_API_VERSION || process.env.AZURE_API_VERSION || "2024-12-01-preview";
const AZURE_OPENAI_API_KEY =
  process.env.AZURE_OPENAI_API_KEY || process.env.AZURE_KEY || process.env.OPENAI_API_KEY;
const AZURE_OPENAI_CHAT_DEPLOYMENT =
  process.env.AZURE_OPENAI_CHAT_DEPLOYMENT || process.env.AZURE_OPENAI_DEPLOYMENT_NAME;

function assertEnv(ok, msg) {
  if (!ok) throw new Error(`[ai.js] ${msg}`);
}
assertEnv(AZURE_OPENAI_API_KEY, "Missing Azure key. Set AZURE_OPENAI_API_KEY or AZURE_KEY (or OPENAI_API_KEY).");
assertEnv(AZURE_OPENAI_ENDPOINT, "Missing Azure endpoint. Set AZURE_OPENAI_ENDPOINT, e.g. https://<resource>.openai.azure.com");
assertEnv(AZURE_OPENAI_CHAT_DEPLOYMENT, "Missing Azure chat deployment. Set AZURE_OPENAI_CHAT_DEPLOYMENT (or AZURE_OPENAI_DEPLOYMENT_NAME).");

const baseURL = `${AZURE_OPENAI_ENDPOINT.replace(/\/+$/, "")}/openai/deployments/${encodeURIComponent(
  AZURE_OPENAI_CHAT_DEPLOYMENT
)}`;

// The OpenAI SDK speaks Azure by pointing baseURL at the deployment and adding api-version + api-key
const client = new OpenAI({
  baseURL,
  apiKey: AZURE_OPENAI_API_KEY,
  defaultHeaders: { "api-key": AZURE_OPENAI_API_KEY },
  defaultQuery: { "api-version": AZURE_OPENAI_API_VERSION },
});

/**
 * Generate a single, short, open-ended question suitable for a weekly round.
 * Uses your Azure OpenAI chat deployment configured in environment variables
 * that `azureClientFor('chat')` reads (endpoint, api key, deployment name).
 *
 * @param {Object} [opts]
 * @param {string} [opts.userPrompt] - Optional custom user prompt.
 * @returns {Promise<string>} - A clean question string.
 */
export async function generateWeeklyAIQuestion(opts = {}) {
  const {
    userPrompt,
  } = opts;

  const system = process.env.AI_WEEKLY_SYSTEM
    || "You craft short, thought-provoking, open-ended questions that spark meaningful discussion. One sentence. No quotes.";

  const user = userPrompt || process.env.AI_WEEKLY_USER
    || "Generate ONE thoughtful, open-ended question suitable for a small discussion group. Output ONLY the question text. Good example: Do soulmates exist? Bad example: How does our perception of truth change when we consider perspectives different from our own?";

  const temperature = Number(
    process.env.AI_WEEKLY_TEMPERATURE ?? 0.8
  );

  const resp = await client.chat.completions.create({
    model: AZURE_OPENAI_CHAT_DEPLOYMENT,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature,
    max_tokens: 64,
  });

  const text = (resp.choices?.[0]?.message?.content || "").trim();
  if (!text) {
    throw new Error("AI returned empty question");
  }

  // remove any surrounding quotes the model might add
  return text.replace(/^["'“”]+|["'“”]+$/g, "");
}