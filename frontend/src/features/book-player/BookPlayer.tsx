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
import { BookPageView, CoReadingPrompts, LearningCards, type BookLanguage, type BookPlayerPayload, type BookVoiceOption } from "@/entities/book";
import { FavoriteButton, readingApi, type ReadingMode } from "@/features/reading";
import { useAuth } from "@/features/auth";
import { ReportContentDialog } from "@/features/moderation";
import { useProfiles } from "@/features/profile-management";
import { VoiceSwitcher } from "./VoiceSwitcher";

interface BookPlayerProps {
  payload: BookPlayerPayload;
  readonly?: boolean;
}

const speedOptions = [
  { label: "慢", value: 0.85 },
  { label: "正常", value: 1 },
  { label: "快", value: 1.2 },
];

export const BookPlayer: React.FC<BookPlayerProps> = ({ payload, readonly = false }) => {
  const { isAuthenticated } = useAuth();
  const { currentProfile } = useProfiles();
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [textMode, setTextMode] = React.useState<BookLanguage>(payload.default_text_mode);
  const [bilingualEnglishFirst, setBilingualEnglishFirst] = React.useState(false);
  const [readingMode, setReadingMode] = React.useState<ReadingMode>("auto");
  const [speed, setSpeed] = React.useState(1);
  const [musicEnabled, setMusicEnabled] = React.useState(true);
  const [soundEnabled, setSoundEnabled] = React.useState(true);
  const [voice, setVoice] = React.useState<BookVoiceOption | null>(payload.default_voice ?? payload.voice_options[0] ?? null);

  const page = payload.pages[currentIndex] ?? payload.pages[0];
  const progressPercent = payload.pages.length > 0 ? Math.round(((currentIndex + 1) / payload.pages.length) * 100) : 0;
  const childProfileId = currentProfile?.id ?? null;

  React.useEffect(() => {
    void readingApi.recordEvent({
      book_id: payload.book.id,
      child_profile_id: childProfileId,
      event_type: "page_view",
      page_no: page?.page_no,
      payload: { readonly },
    }).catch(() => undefined);
  }, [childProfileId, page?.page_no, payload.book.id, readonly]);

  const saveProgress = React.useCallback(
    async (nextIndex: number, completed = false) => {
      if (!isAuthenticated || readonly) return;
      try {
        await readingApi.saveProgress(payload.book.id, {
          child_profile_id: childProfileId,
          current_page_no: payload.pages[nextIndex]?.page_no ?? 1,
          current_position_ms: 0,
          progress_percent: Math.round(((nextIndex + 1) / payload.pages.length) * 100),
          mode: readingMode,
          text_mode: textMode,
          voice_id: voice?.id ?? null,
          completed,
        });
      } catch {
        // Progress is helpful, but playback should not be blocked by a failed sync.
      }
    },
    [childProfileId, isAuthenticated, payload.book.id, payload.pages, readingMode, readonly, textMode, voice?.id],
  );

  const handlePlayToggle = async () => {
    const nextPlaying = !isPlaying;
    setIsPlaying(nextPlaying);
    await readingApi
      .recordEvent({
        book_id: payload.book.id,
        child_profile_id: childProfileId,
        event_type: nextPlaying ? "play_start" : "pause",
        page_no: page?.page_no,
        payload: { mode: readingMode, text_mode: textMode, speed },
      })
      .catch(() => undefined);
  };

  const goToPage = (nextIndex: number) => {
    const bounded = Math.min(Math.max(nextIndex, 0), payload.pages.length - 1);
    setCurrentIndex(bounded);
    void saveProgress(bounded, bounded === payload.pages.length - 1);
  };

  const handleReplay = () => {
    setCurrentIndex(0);
    setIsPlaying(true);
    void readingApi.recordEvent({ book_id: payload.book.id, child_profile_id: childProfileId, event_type: "replay", page_no: 1 }).catch(
      () => undefined,
    );
  };

  if (!page) {
    return <div className="app-card p-8 text-sm text-[var(--text-mid)]">这个绘本还没有可播放页面。</div>;
  }

  return (
    <div className="mx-auto max-w-[1320px] px-8 py-6 max-sm:px-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl leading-tight">{payload.book.title}</h1>
          <p className="text-sm text-[var(--text-mid)]">
            第 {page.page_no} / {payload.book.page_count} 页 · {voice?.name ?? "默认声音"}
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

      <BookPageView page={page} textMode={textMode} bilingualEnglishFirst={bilingualEnglishFirst} isPlaying={isPlaying} />

      <div className="app-card mt-5 p-4">
        <div className="flex items-center gap-3">
          <span className="w-12 text-right text-xs font-bold text-[var(--text-light)]">{progressPercent}%</span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-[rgba(212,114,92,0.12)]">
            <div className="h-full rounded-full bg-[linear-gradient(90deg,var(--peach),var(--terracotta))]" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <Button variant="outline" size="icon" onClick={() => goToPage(currentIndex - 1)} aria-label="上一页">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button size="icon" onClick={handlePlayToggle} aria-label={isPlaying ? "暂停" : "播放"}>
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </Button>
          <Button variant="outline" size="icon" onClick={() => goToPage(currentIndex + 1)} aria-label="下一页">
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
