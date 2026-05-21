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
