---
source_url: https://help.aliyun.com/zh/isi/developer-reference/sdk-for-python-1
ingested: 2026-05-24
sha256: 92dee210d4ad53eb6d1c9425e8b2983552ecaafc1472affdcee2f3448f18a8f7
---

# Aliyun NLS Python SDK Speech Synthesis

## Source

- Official source: Alibaba Cloud Intelligent Speech Interaction, Python SDK usage for speech synthesis.
- Retrieved: 2026-05-24.
- Scope captured for AIrchieve: SDK adapter contract relevant to `ai_provider.generate_audio()`.

## Key Contract

- The Python SDK exposes `nls.NlsSpeechSynthesizer` for speech synthesis.
- Authentication requires an AppKey and a token. The SDK also exposes `nls.token.getToken(akid, aksecret, domain, url)` for requesting an NLS token from AccessKey credentials.
- The websocket endpoint used by the SDK defaults to `wss://nls-gateway.cn-shanghai.aliyuncs.com/ws/v1`.
- `NlsSpeechSynthesizer.start()` accepts synthesis parameters including `text`, `voice`, `aformat`, `sample_rate`, `volume`, `speech_rate`, `pitch_rate`, `wait_complete`, `start_timeout`, and `completed_timeout`.
- Audio bytes are delivered via the `on_data` callback. Completion and failure are delivered through completion/error callbacks.
- For a synchronous worker-side adapter, `wait_complete=True` lets the provider call block until synthesis completes, while the async service can run the SDK call in a thread executor.

## AIrchieve Implementation Notes

- `backend/app/service/ai_provider/providers/aliyun.py` should keep all Aliyun SDK usage inside the provider adapter, not inside `creation` or `generation_task`.
- `backend/app/core/config.py` should keep credentials and SDK-level knobs centralized: AppKey, token or AccessKey credentials, gateway URL, output format, sample rate, volume, speech rate, pitch rate, timeout values, and long-text mode.
- `ALIYUN_TTS_TOKEN` may be configured directly. If it is absent, the provider can call `nls.token.getToken()` using `ALIYUN_TTS_ACCESS_KEY_ID` and `ALIYUN_TTS_ACCESS_KEY_SECRET`.
- The provider should collect callback audio bytes, base64 encode the complete audio, and return a provider-neutral `data:audio/...;base64,...` reference or persist the bytes through storage.
- The provider adapter should map SDK/connection failures into `AiProviderError` with stable error codes for worker failure reporting.

## Boundaries

- The Aliyun SDK returns audio bytes only. It should not create or mutate `CreationStoryboardPage`, `BookPage`, `Voice`, or `Asset` records directly.
- `generation_task` remains responsible for lifecycle, retries, and failure visibility.
- `asset-storage` owns system voice records and their `voice_style_code`; `ai_provider` consumes the selected provider voice id.
