import React, { useEffect, useState } from "react";
import { Mic2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AssetUploadField, type VoiceSummary } from "@/entities/asset";
import { privacyApi, UploadConsentDialog } from "@/features/privacy";
import { voiceLibraryApi, VoiceSelector } from "@/features/voice-library";
import { AppShell } from "@/shared/layout/AppShell";

export const VoicesPage: React.FC = () => {
  const [voices, setVoices] = useState<VoiceSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [voiceName, setVoiceName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = () => {
    void voiceLibraryApi.list().then((response) => setVoices(response.items)).catch(() => setVoices([]));
  };

  useEffect(load, []);

  const personalVoices = voices.filter((item) => item.owner_user_id !== null);
  const systemVoices = voices.filter((item) => item.owner_user_id === null);

  const handleCreate = async () => {
    if (!selectedFile || !voiceName || !consentChecked) return;
    const consent = await privacyApi.recordUploadConsent({
      target_type: "voice_sample",
      target_id: null,
      confirmed_rights: true,
      confirmed_privacy: true,
    });
    const session = await voiceLibraryApi.createUploadSession({
      purpose: "voice",
      filename: selectedFile.name,
      mime_type: selectedFile.type || "audio/mpeg",
      byte_size: selectedFile.size,
    });
    await voiceLibraryApi.uploadToStorage(session, selectedFile);
    const asset = await voiceLibraryApi.completeUpload(session.id, {
      byte_size: selectedFile.size,
      asset_kind: "audio",
      visibility: "private",
    });
    await voiceLibraryApi.create({
      name: voiceName,
      source_sample_asset_id: asset.id,
      supported_languages: ["zh"],
      upload_consent_id: consent.id,
    });
    setMessage("声音已上传，正在处理中。");
    setSelectedFile(null);
    setVoiceName("");
    load();
  };

  return (
    <AppShell>
      <section className="mx-auto max-w-[1320px] px-8 py-8 max-sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl">我的声音</h1>
            <p className="mt-2 text-sm text-[var(--text-light)]">上传和管理朗读声音，处理完成后可用于播放器和生成流程。</p>
          </div>
          <Button onClick={() => document.getElementById("voice-upload")?.scrollIntoView({ behavior: "smooth" })}>
            <Mic2 className="h-4 w-4" />
            上传声音
          </Button>
        </div>

        <div className="mt-6 grid grid-cols-[0.95fr_1.05fr] gap-5 max-lg:grid-cols-1" id="voice-upload">
          <AssetUploadField
            title={selectedFile ? selectedFile.name : "上传新声音"}
            hint="支持 MP3 / WAV / M4A，推荐 1-5 分钟"
            accept="audio/*"
            onFileSelected={setSelectedFile}
          />
          <div className="app-card grid gap-4 p-5">
            <label className="grid gap-1.5 text-sm font-semibold">
              声音名称
              <Input value={voiceName} onChange={(event) => setVoiceName(event.target.value)} placeholder="妈妈的声音、老师讲故事" />
            </label>
            <UploadConsentDialog checked={consentChecked} onCheckedChange={setConsentChecked} />
            <ul className="grid gap-2 text-xs text-[var(--text-light)]">
              <li>推荐在安静环境录制，语速平稳自然。</li>
              <li>请确认声音本人或监护人同意用于绘本朗读。</li>
              <li>删除声音不会删除历史绘本已经生成的音频。</li>
            </ul>
            <Button disabled={!selectedFile || !voiceName || !consentChecked} onClick={handleCreate}>
              开始上传
            </Button>
          </div>
        </div>
        {message ? <div className="mt-4 rounded-[var(--radius-sm)] bg-[rgba(139,198,168,0.14)] px-4 py-3 text-sm text-[var(--sage-deep)]">{message}</div> : null}

        <section className="mt-8">
          <h2 className="mb-4 font-display text-2xl">已上传声音</h2>
          {personalVoices.length ? (
            <VoiceSelector
              voices={personalVoices}
              selectedId={selectedId}
              onSelect={(item) => setSelectedId(item.id)}
              onSetDefault={async (item) => {
                await voiceLibraryApi.setDefault(item.id);
                load();
              }}
              onDelete={async (item) => {
                await voiceLibraryApi.remove(item.id);
                load();
              }}
            />
          ) : (
            <div className="app-card p-6 text-sm text-[var(--text-light)]">暂无个人声音。</div>
          )}
        </section>

        <section className="mt-8 pb-10">
          <h2 className="mb-4 font-display text-2xl">系统声音库</h2>
          {systemVoices.length ? (
            <VoiceSelector voices={systemVoices} selectedId={selectedId} onSelect={(item) => setSelectedId(item.id)} />
          ) : (
            <div className="app-card p-6 text-sm text-[var(--text-light)]">系统声音库暂无数据。</div>
          )}
        </section>
      </section>
    </AppShell>
  );
};
