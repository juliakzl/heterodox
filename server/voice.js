import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import fsp from 'fs/promises';
import { toFile } from 'openai/uploads';
import { transcribeClient } from './azure.js';

const router = Router();
const upload = multer({ dest: 'uploads/' });

router.post('/api/answers/voice', upload.single('audio'), async (req, res) => {
  try {
    if (!transcribeClient) {
      return res.status(500).json({ error: 'Azure transcribe client not configured' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'audio file missing' });
    }

    const filePath = req.file.path;

    // Use a ReadStream and provide a filename using toFile() so Azure receives a proper multipart part.
    const fileStream = fs.createReadStream(filePath);
    const filename = req.file.originalname || 'audio.webm';

    const result = await transcribeClient.audio.transcriptions.create({
      file: await toFile(fileStream, filename),
      model: 'whisper-1', // required by SDK; Azure uses your deployment from baseURL
      // language: req.body?.language || undefined, // optionally pass language
    });

    await fsp.unlink(filePath).catch(() => {});
    res.json({ text: result.text || '' });
  } catch (err) {
    try {
      const hdrs = err?.headers ? Object.fromEntries(err.headers) : undefined;
      console.error('voice_transcription_failed:', {
        status: err?.status,
        code: err?.code,
        message: err?.message,
        headers: hdrs,
      });
    } catch {
      console.error('voice_transcription_failed:', err);
    }
    res.status(500).json({ error: 'voice_transcription_failed', message: err?.message || 'unknown_error' });
  }
});

export default router;