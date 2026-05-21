---
source_url: https://ai.google.dev/gemini-api/docs/speech-generation
ingested: 2026-05-21
sha256: 0c8888662b3fc3382d2bd8330127ee4936a163380b98d18a72dfd9fc5d8818cd
---

# Gemini Text-to-Speech Generation

## Source

- Official source: Google AI for Developers, Gemini API speech generation documentation.
- Retrieved: 2026-05-21.
- Scope captured for AIrchieve: single-speaker TTS integration points relevant to `ai_provider.generate_audio()`.

## Key Contract

- Gemini TTS transforms text-only input into audio-only output.
- TTS generation is separate from the Live API; it is intended for exact text recitation with controllable style, pace, tone, and voice.
- Single-speaker TTS uses `GenerateContentConfig` with `response_modalities=["AUDIO"]`.
- The request includes a `SpeechConfig` with a `VoiceConfig` and a `PrebuiltVoiceConfig`.
- Example model in the official documentation: `gemini-3.1-flash-tts-preview`.
- Example prebuilt voice in the official documentation: `Kore`.
- The Python example reads audio bytes from `response.candidates[0].content.parts[0].inline_data.data`.
- The official Python example writes the returned PCM into a WAV container using: channels `1`, sample rate `24000`, and sample width `2`.

## AIrchieve Implementation Notes

- `backend/app/service/ai_provider/providers/gemini.py` should wrap Gemini PCM audio bytes into a `data:audio/wav;base64,...` URL or persist the WAV bytes through storage before exposing a URL.
- `backend/app/core/config.py` should keep provider config centralized, including `GEMINI_TTS_MODEL` and `GEMINI_TTS_VOICE`.
- `backend/app/service/ai_provider/service.py` should expose a provider-neutral `generate_audio()` that receives narration text and returns page-level audio references.
- `creation` should pass each storyboard page's `narration_text`, falling back to page body text when appropriate.
- Production storage should prefer generated files in OSS or another storage backend instead of long-lived data URLs.

## Boundaries

- Gemini TTS does not create story, storyboard, book, or asset business records by itself.
- `ai_provider` may call the Gemini SDK and record provider calls, but ownership of generated audio references remains with `creation` / `book` / `asset-storage` depending on persistence strategy.
