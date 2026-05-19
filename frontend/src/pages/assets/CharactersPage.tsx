import React, { useEffect, useState } from "react";
import { ImagePlus, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ArtStyle, CharacterSummary } from "@/entities/asset";
import { AssetUploadField } from "@/entities/asset";
import { artStyleLibraryApi } from "@/features/art-style-library";
import { CharacterCreateForm, characterLibraryApi, CharacterSelector } from "@/features/character-library";
import { privacyApi, UploadConsentDialog } from "@/features/privacy";
import { AppShell } from "@/shared/layout/AppShell";

export const CharactersPage: React.FC = () => {
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [artStyles, setArtStyles] = useState<ArtStyle[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = () => {
    void characterLibraryApi.list().then((response) => setCharacters(response.items)).catch(() => setCharacters([]));
    void artStyleLibraryApi.list().then((response) => setArtStyles(response.items)).catch(() => setArtStyles([]));
  };

  useEffect(load, []);

  const personalCharacters = characters.filter((item) => item.owner_user_id !== null);
  const systemCharacters = characters.filter((item) => item.owner_user_id === null);

  return (
    <AppShell>
      <section className="mx-auto max-w-[1320px] px-8 py-8 max-sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl">角色形象</h1>
            <p className="mt-2 text-sm text-[var(--text-light)]">创建和管理绘本里的主角形象，画风会绑定到形象本身。</p>
          </div>
          <Button onClick={() => document.getElementById("character-create")?.scrollIntoView({ behavior: "smooth" })}>
            <ImagePlus className="h-4 w-4" />
            创建形象
          </Button>
        </div>

        <div className="mt-6 grid grid-cols-[0.95fr_1.05fr] gap-5 max-lg:grid-cols-1" id="character-create">
          <div className="grid gap-4">
            <AssetUploadField
              title={referenceFile ? referenceFile.name : "上传头像或参考图"}
              hint="支持 JPG / PNG，上传前需确认授权"
              accept="image/*"
              onFileSelected={(file) => {
                setReferenceFile(file);
                setMessage(null);
              }}
            />
            <UploadConsentDialog checked={consentChecked} onCheckedChange={setConsentChecked} />
            <div className="app-card flex items-start gap-3 p-4">
              <ShieldCheck className="mt-1 h-5 w-5 text-[var(--sage-deep)]" />
              <p className="text-sm text-[var(--text-mid)]">用户头像或参考图只作为角色形象生成素材，不会直接进入绘本成品。</p>
            </div>
          </div>
          <CharacterCreateForm
            artStyles={artStyles}
            onSubmit={async (payload) => {
              let referenceAssetId: number | null = null;
              let uploadConsentId: number | null = null;
              if (referenceFile) {
                if (!consentChecked) {
                  setMessage("上传参考图前需要先确认素材授权。");
                  return;
                }
                const consent = await privacyApi.recordUploadConsent({
                  target_type: "character_reference_image",
                  target_id: null,
                  confirmed_rights: true,
                  confirmed_privacy: true,
                });
                const session = await characterLibraryApi.createUploadSession({
                  purpose: "character",
                  filename: referenceFile.name,
                  mime_type: referenceFile.type || "image/jpeg",
                  byte_size: referenceFile.size,
                });
                await characterLibraryApi.uploadToStorage(session, referenceFile);
                const asset = await characterLibraryApi.completeUpload(session.id, {
                  byte_size: referenceFile.size,
                  asset_kind: "image",
                  visibility: "private",
                });
                referenceAssetId = asset.id;
                uploadConsentId = consent.id;
              }
              await characterLibraryApi.create({
                ...payload,
                reference_asset_id: referenceAssetId,
                upload_consent_id: uploadConsentId,
              });
              setMessage("角色形象已创建，生成任务正在排队。");
              setReferenceFile(null);
              load();
            }}
          />
        </div>
        {message ? <div className="mt-4 rounded-[var(--radius-sm)] bg-[rgba(139,198,168,0.14)] px-4 py-3 text-sm text-[var(--sage-deep)]">{message}</div> : null}

        <section className="mt-8">
          <h2 className="mb-4 font-display text-2xl">我的形象</h2>
          {personalCharacters.length ? (
            <CharacterSelector
              characters={personalCharacters}
              selectedId={selectedId}
              onSelect={(item) => setSelectedId(item.id)}
              onSetDefault={async (item) => {
                await characterLibraryApi.setDefault(item.id);
                load();
              }}
              onDelete={async (item) => {
                await characterLibraryApi.remove(item.id);
                load();
              }}
            />
          ) : (
            <div className="app-card p-6 text-sm text-[var(--text-light)]">暂无个人形象，可以先用文字描述创建一个。</div>
          )}
        </section>

        <section className="mt-8 pb-10">
          <h2 className="mb-4 font-display text-2xl">系统形象</h2>
          {systemCharacters.length ? (
            <CharacterSelector characters={systemCharacters} selectedId={selectedId} onSelect={(item) => setSelectedId(item.id)} />
          ) : (
            <div className="app-card p-6 text-sm text-[var(--text-light)]">系统形象库暂无数据。</div>
          )}
        </section>
      </section>
    </AppShell>
  );
};
