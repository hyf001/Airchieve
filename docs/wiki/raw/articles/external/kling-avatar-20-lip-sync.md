---
source_url: https://kling.ai/quickstart/kling-ai-avatar-2-user-guide
ingested: 2026-05-21
sha256: 7fa88738e853a4d49ec9081b5141d3a8cbdcb99e06107cf5bb8643180a843d6a
---

# Kling Avatar 2.0 Lip Sync Source Note

## Scope

- Source type: official Kling AI Avatar 2.0 user guide plus implementation-facing API notes from a Kling Avatar 2.0 compatible API reference.
- Captured for AIrchieve: image-plus-audio avatar video generation for `ai_provider.generate_lip_sync()`.
- This note records the integration contract and implementation implications; it does not copy complete vendor documentation.

## Key Product Facts

- Kling Avatar 2.0 generates lifelike dynamic avatar videos from a character image, speech content, and an optional avatar performance prompt.
- The character image acts as the avatar image and start frame.
- Speech content can come from uploaded audio or TTS-generated audio.
- The prompt can describe facial expressions, emotions, gestures, and action style.
- Official product materials emphasize long-content coverage, expressive motion, strong hand/action quality, lip sync, multiple character types, and multilingual examples.

## API Contract Used By AIrchieve

- Provider family: Kling Avatar 2.0 compatible async generation API.
- Submit endpoint shape: `POST /api/generate/submit`
- Status endpoint shape: `GET /api/generate/status/{task_id}`
- Authentication: Bearer API key.
- Model identifiers:
  - `kling-avatar-2.0/standard`
  - `kling-avatar-2.0/pro`
- Submit body:
  - `model`: one of the Avatar 2.0 model identifiers.
  - `input.image_urls`: array with exactly one reference image URL; `image_urls[0]` is used as the avatar image.
  - `input.audio_url`: driving audio URL.
  - `input.prompt`: optional performance prompt.
  - `callback_url`: optional webhook URL.
- Submit response returns a `task_id`.
- Poll response returns a status such as `not_started`, `running`, `finished`, or `failed`.
- Finished tasks expose generated media through a `files` array; the video result is the item whose `file_type` is `video`.

## Input Constraints

- The avatar image must be available through an HTTP or HTTPS URL.
- The driving audio must be available through an HTTP or HTTPS URL.
- The compatible API reference states that exactly one image is supported.
- The compatible API reference states that driving audio duration should be between 2 and 60 seconds, and audio should be 5 MB or less if the file size can be detected before submission.

## AIrchieve Implementation Notes

- `ai_provider.generate_lip_sync()` should remain provider-neutral and receive page-level `image_url`, `audio_url`, and an optional prompt derived from page content.
- If upstream image or audio generation returns `data:` URLs, `creation` should persist them through [[asset-storage]] before calling Avatar 2.0.
- The generated video URL should be written back to `CreationStoryboardPage.lip_sync_url`; when saving a book, this can populate `BookPage.video_url` and mark `lip_sync_status` as ready.
- Vendor result URLs are temporary in many media APIs, so production storage should persist the generated MP4 before exposing it as durable book media.
- For AIrchieve, Avatar 2.0 is the retained image-plus-audio lip-sync path.

## Boundaries

- Kling Avatar 2.0 does not own AIrchieve `CreationSession`, `CreationStoryboardPage`, `BookPage`, or `Asset` records.
- The provider returns generated media references; ownership, persistence, moderation, and player payload assembly remain in `creation`, `asset-storage`, and `book`.
