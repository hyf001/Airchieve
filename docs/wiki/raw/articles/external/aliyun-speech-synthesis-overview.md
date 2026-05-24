---
source_url: https://help.aliyun.com/zh/isi/developer-reference/overview-of-speech-synthesis
ingested: 2026-05-24
sha256: 5ec899b34854ac2ecd1ff1eb2588ca3bbc9df0b3bfdd323dde7b4e8b1f116d87
---

# Aliyun Speech Synthesis Overview

## Source

- Official source: Alibaba Cloud Intelligent Speech Interaction, speech synthesis overview and voice list.
- Retrieved: 2026-05-24.
- Scope captured for AIrchieve: voice selection, multi-emotion voice support, and SSML emotion implications.

## Key Contract

- Aliyun speech synthesis uses provider voice ids such as `xiaoyun`, `xiaogang`, `aixia`, `aiqi`, `aijia`, `aicheng`, `aida`, `siyue`, and `aiya` for standard voices.
- The official voice list includes multi-emotion voices such as `zhimiao_emo`, `zhimi_emo`, and `zhiyan_emo`.
- Multi-emotion voices are distinct voice ids. Selecting a multi-emotion voice does not by itself choose a specific emotion for every sentence.
- Captured emotion categories for current AIrchieve seed set:
  - `zhimiao_emo`: `serious`, `sad`, `disgust`, `jealousy`, `embarrassed`, `happy`, `fear`, `surprise`, `neutral`, `frustrated`, `affectionate`, `gentle`, `angry`, `newscast`, `customer-service`, `story`, `living`.
  - `zhimi_emo`: `angry`, `fear`, `happy`, `hate`, `neutral`, `sad`, `surprise`.
  - `zhiyan_emo`: `neutral`, `happy`, `angry`, `sad`, `fear`, `hate`, `surprise`, `arousal`.
- Emotion control is expressed in synthesis text through Aliyun SSML emotion tags such as `ssml-emotion`, according to the official documentation.
- Voice ids are provider-specific stable codes and should be stored separately from user-facing labels.

## AIrchieve Implementation Notes

- System voices in `voices` should use `voice_style_code` as the Aliyun provider voice id, for example `zhimiao_emo` or `aiqi`.
- `creation.voice_ref` should copy the selected voice's provider voice id into `provider_voice_id` when the user chooses a system voice.
- `ai_provider.generate_audio()` should pass `voice_ref.provider_voice_id` to the Aliyun provider and should not use a global `ALIYUN_TTS_VOICE` default.
- `taxonomy:voice_style` can seed Aliyun voice codes and labels for admin selection. Multi-emotion entries should include metadata such as `provider=aliyun` and an explicit `supported_emotions` list.
- Admin UI should prefer a controlled select of official Aliyun voice ids over free-text provider voice input.

## TODO

- Add SSML emotion generation for multi-emotion voices. The provider must only inject `ssml-emotion` when the selected voice metadata has the target emotion in `supported_emotions`.
- Define an emotion mapping from story/page/dialogue intent to Aliyun supported emotion labels, with safe fallback to neutral narration.
- Decide where emotion intent lives: storyboard page metadata, dialogue marks, or provider-only prompt-derived hints.
- Generate or upload short sample audio for seeded system voices so parents can preview voices before use.
- Add validation that system `voice_style_code` values are among the supported Aliyun voice ids or a controlled admin taxonomy entry.
- Re-check the official voice list periodically because Aliyun can add, rename, or deprecate voices.

## Boundaries

- `taxonomy` provides voice-code options and labels, but does not call the provider.
- `asset-storage` owns system voice records, sample audio, and visibility/access level.
- `creation` records the selected voice reference; `ai_provider` performs synthesis.
