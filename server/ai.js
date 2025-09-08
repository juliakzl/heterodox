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


  const examples = [
  "If you could relive one moment in your life without changing the outcome of it but just for sake of experiencing it again, what would it be?",
  "Do soulmates exist?",
  "What is your favourite conspiracy theory?",
  "What is the most supernatural thing that happened to you?",
  "How did the first love on earth look like?",
  "What was the latest new emotion you discovered?",
  "What comes first: feelings or language?",
  "How would society change if privacy no longer existed?",
  "What were the moments when you felt furthest from and closest to understanding another human?",
  "If you could rerun evolution, what would look differently in your world?",
  "Do you think Sisyphus is happy right now?",
  "What do you believe is true that would get you cancelled if said out loud?",
  "What is the coolest question you ever got asked?",
  "What is your favorite scientific fact?",
  "What is the biggest misconception of our time?",
  "It’s year 1934, you are a German citizen. Would you join the NSDAP Party?",
  "What is one thing you pretend to understand but secretly don’t?",
  "What do you think your great-great-grandchildren will find morally horrifying about the way we live now?",
  "When was the last time you felt completely out of place, like you were dropped into the wrong movie?",
  "If you had to design a ritual that all humans must perform once in their lives, what would it be?",
  "If you could choose the exact last thought you’ll ever have, what would it be?",
  "Which is scarier: that we are alone in the universe, or that we aren’t?",
  "What’s one moral line you crossed that you’ve never fully forgiven yourself for, even if no one else knows?",
  "If the person you love most were accused of a terrible crime, would you want to know for certain whether they were guilty?",
  "What’s something you’ve done that you would judge someone else harshly for doing?",
  "Are you running from something or towards something?"
];
  const examplesList = examples.map((q, i) => `${i + 1}. ${q}`).join('\n');

  const system = process.env.AI_WEEKLY_SYSTEM || `You craft short, thought-provoking, open-ended questions that spark meaningful discussion. One sentence. No quotes. Here are example questions to match the style:

${examplesList}`;

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