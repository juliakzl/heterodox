import React, { useEffect, useRef, useState } from 'react';

export default function VoiceRecorder({ onText, disabled, uploadUrl = '/api/answers/voice' }) {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);

  useEffect(() => {
    return () => {
      if (mediaRef.current && mediaRef.current.stream) {
        mediaRef.current.stream.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  async function start() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
    const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    chunksRef.current = [];
    mr.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
    mr.onstop = async () => {
      try {
        setBusy(true);
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' });
        const form = new FormData();
        // The server expects the field name "audio"
        form.append('audio', blob, 'recording.webm');

        const res = await fetch(uploadUrl, {
          method: 'POST',
          body: form,
          credentials: 'include',
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `upload_failed_${res.status}`);
        }

        const data = await res.json();
        if (onText) onText(String(data.text || '').trim());
      } catch (e) {
        console.error(e);
        alert('Voice transcription failed.');
      } finally {
        setBusy(false);
      }
    };

    mediaRef.current = mr;
    setRecording(true);
    mr.start();
  }

  function stop() {
    if (mediaRef.current && mediaRef.current.state === 'recording') {
      mediaRef.current.stop();
      mediaRef.current.stream.getTracks().forEach(t => t.stop());
      setRecording(false);
    }
  }

  return (
    <div style={{ display: 'inline-flex', gap: 8 }}>
      {!recording ? (
        <button onClick={start} disabled={disabled || busy}>
          🎤 Start
        </button>
      ) : (
        <button onClick={stop} disabled={disabled || busy}>
          ⏹ Stop &amp; Transcribe
        </button>
      )}
      {busy && <span>Transcribing…</span>}
    </div>
  );
}