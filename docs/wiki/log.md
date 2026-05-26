# Wiki Log

> Chronological record of all wiki actions. Append-only.
> Format: `## [YYYY-MM-DD] action | subject`

## [2026-05-19] create | Wiki initialized
- Domain: AIrchieve 绘本网站项目
- Structure created with SCHEMA.md, index.md, log.md

## [2026-05-19] ingest | docs/ 目录批量导入
- Sources: module-design.md, picture-book-website-prd.md, 系统外依赖.md, 13 module-design/*.md
- Created 3 concept pages: project-overview, architecture-and-layers, collaboration-groups
- Created 13 entity pages: account-profile, membership-payment, discovery-recommendation, taxonomy, story-library, book-player-reading, template, asset-storage, creation-generation, share-export-privacy, moderation-audit, analytics-domain-event, admin
- All pages cross-referenced with [[wikilinks]]
- index.md updated with 16 total pages

## [2026-05-20] lint | docs/wiki 替代性检查
- Checked wiki structure, raw source capture, module-design coverage, frontend coverage, and PRD story coverage.
- Result: wiki is usable as a high-level navigation/summary layer, but cannot fully replace docs/module-design, docs/frontend/frontend implementation, or docs/picture-book-website-prd.md yet.
- Main gaps: raw sources are placeholders with sha256 pending; detailed API endpoints/contracts/database schemas are mostly summarized away; PRD acceptance criteria and frontend implementation/prototype details are not fully preserved.

## [2026-05-20] ingest | 无损 raw 来源补全
- Replaced placeholder raw files with complete source text and real sha256 frontmatter.
- Added complete raw copies for 14 module design files, 1 PRD file, 1 external dependency file, and 12 frontend HTML prototypes.
- Updated all entity pages to point to `raw/articles/module-design/*.md` detailed sources and mark 2026-05-20 updates.
- Added concept pages: product-requirements, frontend-prototypes, source-inventory.
- Updated SCHEMA.md with lossless wiki policy and raw source layout.
- Lint result: 19 indexed pages, 29 raw files, no broken wikilinks, no index omissions, no sha256 issues.

## [2026-05-20] update | 前端原型 raw 元数据分离
- Replaced `raw/prototypes/*.html.md` wrappers with original `raw/prototypes/*.html` files.
- Added `raw/prototypes/manifest.md` to track source paths, ingestion date, and sha256 for each HTML prototype.
- Updated SCHEMA.md, frontend-prototypes, and source-inventory to reference the separated HTML + manifest layout.

## [2026-05-20] update | 模块化设计知识库改造
- Added module-contract-standard to define required module page sections, data ownership, public contracts, dependencies, and source references.
- Added module-dependency-matrix with layered module map, dependency rules, shared capability owners, and review checks.
- Reworked index.md from a flat page list into a start-here section plus layered module map.
- Expanded product-requirements with Story owner modules, collaboration modules, and requirement tracing rules.
- Expanded collaboration-groups with parallel development phases, mock strategy, and cross-group review points.
- Updated SCHEMA.md, architecture-and-layers, and source-inventory to reference the modular contract and dependency pages.
- Lint result: 21 indexed pages, no broken wikilinks, no index omissions, no frontmatter issues, HTML manifest sha256 checks pass.

## [2026-05-21] ingest | TTS provider official references
- Added external raw source notes for Gemini Text-to-Speech generation and Volcengine / Doubao HTTP non-streaming TTS.
- Updated creation-generation with provider-neutral audio generation implementation notes and links to the two new raw references.
- Updated source-inventory to include `raw/articles/external/*.md` supplier reference notes.
## [2026-05-21] ingest | Kling Avatar 2.0 lip-sync reference

- Removed the previous external source note for the earlier lip-sync provider path.
- Added `raw/articles/external/kling-avatar-20-lip-sync.md` from Kling Avatar 2.0 product documentation and a compatible API reference.
- Updated `entities/creation-generation.md` so the retained lip-sync provider path is Kling Avatar 2.0 image-plus-audio generation.
- Updated `concepts/source-inventory.md` with the new external raw source and removed the previous lip-sync source entry.

## [2026-05-23] ingest | Generation task execution design

- Moved `docs/generation-task-execution-design.md` into `raw/articles/generation-task-execution-design.md` with sha256 metadata.
- Created `concepts/generation-task-execution.md` as the structured wiki page for worker claim, handler dispatch, task lifecycle, retry, and task type execution rules.
- Updated `entities/creation-generation.md`, `concepts/source-inventory.md`, `SCHEMA.md`, and `index.md` to reference the new raw source and concept page.

## [2026-05-24] ingest | Aliyun TTS provider references

- Added `raw/articles/external/aliyun-nls-python-sdk-tts.md` for Aliyun NLS Python SDK synthesis integration.
- Added `raw/articles/external/aliyun-speech-synthesis-overview.md` for Aliyun voice ids, multi-emotion voices, and SSML emotion implications.
- Updated `entities/creation-generation.md` with Aliyun provider mapping and TODOs for multi-emotion SSML and persistent audio storage.
- Updated `entities/asset-storage.md` with system voice `voice_style_code` ownership and TODOs for sample audio and validation.
- Updated `entities/taxonomy.md` with Aliyun voice_style semantics and TODOs for metadata schema and periodic voice-list review.
- Updated `concepts/source-inventory.md` and `index.md`.

## [2026-05-25] update | Book player media track clarification

- Updated `entities/book-player-reading.md` with playback segment rules for narrator/reading clips versus character dialogue clips.
- Clarified that narrator clips use page image URL + narration audio URL + background music, while character dialogue clips use lip-sync URL + dialogue audio URL + background music.
- Clarified that playable book media stores URL contracts for image, audio, and lip-sync results rather than asset ids.
- Updated `concepts/generation-task-execution.md` so lip-sync task output is described as a URL.
- Added subtitle-track requirements for narrator and dialogue text across Chinese, English, and bilingual display modes.
- Added design rules for seamless video-like playback using a unified page timeline, preloading, transitions, audio mixing, and subtitle cue synchronization.
