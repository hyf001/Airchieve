---
source_url: https://www.volcengine.com/docs/82379/1829186?lang=zh
ingested: 2026-06-10
sha256: e0c866e68fb77af5de01adb4fa9c0057795d3d0b167ff460c3799c16709c4771
---

# Volcengine Seedream 4.0-5.0 Image Prompting

## Source

- Official source: Volcengine Ark, Seedream 4.0-5.0 prompt guide.
- Retrieved: 2026-06-10.
- Source page last updated by Volcengine: 2026-05-11 17:10:19.
- Scope captured for AIrchieve: image prompt structure for text-to-image, image reference generation, image editing, multi-image input, and multi-image output in `ai_provider.generate_image()`.

## Key Prompting Rules

- Seedream 5.0 lite, 4.5, and 4.0 support text-to-image, image editing, reference-image generation, and grouped image generation.
- Prefer concise, coherent natural language over keyword piles.
- The core text-to-image description should name the subject, action, and environment.
- Add aesthetic requirements only when useful: style, color palette, lighting, composition, material, or lens language.
- When the image has a product or application context, include the intended use and image type instead of describing only isolated objects.
- For style control, use precise style terms or provide a reference image.
- When the prompt intentionally asks the model to render text, put the exact text in quotation marks.
- For image editing, name the target object and the requested operation directly. Avoid vague pronouns.
- When editing should preserve most of the source image, explicitly say which parts remain unchanged.

## Text-to-Image Notes

- Clear natural-language descriptions are the default path for Seedream.
- Detailed prompts are useful for high-density scenes because they can specify object layout, quantities, visible attributes, background, and lighting.
- The guide emphasizes that Seedream 5.0 lite, 4.5, and 4.0 usually perform better with concise, precise prompts than with repeated ornate adjectives.
- For knowledge-heavy images such as diagrams, formulas, charts, or teaching illustrations, include accurate domain terms and state the desired visualization format, layout, and style.

## Image Editing Notes

- Supported edit intents include add, remove, replace, and modify.
- The prompt should identify the exact object and the exact transformation.
- For replacement or modification, specify what must be preserved, such as pose, expression, layout, or surrounding style.
- When text alone is insufficient to identify the edit target, visual signals such as arrows, outlines, or marked regions can be used.

## Reference-Image Generation Notes

- Seedream can extract key information from reference images, including character appearance, art style, product features, material, or clothing style.
- The prompt should include two parts:
  - what to extract and preserve from the reference image;
  - what new image, scene, pose, product, or output format to generate.
- For AIrchieve character images, the prompt should say that the supplied image is a character reference and name the features to preserve, such as identity, facial features, hairstyle, clothing, and overall illustration style.
- For style references, the prompt should name the source image's style and then describe the target scene or asset set.

## Multi-Image Input Notes

- Seedream supports multiple input images for replacement, combination, and style transfer tasks.
- The prompt should map each input image by order: for example, image 1 supplies the subject, image 2 supplies clothing, and image 3 supplies style.
- For AIrchieve, multi-image prompts should align with the provider request order: character reference images first, then continuity/page reference images.
- Each referenced image should have a clear role so the model does not confuse character identity, prior-page continuity, and art-style guidance.

## Multi-Image Output Notes

- Seedream supports generating visually coherent image sequences with consistent characters and style.
- The guide calls out storyboards, comics, IP product sets, and sticker/emote sets as natural grouped-output use cases.
- To trigger grouped output, the prompt should use wording such as a series, a set, a group, or a concrete image count.
- For AIrchieve storybook generation, prompts should explicitly request the exact number of pages and map each output image to a page in order.

## AIrchieve Implementation Notes

- Storyboard `visual_prompt` should be generated as natural language with subject, action, environment, style, color, lighting, and composition.
- Final image prompts should avoid JSON-like dumps where a sentence would be clearer.
- For page generation, include:
  - total output image count and page order;
  - page-specific visible scene;
  - art style and visual continuity;
  - role of each reference image;
  - instruction that dialogue text is context only and must not be rendered into the image.
- For single-page regeneration, say that only the current page should be redrawn and that story rhythm and other pages should not be changed.
- For reference character generation, pass reference images through the provider image input path rather than embedding URLs in the prompt text when the SDK supports image inputs.
- Provider adapters should remain business-agnostic: they submit prompts and images, return image URLs or data URLs, and record provider calls. `creation`, `book`, and `asset-storage` own result persistence and business state.

## Boundaries

- This source is a prompting guide, not an API contract for model endpoint parameters.
- It does not replace AIrchieve module boundaries: prompt construction belongs in `ai_provider` service helpers, provider-specific SDK calls stay inside provider adapters, and generated image ownership remains with business services.
- This source covers Seedream image generation. Seedance video prompting should be ingested separately from the Seedance-specific pages if needed.
