import React from "react";

import { type BookLanguage, type BookPage, type BookPlaybackSegment, type BookSubtitleCue } from "./types";

interface BookPageViewProps {
  page: BookPage;
  textMode: BookLanguage;
  bilingualEnglishFirst: boolean;
  isPlaying: boolean;
  activeSegment?: BookPlaybackSegment | null;
  activeCue?: BookSubtitleCue | null;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  videoSrc?: string | null;
  onVideoTimeUpdate?: (event: React.SyntheticEvent<HTMLVideoElement>) => void;
  onVideoLoadedMetadata?: (event: React.SyntheticEvent<HTMLVideoElement>) => void;
  onVideoEnded?: (event: React.SyntheticEvent<HTMLVideoElement>) => void;
  onVideoError?: (event: React.SyntheticEvent<HTMLVideoElement>) => void;
}

export const BookPageView: React.FC<BookPageViewProps> = ({
  page,
  textMode,
  bilingualEnglishFirst,
  isPlaying,
  activeSegment,
  activeCue,
  videoRef,
  videoSrc,
  onVideoTimeUpdate,
  onVideoLoadedMetadata,
  onVideoEnded,
  onVideoError,
}) => {
  const zh = page.text_zh || "";
  const en = page.text_en || "";
  const playbackSegments = page.playback_segments ?? [];
  const dialogueSegments = playbackSegments.filter((segment) => segment.segment_type === "dialogue");
  const lipSyncCount = playbackSegments.filter((segment) => segment.lip_sync_url || segment.media_mode === "lip_sync").length;
  const soundEffectCount = (page.sound_effects ?? []).length + playbackSegments.reduce((total, segment) => total + segment.sound_effects.length, 0);
  const paragraphs =
    textMode === "bilingual"
      ? bilingualEnglishFirst
        ? [en, zh]
        : [zh, en]
      : [textMode === "en" ? en || zh : zh || en];
  const subtitle = activeCue ? cueText(activeCue, textMode, bilingualEnglishFirst) : "";
  const showVideo = Boolean(videoSrc && activeSegment?.lip_sync_url);

  return (
    <div className="grid grid-cols-[minmax(240px,1fr)_minmax(260px,0.9fr)] gap-5 max-lg:grid-cols-1">
      <div className="relative min-h-[320px] overflow-hidden rounded-[var(--radius-lg)] bg-[linear-gradient(135deg,rgba(126,200,227,0.35),rgba(139,198,168,0.35))]">
        {showVideo ? (
          <video
            ref={videoRef}
            className="h-full min-h-[320px] w-full bg-black object-cover"
            src={videoSrc ?? undefined}
            playsInline
            preload="auto"
            onTimeUpdate={onVideoTimeUpdate}
            onLoadedMetadata={onVideoLoadedMetadata}
            onEnded={onVideoEnded}
            onError={onVideoError}
          />
        ) : page.image_url ? (
          <img className="h-full min-h-[320px] w-full object-cover" src={page.image_url} alt="" />
        ) : (
          <div className="flex min-h-[320px] items-center justify-center p-8 text-center">
            <div>
              <div className="font-display text-4xl text-[var(--text-dark)]">{page.title || `第 ${page.page_no} 页`}</div>
              <p className="mt-4 max-w-xl text-sm text-[var(--text-mid)]">{page.visual_prompt || zh}</p>
            </div>
          </div>
        )}
        <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-[var(--text-mid)]">
          第 {page.page_no} 页
        </span>
        {subtitle ? (
          <div className="absolute inset-x-4 bottom-4 rounded-[var(--radius-md)] bg-white/90 px-4 py-3 text-center text-base font-bold leading-7 text-[var(--text-dark)] shadow-[var(--shadow-soft)]">
            {activeCue?.speaker_ref ? <span className="mr-2 text-[var(--sky-deep)]">{activeCue.speaker_ref}</span> : null}
            {subtitle}
          </div>
        ) : null}
      </div>

      <div className="app-card flex min-h-[320px] flex-col justify-center p-6">
        {page.title ? <h2 className="font-display mb-4 text-2xl text-[var(--text-dark)]">{page.title}</h2> : null}
        <div className="space-y-4">
          {paragraphs.filter(Boolean).map((text) => (
            <p
              key={text}
              className={
                isPlaying
                  ? "rounded-[var(--radius-md)] bg-[rgba(245,166,35,0.12)] px-4 py-3 text-lg font-semibold leading-8 text-[var(--text-dark)]"
                  : "px-4 py-3 text-lg font-semibold leading-8 text-[var(--text-dark)]"
              }
            >
              {text}
            </p>
          ))}
        </div>
        {dialogueSegments.length > 0 ? (
          <div className="mt-5 space-y-2">
            {dialogueSegments.map((segment) => (
              <DialogueSegment key={segment.id} segment={segment} textMode={textMode} active={segment.id === activeSegment?.id} />
            ))}
          </div>
        ) : null}
        {lipSyncCount > 0 || soundEffectCount > 0 ? (
          <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold text-[var(--text-light)]">
            {lipSyncCount > 0 ? <span className="rounded-full bg-[rgba(94,160,122,0.1)] px-2.5 py-1 text-[var(--sage-deep)]">对口型 {lipSyncCount} 段</span> : null}
            {soundEffectCount > 0 ? <span className="rounded-full bg-[rgba(126,200,227,0.12)] px-2.5 py-1 text-[var(--sky-deep)]">音效 {soundEffectCount} 个</span> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
};

const DialogueSegment: React.FC<{ segment: BookPlaybackSegment; textMode: BookLanguage; active: boolean }> = ({ segment, textMode, active }) => {
  const cue = preferredCue(segment.subtitle_cues, textMode);
  const text = cueText(cue, textMode, false);
  if (!text) return null;

  return (
    <div
      className={
        active
          ? "rounded-[var(--radius-sm)] bg-[rgba(245,166,35,0.16)] px-3 py-2 text-sm ring-2 ring-[rgba(212,114,92,0.24)]"
          : "rounded-[var(--radius-sm)] bg-[rgba(126,200,227,0.12)] px-3 py-2 text-sm"
      }
    >
      {segment.speaker_ref ? <span className="font-bold text-[var(--sky-deep)]">{segment.speaker_ref}</span> : null}
      <span className={segment.speaker_ref ? "ml-2 text-[var(--text-mid)]" : "text-[var(--text-mid)]"}>{text}</span>
      {segment.lip_sync_url || segment.media_mode === "lip_sync" ? <span className="ml-2 text-xs font-bold text-[var(--sage-deep)]">对口型</span> : null}
    </div>
  );
};

const preferredCue = (cues: BookSubtitleCue[], textMode: BookLanguage): BookSubtitleCue | null => {
  if (!cues.length) return null;
  if (textMode === "en") {
    return cues.find((cue) => cue.text_en) ?? cues[0];
  }
  return cues.find((cue) => cue.text_zh) ?? cues[0];
};

const cueText = (cue: BookSubtitleCue | null, textMode: BookLanguage, bilingualEnglishFirst: boolean): string => {
  if (!cue) return "";
  if (textMode === "en") return cue.text_en || cue.text_zh || "";
  if (textMode === "bilingual" && cue.text_en && cue.text_zh) {
    return bilingualEnglishFirst ? `${cue.text_en} / ${cue.text_zh}` : `${cue.text_zh} / ${cue.text_en}`;
  }
  return cue.text_zh || cue.text_en || "";
};
