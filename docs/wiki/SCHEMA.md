# Wiki Schema

## Domain
AIrchieve 绘本网站项目 — 面向儿童阅读的绘本 Web 平台，涵盖绘本播放、创作生成、��材管理、会员权益、分享导出、后台运营等全部业务模块的技术设计文档。

## Conventions
- File names: lowercase, hyphens, no spaces (e.g., `book-player-reading.md`)
- Every wiki page starts with YAML frontmatter (see below)
- Use `[[wikilinks]]` to link between pages (minimum 2 outbound links per page)
- When updating a page, always bump the `updated` date
- Every new page must be added to `index.md` under the correct section
- Every action must be appended to `log.md`
- The wiki must be lossless with respect to source documents: complete source text lives in `raw/`, while entity/concept pages organize, summarize, and cross-reference it.
- Do not replace detailed source facts with summaries only. If a detail is omitted from a layer-2 page, the page must link to a complete raw source that contains it.

## Frontmatter
```yaml
---
title: Page Title
created: YYYY-MM-DD
updated: YYYY-MM-DD
type: entity | concept | comparison | query | summary
tags: [from taxonomy below]
sources: [raw/articles/source-name.md]
---
```

## Raw Source Layout
- `raw/articles/module-design.md` — complete module design overview.
- `raw/articles/module-design/*.md` — complete detailed module design files.
- `raw/articles/picture-book-website-prd.md` — complete PRD and acceptance criteria.
- `raw/articles/external-dependencies.md` — complete external dependency notes.
- `raw/prototypes/*.html` — complete frontend HTML prototypes preserved as original HTML files.
- `raw/prototypes/manifest.md` — source URL, ingestion date, and sha256 metadata for frontend HTML prototypes.

## Tag Taxonomy
- Core Domain: story, book, template, book-player, creation, generation-task
- Assets: character, voice, art-style, asset, storage
- User: account, child-profile, auth, privacy
- Business: membership, entitlement, payment, share, export
- Platform: admin, moderation, audit, analytics, domain-event, taxonomy, recommendation, discovery
- Architecture: module-design, api, frontend, backend, database, collaboration

## Page Thresholds
- **Create a page** when a module or concept has dedicated design documentation
- **Add to existing page** when information extends an existing module's scope
- **DON'T create a page** for passing mentions or minor details
- **Split a page** when it exceeds ~200 lines

## Entity Pages
One page per business module. Include:
- Overview / what it is
- What the module does not own
- Frontend and backend module mapping
- Data ownership
- Public API, service, DTO, and event contracts
- Dependencies and downstream consumers
- Key business rules, permission rules, privacy/audit requirements
- Cross-references to other modules
- Source references

Entity pages should follow [[module-contract-standard]]. They may summarize detailed fields, but must link to complete raw sources for full API, schema, service, and database details.

## Concept Pages
One page per cross-cutting concept. Include:
- Definition / explanation
- Related modules
- Source references

## Update Policy
When new information conflicts with existing content:
1. Check the dates — newer sources generally supersede older ones
2. If genuinely contradictory, note both positions with dates and sources
3. Mark the contradiction in frontmatter
