import React from "react";
import {
  BookOpenCheck,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  Volume2,
  VolumeX,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  BookPageView,
  CoReadingPrompts,
  LearningCards,
  type BookLanguage,
  type BookPage,
  type BookPlaybackSegment,
  type BookPlayerPayload,
  type BookSoundEffectCue,
  type BookSubtitleCue,
  type BookVoiceOption,
} from "@/entities/book";
import { FavoriteButton, readingApi, type ReadingMode } from "@/features/reading";
import { useAuth } from "@/features/auth";
import { ReportContentDialog } from "@/features/moderation";
import { useProfiles } from "@/features/profile-management";
import { VoiceSwitcher } from "./VoiceSwitcher";

interface BookPlayerProps {
  payload: BookPlayerPayload;
  readonly?: boolean;
}

interface TimelineSegment {
  segment: BookPlaybackSegment;
  mediaUrl: string | null;
  durationMs: number;
  cues: BookSubtitleCue[];
  soundEffects: BookSoundEffectCue[];
}

const speedOptions = [
  { label: "慢", value: 0.85 },
  { label: "正常", value: 1 },
  { label: "快", value: 1.2 },
];

const DEFAULT_SEGMENT_DURATION_MS = 5000;

export const BookPlayer: React.FC<BookPlayerProps> = ({ payload, readonly = false }) => {
  const { isAuthenticated } = useAuth();
  const { currentProfile } = useProfiles();
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const musicRef = React.useRef<HTMLAudioElement | null>(null);
  const soundEffectRefs = React.useRef<Map<string, HTMLAudioElement>>(new Map());
  const playedSoundEffectKeysRef = React.useRef<Set<string>>(new Set());
  const lastSavedAtRef = React.useRef(0);
  const pendingSeekMsRef = React.useRef<number | null>(null);
  const restoredProgressRef = React.useRef(false);
  const isPlayingRef = React.useRef(false);
  const activeSegmentRef = React.useRef<TimelineSegment | null>(null);
  const handleSegmentEndedRef = React.useRef<() => void>(() => undefined);
  const seekPreviewMsRef = React.useRef<number | null>(null);
  const wasPlayingBeforeSeekRef = React.useRef(false);
  const isSeekingRef = React.useRef(false);
  const seekCommittedRef = React.useRef(false);

  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [currentSegmentIndex, setCurrentSegmentIndex] = React.useState(0);
  const [segmentPositionMs, setSegmentPositionMs] = React.useState(0);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [textMode, setTextMode] = React.useState<BookLanguage>(payload.default_text_mode);
  const [bilingualEnglishFirst, setBilingualEnglishFirst] = React.useState(false);
  const [readingMode, setReadingMode] = React.useState<ReadingMode>("auto");
  const [speed, setSpeed] = React.useState(1);
  const [musicEnabled, setMusicEnabled] = React.useState(true);
  const [soundEnabled, setSoundEnabled] = React.useState(true);
  const [voice, setVoice] = React.useState<BookVoiceOption | null>(payload.default_voice ?? payload.voice_options[0] ?? null);
  const [mediaError, setMediaError] = React.useState<string | null>(null);
  const [measuredDurations, setMeasuredDurations] = React.useState<Record<number, number>>({});
  const [videoFallbackSegmentIds, setVideoFallbackSegmentIds] = React.useState<Set<number>>(() => new Set());
  const [isSeeking, setIsSeeking] = React.useState(false);
  const [seekPreviewMs, setSeekPreviewMs] = React.useState<number | null>(null);

  const childProfileId = currentProfile?.id ?? null;
  const page = payload.pages[currentIndex] ?? payload.pages[0];
  const pageSegments = React.useMemo(() => (page ? buildPageTimeline(page, measuredDurations) : []), [measuredDurations, page]);
  const activeSegment = pageSegments[currentSegmentIndex] ?? pageSegments[0] ?? null;
  const activeCue = React.useMemo(() => findActiveCue(activeSegment, segmentPositionMs), [activeSegment, segmentPositionMs]);
  const pagePositionMs = React.useMemo(() => {
    return pageSegments.slice(0, currentSegmentIndex).reduce((total, item) => total + item.durationMs, 0) + segmentPositionMs;
  }, [currentSegmentIndex, pageSegments, segmentPositionMs]);
  const totalDurationMs = React.useMemo(() => {
    const estimated = payload.pages.reduce((total, item) => total + estimatePageDurationMs(item, measuredDurations), 0);
    return estimated > 0 ? estimated : Math.max(payload.book.duration_seconds * 1000, DEFAULT_SEGMENT_DURATION_MS);
  }, [measuredDurations, payload.book.duration_seconds, payload.pages]);
  const elapsedBeforePageMs = React.useMemo(() => {
    return payload.pages.slice(0, currentIndex).reduce((total, item) => total + estimatePageDurationMs(item, measuredDurations), 0);
  }, [currentIndex, measuredDurations, payload.pages]);
  const overallPositionMs = elapsedBeforePageMs + pagePositionMs;
  const displayedPositionMs = seekPreviewMs ?? overallPositionMs;
  const progressPercent = totalDurationMs > 0 ? Math.min(100, Math.round((displayedPositionMs / totalDurationMs) * 100)) : 0;
  const activeMediaKind = activeSegment?.segment.lip_sync_url && !videoFallbackSegmentIds.has(activeSegment.segment.id) ? "video" : "audio";
  const activeAudioSrc = activeMediaKind === "audio" ? activeSegment?.segment.audio_url ?? null : null;
  const activeVideoSrc = activeMediaKind === "video" ? activeSegment?.segment.lip_sync_url ?? null : null;
  const activeMediaSrc = activeMediaKind === "video" ? activeVideoSrc : activeAudioSrc;
  const nextSegment = pageSegments[currentSegmentIndex + 1] ?? null;

  const saveProgress = React.useCallback(
    async (nextIndex: number, positionMs: number, completed = false) => {
      if (!isAuthenticated || readonly) return;
      try {
        await readingApi.saveProgress(payload.book.id, {
          child_profile_id: childProfileId,
          current_page_no: payload.pages[nextIndex]?.page_no ?? 1,
          current_position_ms: Math.max(0, Math.round(positionMs)),
          progress_percent: completed ? 100 : progressPercent,
          mode: readingMode,
          text_mode: textMode,
          voice_id: voice?.id ?? null,
          completed,
        });
      } catch {
        // Progress is helpful, but playback should not be blocked by a failed sync.
      }
    },
    [childProfileId, isAuthenticated, payload.book.id, payload.pages, progressPercent, readingMode, readonly, textMode, voice?.id],
  );

  const recordEvent = React.useCallback(
    (eventType: "play_start" | "page_view" | "pause" | "resume" | "complete" | "replay") => {
      return readingApi
        .recordEvent({
          book_id: payload.book.id,
          child_profile_id: childProfileId,
          event_type: eventType,
          page_no: page?.page_no,
          position_ms: Math.round(pagePositionMs),
          payload: { readonly, mode: readingMode, text_mode: textMode, speed },
        })
        .catch(() => undefined);
    },
    [childProfileId, page?.page_no, pagePositionMs, payload.book.id, readingMode, readonly, speed, textMode],
  );

  const seekCurrentMedia = React.useCallback(
    (positionMs: number) => {
      const media = activeMediaKind === "video" ? videoRef.current : audioRef.current;
      if (media) media.currentTime = Math.max(0, positionMs) / 1000;
      setSegmentPositionMs(Math.max(0, positionMs));
    },
    [activeMediaKind],
  );

  const goToPage = React.useCallback(
    (nextIndex: number, shouldPlay = isPlaying) => {
      const bounded = Math.min(Math.max(nextIndex, 0), payload.pages.length - 1);
      setCurrentIndex(bounded);
      setCurrentSegmentIndex(0);
      setSegmentPositionMs(0);
      setIsPlaying(shouldPlay);
      void saveProgress(bounded, 0, bounded === payload.pages.length - 1 && !shouldPlay);
    },
    [isPlaying, payload.pages.length, saveProgress],
  );

  const seekToPagePosition = React.useCallback(
    (pageIndex: number, positionMs: number, shouldPlay = isPlaying) => {
      const targetPage = payload.pages[pageIndex];
      if (!targetPage) return;
      const targetSegments = buildPageTimeline(targetPage, measuredDurations);
      const resolved = resolveSegmentPosition(targetSegments, positionMs);
      pendingSeekMsRef.current = resolved.segmentPositionMs;
      playedSoundEffectKeysRef.current.clear();
      if (pageIndex === currentIndex && resolved.segmentIndex === currentSegmentIndex) {
        pendingSeekMsRef.current = null;
        seekCurrentMedia(resolved.segmentPositionMs);
      }
      setCurrentIndex(pageIndex);
      setCurrentSegmentIndex(resolved.segmentIndex);
      setSegmentPositionMs(resolved.segmentPositionMs);
      setIsPlaying(shouldPlay);
      void saveProgress(pageIndex, positionMs);
    },
    [currentIndex, currentSegmentIndex, isPlaying, measuredDurations, payload.pages, saveProgress, seekCurrentMedia],
  );

  const seekToOverallPosition = React.useCallback(
    (positionMs: number, shouldPlay = isPlaying) => {
      const resolved = resolveBookPosition(payload.pages, positionMs, measuredDurations);
      seekToPagePosition(resolved.pageIndex, resolved.pagePositionMs, shouldPlay);
    },
    [isPlaying, measuredDurations, payload.pages, seekToPagePosition],
  );

  const handleSegmentEnded = React.useCallback(() => {
    if (!activeSegment) return;
    if (currentSegmentIndex < pageSegments.length - 1) {
      setCurrentSegmentIndex((value) => value + 1);
      setSegmentPositionMs(0);
      return;
    }
    const isLastPage = currentIndex >= payload.pages.length - 1;
    void saveProgress(currentIndex, estimatePageDurationMs(page, measuredDurations), isLastPage);
    if (isLastPage) {
      setIsPlaying(false);
      setSegmentPositionMs(activeSegment.durationMs);
      void recordEvent("complete");
      return;
    }
    if (readingMode === "auto") {
      goToPage(currentIndex + 1, true);
    } else {
      setIsPlaying(false);
    }
  }, [activeSegment, currentIndex, currentSegmentIndex, goToPage, measuredDurations, page, pageSegments.length, payload.pages.length, readingMode, recordEvent, saveProgress]);

  React.useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  React.useEffect(() => {
    activeSegmentRef.current = activeSegment;
  }, [activeSegment]);

  React.useEffect(() => {
    handleSegmentEndedRef.current = handleSegmentEnded;
  }, [handleSegmentEnded]);

  React.useEffect(() => {
    void readingApi
      .recordEvent({
        book_id: payload.book.id,
        child_profile_id: childProfileId,
        event_type: "page_view",
        page_no: page?.page_no,
        payload: { readonly },
      })
      .catch(() => undefined);
  }, [childProfileId, page?.page_no, payload.book.id, readonly]);

  React.useEffect(() => {
    playedSoundEffectKeysRef.current.clear();
    setMediaError(null);
  }, [activeSegment?.segment.id]);

  React.useEffect(() => {
    const audio = audioRef.current;
    const video = videoRef.current;
    if (audio) audio.playbackRate = speed;
    if (video) video.playbackRate = speed;
  }, [speed, activeMediaKind]);

  React.useEffect(() => {
    const music = musicRef.current;
    if (!music) return;
    if (!musicEnabled || !isPlaying) {
      fadeAudioVolume(music, 0, 180);
      music.pause();
      return;
    }
    fadeAudioVolume(music, activeSegment ? 0.18 : 0.35, 220);
    void music.play().catch(() => undefined);
  }, [activeSegment, isPlaying, musicEnabled]);

  React.useEffect(() => {
    const audio = audioRef.current;
    const video = videoRef.current;
    const seekSeconds = (pendingSeekMsRef.current ?? 0) / 1000;
    audio?.pause();
    video?.pause();
    setSegmentPositionMs(pendingSeekMsRef.current ?? 0);
    if (audio) {
      audio.src = activeAudioSrc ?? "";
      audio.currentTime = seekSeconds;
      audio.playbackRate = speed;
    }
    if (video) {
      video.currentTime = seekSeconds;
      video.playbackRate = speed;
    }
    if (!activeMediaSrc) {
      pendingSeekMsRef.current = null;
    }
    if (!isPlayingRef.current) return;
    void playActiveMedia(activeMediaKind, audio, video, activeMediaSrc).catch(() => {
      setMediaError("当前片段暂时无法播放，已跳过。");
      handleSegmentEndedRef.current();
    });
  }, [activeAudioSrc, activeMediaKind, activeMediaSrc, activeSegment?.segment.id, activeVideoSrc]);

  React.useEffect(() => {
    const audio = audioRef.current;
    const video = videoRef.current;
    if (!isPlaying) {
      audio?.pause();
      video?.pause();
      return;
    }
    void playActiveMedia(activeMediaKind, audio, video, activeMediaSrc).catch(() => {
      setMediaError("当前片段暂时无法播放，已跳过。");
      handleSegmentEndedRef.current();
    });
  }, [activeMediaKind, activeMediaSrc, isPlaying]);

  React.useEffect(() => {
    triggerSoundEffects(page, activeSegment, pagePositionMs, segmentPositionMs, soundEnabled, soundEffectRefs.current, playedSoundEffectKeysRef.current);
  }, [activeSegment, page, pagePositionMs, segmentPositionMs, soundEnabled]);

  React.useEffect(() => {
    if (!isPlaying || !activeSegment || activeMediaSrc) return;
    const interval = window.setInterval(() => {
      setSegmentPositionMs((current) => {
        const next = current + 250 * speed;
        if (next >= activeSegment.durationMs) {
          window.clearInterval(interval);
          window.setTimeout(() => handleSegmentEndedRef.current(), 0);
          return activeSegment.durationMs;
        }
        return next;
      });
    }, 250);
    return () => window.clearInterval(interval);
  }, [activeMediaSrc, activeSegment, isPlaying, speed]);

  React.useEffect(() => {
    const mediaUrl = nextSegment?.mediaUrl;
    if (!mediaUrl) return;
    if (nextSegment.segment.lip_sync_url) {
      const video = document.createElement("video");
      video.preload = "auto";
      video.src = mediaUrl;
      return;
    }
    const audio = new Audio(mediaUrl);
    audio.preload = "auto";
  }, [nextSegment]);

  React.useEffect(() => {
    if (!isAuthenticated || readonly || restoredProgressRef.current) return;
    restoredProgressRef.current = true;
    void readingApi
      .getProgress(payload.book.id, childProfileId)
      .then((progress) => {
        if (!progress) return;
        const pageIndex = payload.pages.findIndex((item) => item.page_no === progress.current_page_no);
        if (pageIndex < 0) return;
        setReadingMode(progress.mode);
        setTextMode(progress.text_mode);
        const restoredVoice = payload.voice_options.find((item) => item.id === progress.voice_id);
        if (restoredVoice) setVoice(restoredVoice);
        seekToPagePosition(pageIndex, progress.current_position_ms, false);
      })
      .catch(() => undefined);
  }, [childProfileId, isAuthenticated, payload.book.id, payload.pages, payload.voice_options, readonly, seekToPagePosition]);

  React.useEffect(() => {
    const now = Date.now();
    if (!isPlaying || now - lastSavedAtRef.current < 5000) return;
    lastSavedAtRef.current = now;
    void saveProgress(currentIndex, pagePositionMs);
  }, [currentIndex, isPlaying, pagePositionMs, saveProgress]);

  const isCurrentMediaEvent = React.useCallback(
    (media: HTMLMediaElement | null) => {
      if (!media || !activeMediaSrc) return false;
      const currentSrc = media.currentSrc || media.getAttribute("src") || "";
      try {
        return new URL(currentSrc, window.location.href).href === new URL(activeMediaSrc, window.location.href).href;
      } catch {
        return currentSrc === activeMediaSrc;
      }
    },
    [activeMediaSrc],
  );

  const handleMediaTimeUpdate = (event: React.SyntheticEvent<HTMLMediaElement>) => {
    if (isSeekingRef.current) return;
    const media = event.currentTarget;
    if (!isCurrentMediaEvent(media)) return;
    const nextMs = media ? media.currentTime * 1000 : segmentPositionMs;
    setSegmentPositionMs(Math.min(activeSegment?.durationMs ?? nextMs, Math.max(0, nextMs)));
  };

  const handleMediaLoadedMetadata = (event: React.SyntheticEvent<HTMLMediaElement>) => {
    const media = event.currentTarget;
    if (!isCurrentMediaEvent(media)) return;
    if (media) media.playbackRate = speed;
    if (media && activeSegment && Number.isFinite(media.duration) && media.duration > 0) {
      setMeasuredDurations((current) => ({
        ...current,
        [activeSegment.segment.id]: Math.max(1000, Math.round(media.duration * 1000)),
      }));
    }
    if (media && pendingSeekMsRef.current !== null) {
      media.currentTime = pendingSeekMsRef.current / 1000;
      pendingSeekMsRef.current = null;
    }
    if (isPlaying) {
      void media?.play().catch(() => {
        setMediaError("当前片段暂时无法播放，已跳过。");
        handleSegmentEndedRef.current();
      });
    }
  };

  const handleMediaEnded = (event: React.SyntheticEvent<HTMLMediaElement>) => {
    if (!isCurrentMediaEvent(event.currentTarget)) return;
    handleSegmentEnded();
  };

  const handleMediaError = (kind: "audio" | "video", event: React.SyntheticEvent<HTMLMediaElement>) => {
    if (!isCurrentMediaEvent(event.currentTarget)) return;
    if (kind === "video" && activeSegment?.segment.audio_url) {
      setVideoFallbackSegmentIds((current) => {
        const next = new Set(current);
        next.add(activeSegment.segment.id);
        return next;
      });
      setMediaError("当前对口型视频暂时无法播放，已切换为音频。");
      return;
    }
    setMediaError(kind === "video" ? "当前视频暂时无法播放，已跳过。" : "当前音频暂时无法播放，已跳过。");
    handleSegmentEndedRef.current();
  };

  const handlePlayToggle = async () => {
    const nextPlaying = !isPlaying;
    setIsPlaying(nextPlaying);
    await recordEvent(nextPlaying ? (overallPositionMs > 0 ? "resume" : "play_start") : "pause");
    if (!nextPlaying) void saveProgress(currentIndex, pagePositionMs);
  };

  const handleReplay = () => {
    setCurrentIndex(0);
    setCurrentSegmentIndex(0);
    setSegmentPositionMs(0);
    setIsPlaying(true);
    void recordEvent("replay");
  };

  const handleSeekStart = () => {
    wasPlayingBeforeSeekRef.current = isPlayingRef.current;
    isSeekingRef.current = true;
    seekCommittedRef.current = false;
    audioRef.current?.pause();
    videoRef.current?.pause();
    setIsSeeking(true);
    setSeekPreviewMs(overallPositionMs);
    seekPreviewMsRef.current = overallPositionMs;
  };

  const handleSeekPreview = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    seekPreviewMsRef.current = value;
    setIsSeeking(true);
    setSeekPreviewMs(value);
  };

  const commitSeek = React.useCallback(
    (targetFromEvent?: number) => {
      if (!isSeekingRef.current && seekPreviewMsRef.current === null && targetFromEvent === undefined) return;
      if (seekCommittedRef.current) return;
      const target = targetFromEvent ?? seekPreviewMsRef.current ?? seekPreviewMs ?? overallPositionMs;
      const shouldPlay = wasPlayingBeforeSeekRef.current;
      seekCommittedRef.current = true;
      isSeekingRef.current = false;
      seekPreviewMsRef.current = null;
      setIsSeeking(false);
      setSeekPreviewMs(null);
      seekToOverallPosition(target, shouldPlay);
    },
    [overallPositionMs, seekPreviewMs, seekToOverallPosition],
  );

  const cancelSeek = () => {
    if (!isSeekingRef.current) return;
    isSeekingRef.current = false;
    seekPreviewMsRef.current = null;
    seekCommittedRef.current = false;
    setIsSeeking(false);
    setSeekPreviewMs(null);
    if (wasPlayingBeforeSeekRef.current) {
      setIsPlaying(true);
    }
  };

  if (!page) {
    return <div className="app-card p-8 text-sm text-[var(--text-mid)]">这个绘本还没有可播放页面。</div>;
  }

  return (
    <div className="mx-auto max-w-[1320px] px-8 py-6 max-sm:px-4">
      <audio
        ref={audioRef}
        className="hidden"
        preload="auto"
        onTimeUpdate={handleMediaTimeUpdate}
        onLoadedMetadata={handleMediaLoadedMetadata}
        onEnded={handleMediaEnded}
        onError={(event) => handleMediaError("audio", event)}
      />
      {payload.book.background_music_url ? <audio ref={musicRef} className="hidden" src={payload.book.background_music_url} loop preload="auto" /> : null}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl leading-tight">{payload.book.title}</h1>
          <p className="text-sm text-[var(--text-mid)]">
            第 {page.page_no} / {payload.book.page_count} 页 · {voice?.name ?? "默认声音"}
            {activeSegment ? ` · ${currentSegmentIndex + 1}/${pageSegments.length}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant={readingMode === "parent_child" ? "sage" : "outline"} onClick={() => setReadingMode("parent_child")}>
            <BookOpenCheck className="h-4 w-4" />
            共读
          </Button>
          {!readonly ? <FavoriteButton bookId={payload.book.id} childProfileId={childProfileId} /> : null}
          <ReportContentDialog targetType="book" targetId={payload.book.id} />
        </div>
      </div>

      {!payload.can_read_full_book ? (
        <div className="mb-4 rounded-[var(--radius-md)] bg-[rgba(245,166,35,0.14)] px-4 py-3 text-sm font-semibold text-[var(--text-mid)]">
          当前为试看，可阅读前 {payload.preview_page_count ?? payload.pages.length} 页。儿童阅读区不会展示购买操作，请家长在会员页处理订阅。
        </div>
      ) : null}

      {mediaError ? (
        <div className="mb-4 rounded-[var(--radius-md)] bg-[rgba(212,114,92,0.1)] px-4 py-3 text-sm font-semibold text-[var(--terracotta)]">
          {mediaError}
        </div>
      ) : null}

      <BookPageView
        page={page}
        textMode={textMode}
        bilingualEnglishFirst={bilingualEnglishFirst}
        isPlaying={isPlaying}
        activeSegment={activeSegment?.segment ?? null}
        activeCue={activeCue}
        videoRef={videoRef}
        videoSrc={activeVideoSrc}
        onVideoTimeUpdate={handleMediaTimeUpdate}
        onVideoLoadedMetadata={handleMediaLoadedMetadata}
        onVideoEnded={handleMediaEnded}
        onVideoError={(event) => handleMediaError("video", event)}
      />

      <div className="app-card mt-5 p-4">
        <div className="flex items-center gap-3">
          <span className="w-12 text-right text-xs font-bold text-[var(--text-light)]">{progressPercent}%</span>
          <label className="relative h-5 flex-1 cursor-pointer" aria-label="播放进度">
            <input
              className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
              type="range"
              min={0}
              max={totalDurationMs}
              step={250}
              value={Math.min(displayedPositionMs, totalDurationMs)}
              onPointerDown={handleSeekStart}
              onPointerUp={(event) => commitSeek(Number(event.currentTarget.value))}
              onPointerCancel={cancelSeek}
              onLostPointerCapture={(event) => commitSeek(Number(event.currentTarget.value))}
              onBlur={cancelSeek}
              onKeyUp={(event) => commitSeek(Number(event.currentTarget.value))}
              onChange={handleSeekPreview}
            />
            <div className="absolute left-0 right-0 top-1/2 h-3 -translate-y-1/2 overflow-hidden rounded-full bg-[rgba(212,114,92,0.12)]">
            <div className="h-full rounded-full bg-[linear-gradient(90deg,var(--peach),var(--terracotta))]" style={{ width: `${progressPercent}%` }} />
            </div>
          </label>
          <span className="w-24 text-xs font-bold text-[var(--text-light)]">{formatTime(displayedPositionMs)} / {formatTime(totalDurationMs)}</span>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <Button variant="outline" size="icon" onClick={() => goToPage(currentIndex - 1, false)} aria-label="上一页">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button size="icon" onClick={handlePlayToggle} aria-label={isPlaying ? "暂停" : "播放"}>
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </Button>
          <Button variant="outline" size="icon" onClick={() => goToPage(currentIndex + 1, false)} aria-label="下一页">
            <ChevronRight className="h-5 w-5" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleReplay} aria-label="重新播放">
            <RotateCcw className="h-5 w-5" />
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <Segmented
            label="模式"
            value={readingMode}
            items={[
              ["auto", "自动朗读"],
              ["manual", "手动翻页"],
              ["parent_child", "亲子共读"],
            ]}
            onChange={(value) => setReadingMode(value as ReadingMode)}
          />
          <Segmented
            label="文字"
            value={textMode}
            items={[
              ["zh", "中文"],
              ["en", "English"],
              ["bilingual", "双语"],
            ]}
            onChange={(value) => setTextMode(value as BookLanguage)}
          />
          {textMode === "bilingual" ? (
            <Button variant="outline" onClick={() => setBilingualEnglishFirst((value) => !value)}>
              <Repeat className="h-4 w-4" />
              {bilingualEnglishFirst ? "英中" : "中英"}
            </Button>
          ) : null}
          <Segmented label="语速" value={String(speed)} items={speedOptions.map((item) => [String(item.value), item.label])} onChange={(value) => setSpeed(Number(value))} />
          <Button variant={musicEnabled ? "sage" : "outline"} onClick={() => setMusicEnabled((value) => !value)}>
            {musicEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            音乐
          </Button>
          <Button variant={soundEnabled ? "sage" : "outline"} onClick={() => setSoundEnabled((value) => !value)}>
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            音效
          </Button>
          {payload.voice_options.length > 0 ? <VoiceSwitcher voices={payload.voice_options} currentVoice={voice} onChange={setVoice} /> : null}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-[minmax(260px,0.8fr)_minmax(280px,1fr)] gap-4 max-lg:grid-cols-1">
        <CoReadingPrompts prompts={payload.reading_prompts} currentPageNo={page.page_no} />
        <LearningCards cards={payload.learning_cards} />
      </div>
    </div>
  );
};

const buildPageTimeline = (page: BookPage, measuredDurations: Record<number, number> = {}): TimelineSegment[] => {
  const sourceSegments = page.playback_segments.length > 0 ? [...page.playback_segments].sort((a, b) => a.sort_order - b.sort_order) : [];
  const segments =
    sourceSegments.length > 0
      ? sourceSegments
      : [
          {
            id: -page.id,
            segment_type: "narration" as const,
            speaker_ref: null,
            image_url: page.image_url,
            audio_url: page.audio_url,
            lip_sync_url: null,
            media_mode: "audio" as const,
            start_ms: 0,
            end_ms: page.duration_seconds ? page.duration_seconds * 1000 : null,
            fallback_mode: "page_image_audio" as const,
            lip_sync_status: "none" as const,
            sort_order: 0,
            subtitle_cues: [],
            sound_effects: [],
          },
        ];
  return segments.map((segment) => {
    const mediaUrl = segment.lip_sync_url || segment.audio_url || null;
    const startMs = segment.start_ms ?? 0;
    const endMs = segment.end_ms ?? null;
    const cueEnd = Math.max(0, ...segment.subtitle_cues.map((cue) => cue.end_ms ?? 0));
    const durationMs = Math.max(
      DEFAULT_SEGMENT_DURATION_MS,
      measuredDurations[segment.id] ?? 0,
      endMs !== null ? endMs - startMs : 0,
      cueEnd,
      page.duration_seconds && segments.length === 1 ? page.duration_seconds * 1000 : 0,
    );
    return {
      segment,
      mediaUrl,
      durationMs,
      cues: segment.subtitle_cues,
      soundEffects: segment.sound_effects,
    };
  });
};

const estimatePageDurationMs = (page: BookPage, measuredDurations: Record<number, number> = {}): number => {
  const timeline = buildPageTimeline(page, measuredDurations);
  const segmentDuration = timeline.reduce((total, item) => total + item.durationMs, 0);
  if (segmentDuration > 0) return segmentDuration;
  return Math.max(DEFAULT_SEGMENT_DURATION_MS, (page.duration_seconds ?? 0) * 1000);
};

const resolveBookPosition = (
  pages: BookPage[],
  targetMs: number,
  measuredDurations: Record<number, number> = {},
): { pageIndex: number; pagePositionMs: number } => {
  let remaining = Math.max(0, targetMs);
  for (let index = 0; index < pages.length; index += 1) {
    const duration = estimatePageDurationMs(pages[index], measuredDurations);
    if (remaining <= duration || index === pages.length - 1) {
      return { pageIndex: index, pagePositionMs: Math.min(remaining, duration) };
    }
    remaining -= duration;
  }
  return { pageIndex: 0, pagePositionMs: 0 };
};

const resolveSegmentPosition = (segments: TimelineSegment[], targetMs: number): { segmentIndex: number; segmentPositionMs: number } => {
  let remaining = Math.max(0, targetMs);
  for (let index = 0; index < segments.length; index += 1) {
    const duration = segments[index].durationMs;
    if (remaining <= duration || index === segments.length - 1) {
      return { segmentIndex: index, segmentPositionMs: Math.min(remaining, duration) };
    }
    remaining -= duration;
  }
  return { segmentIndex: 0, segmentPositionMs: 0 };
};

const findActiveCue = (segment: TimelineSegment | null, positionMs: number): BookSubtitleCue | null => {
  if (!segment) return null;
  const cues = segment.cues.length > 0 ? segment.cues : [];
  return (
    cues.find((cue) => {
      const start = cue.start_ms;
      const end = cue.end_ms ?? segment.durationMs;
      return positionMs >= start && positionMs <= end;
    }) ??
    cues[0] ??
    null
  );
};

const playActiveMedia = async (
  kind: "audio" | "video",
  audio: HTMLAudioElement | null,
  video: HTMLVideoElement | null,
  mediaSrc: string | null,
) => {
  if (!mediaSrc) return;
  if (kind === "video") {
    audio?.pause();
    await video?.play();
    return;
  }
  video?.pause();
  await audio?.play();
};

const triggerSoundEffects = (
  page: BookPage,
  segment: TimelineSegment | null,
  pagePositionMs: number,
  positionMs: number,
  enabled: boolean,
  refs: Map<string, HTMLAudioElement>,
  playedKeys: Set<string>,
) => {
  if (!enabled) return;
  page.sound_effects
    .filter((effect) => effect.trigger_type === "page")
    .forEach((effect) => playSoundEffect(effect, `page-${page.id}-${effect.id}`, pagePositionMs, refs, playedKeys));
  segment?.soundEffects.forEach((effect) => {
    playSoundEffect(effect, `segment-${segment.segment.id}-${effect.id}`, positionMs, refs, playedKeys);
  });
};

const playSoundEffect = (
  effect: BookSoundEffectCue,
  key: string,
  positionMs: number,
  refs: Map<string, HTMLAudioElement>,
  playedKeys: Set<string>,
) => {
  if (playedKeys.has(key) || positionMs < effect.start_ms) return;
  playedKeys.add(key);
  let audio = refs.get(key);
  if (!audio) {
    audio = new Audio(effect.sound_effect_url);
    audio.preload = "auto";
    refs.set(key, audio);
  }
  audio.currentTime = 0;
  audio.volume = Math.min(1, Math.max(0, effect.volume / 100));
  audio.loop = effect.loop;
  void audio.play().catch(() => undefined);
};

const fadeAudioVolume = (audio: HTMLAudioElement, targetVolume: number, durationMs: number) => {
  const startVolume = audio.volume;
  const target = Math.min(1, Math.max(0, targetVolume));
  if (durationMs <= 0 || Math.abs(startVolume - target) < 0.01) {
    audio.volume = target;
    return;
  }
  const start = performance.now();
  const step = (now: number) => {
    const progress = Math.min(1, (now - start) / durationMs);
    audio.volume = startVolume + (target - startVolume) * progress;
    if (progress < 1) window.requestAnimationFrame(step);
  };
  window.requestAnimationFrame(step);
};

const formatTime = (valueMs: number) => {
  const totalSeconds = Math.max(0, Math.floor(valueMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const Segmented: React.FC<{
  label: string;
  value: string;
  items: [string, string][];
  onChange: (value: string) => void;
}> = ({ label, value, items, onChange }) => (
  <div className="inline-flex items-center gap-1 rounded-[var(--radius-md)] bg-white p-1 text-sm shadow-[var(--shadow-soft)]">
    <span className="px-2 text-xs font-bold text-[var(--text-light)]">{label}</span>
    {items.map(([itemValue, itemLabel]) => (
      <button
        key={itemValue}
        type="button"
        className={
          itemValue === value
            ? "rounded-[var(--radius-sm)] bg-[var(--terracotta)] px-3 py-1.5 font-bold text-white"
            : "rounded-[var(--radius-sm)] px-3 py-1.5 font-bold text-[var(--text-mid)] hover:bg-[rgba(212,114,92,0.08)]"
        }
        onClick={() => onChange(itemValue)}
      >
        {itemLabel}
      </button>
    ))}
  </div>
);
