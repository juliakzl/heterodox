import express from "express";
import OpenAI from "openai";
import multer from "multer";
import fs from "fs";
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import dotenv from 'dotenv';
const rootEnvPath = path.join(__dirname, '..', '.env');
dotenv.config({ path: rootEnvPath });               // repo root (optional)
dotenv.config({ path: path.join(__dirname, '.env') }); // server/.env

const router = express.Router();

// Azure/OpenAI client helper
function makeTranscribeClient() {
  const azureEndpoint   = (process.env.AZURE_OPENAI_ENDPOINT || process.env.AZURE_ENDPOINT || "").replace(/\/$/, "");
  const azureKey        = process.env.AZURE_OPENAI_API_KEY
                       || process.env.AZURE_OPENAI_KEY
                       || process.env.AZURE_KEY
                       || "";
  const azureDeployment = process.env.AZURE_OPENAI_DEPLOYMENT_NAME
                       || process.env.AZURE_OPENAI_DEPLOYMENT
                       || process.env.AZURE_WHISPER_DEPLOYMENT
                       || "";
  const apiVersion      = process.env.AZURE_OPENAI_API_VERSION
                       || process.env.OPENAI_API_VERSION
                       || "2024-02-01";

  const hasAnyAzure = !!(azureEndpoint || azureKey || azureDeployment);
  const hasAllAzure = !!(azureEndpoint && azureKey && azureDeployment);

  if (process.env.DEBUG_VOICE === '1') {
    console.log('VOICE ENV CHECK', {
      azureEndpointLoaded: !!azureEndpoint,
      azureKeyLoaded: !!azureKey,
      azureDeployment,
      apiVersion,
      openAiKeyLoaded: !!(process.env.OPENAI_API_KEY || process.env.OPENAI_KEY),
    });
  }

  if (hasAnyAzure && !hasAllAzure) {
    throw new Error(
      `Azure OpenAI env incomplete: endpoint=${!!azureEndpoint}, key=${!!azureKey}, deployment=${!!azureDeployment}. ` +
      `Set AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY (or AZURE_KEY), and AZURE_OPENAI_DEPLOYMENT_NAME.`
    );
  }

  if (azureEndpoint && azureKey && azureDeployment) {
    const client = new OpenAI({
      baseURL: `${azureEndpoint}/openai/deployments/${azureDeployment}`,
      defaultQuery: { "api-version": apiVersion },
      defaultHeaders: { "api-key": azureKey },
    });
    return { client, model: azureDeployment, provider: "azure" };
  }

  const openAiKey = process.env.OPENAI_API_KEY
                 || process.env.OPENAI_KEY
                 || process.env.AZURE_OPENAI_API_KEY
                 || process.env.AZURE_KEY
                 || "";
  if (!openAiKey) {
    throw new Error("No OpenAI API key configured (set OPENAI_API_KEY or OPENAI_KEY, or Azure variables).");
  }
  const client = new OpenAI({ apiKey: openAiKey });
  return { client, model: process.env.WHISPER_MODEL || "whisper-1", provider: "openai" };
}

// Multer: store to /tmp (25 MB max per Azure Whisper guidelines)
const upload = multer({ dest: "/tmp", limits: { fileSize: 25 * 1024 * 1024 } });

// POST /api/answers/voice
// multipart/form-data with field "audio"
router.post("/api/answers/voice", upload.single("audio"), async (req, res) => {
  const tmpPath = req.file?.path;
  try {
    // Require logged-in user (so we can associate the transcript/answer)
    if (!req.session?.user?.id) {
      return res.status(401).json({ error: "unauthorized" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "no_file", message: "Attach audio in 'audio' form field." });
    }

    const mime = req.file.mimetype || "";
    if (!mime.startsWith("audio/")) {
      return res.status(400).json({ error: "invalid_mime" });
    }

    const { client, model } = makeTranscribeClient();

    // Create a readable stream from temp file (works with Azure + OpenAI SDK)
    const fileStream = fs.createReadStream(req.file.path);
    const fileName = req.file.originalname || "audio.webm";

    // Optional language hint from client (e.g. "en")
    const language = (req.body?.language || "").trim() || undefined;

    // 1) Transcribe
    const tr = await client.audio.transcriptions.create({
      file: fileStream,
      model,
      ...(language ? { language } : {}),
    });

    const text = tr?.text || "";

    // 2) Persist like a typed answer (if desired)
    // await saveAnswer({ userId: req.session.user.id, text });

    return res.json({ text });
  } catch (e) {
    console.error("voice_transcription_failed:", e);
    return res.status(500).json({ error: "voice_transcription_failed" });
  } finally {
    // best-effort cleanup of temp upload
    if (tmpPath) {
      fs.unlink(tmpPath, () => {});
    }
  }
});

export default router;