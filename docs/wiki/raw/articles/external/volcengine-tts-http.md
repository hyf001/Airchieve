---
source_url: https://www.volcengine.com/docs/6561/79820?lang=zh
ingested: 2026-05-21
sha256: b28fe01bb339d02086a067f7df2217d6588b8d958d29782f9ed5362d9246991b
---

# Volcengine Doubao Speech HTTP TTS

## Source

- Official source: Volcengine / Doubao Speech, small-model HTTP non-streaming TTS interface.
- Retrieved: 2026-05-21.
- Scope captured for AIrchieve: HTTP non-streaming synthesis contract relevant to `ai_provider.generate_audio()`.

## Key Contract

- Endpoint: `https://openspeech.bytedance.com/api/v1/tts`.
- Authentication uses an HTTP header shaped as `Authorization: Bearer;${token}`.
- Requests use HTTP POST and return JSON.
- Returned audio is base64 encoded because JSON cannot carry raw binary audio directly.
- Each synthesis request must use a unique `reqid`; UUID/GUID style IDs are recommended.
- App credentials and routing values include AppID, Token, and Cluster from the Volcengine console.
- Request payload sections include app identity, user identity, audio configuration such as voice type and encoding, and request text/operation fields.
- The non-streaming API is suitable for one-shot synthesis where the caller waits for the complete audio payload.

## AIrchieve Implementation Notes

- `backend/app/core/config.py` should keep `DOUBAO_TTS_APP_ID`, `DOUBAO_TTS_ACCESS_TOKEN`, `DOUBAO_TTS_CLUSTER`, `DOUBAO_TTS_VOICE_TYPE`, and `DOUBAO_TTS_API_URL`.
- `backend/app/service/ai_provider/providers/doubao.py` should issue HTTP POST requests with `Content-Type: application/json` and `Authorization: Bearer;...`.
- The provider adapter should validate that the response contains decodable base64 before exposing `data:audio/wav;base64,...` or a persisted storage URL.
- `backend/app/service/ai_provider/service.py` should map the provider-specific voice type from `voice_ref` when available, otherwise fall back to configured default voice type.

## Boundaries

- Volcengine TTS returns audio data only; it should not directly create or mutate AIrchieve `BookPage`, `CreationStoryboardPage`, or `Asset` records.
- `generation_task` remains responsible for lifecycle state and retry visibility, not for provider-specific TTS behavior.
