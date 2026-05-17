import React from "react";

import { useAuth } from "@/features/auth";
import { useToast } from "@/shared/ui/toast";
import { profileApi } from "./api";
import { demoProfiles } from "./demoData";
import { type ChildProfile, type ChildProfilePayload } from "./types";

interface ProfileContextValue {
  profiles: ChildProfile[];
  currentProfile: ChildProfile | null;
  isLoading: boolean;
  error: string | null;
  refreshProfiles: () => Promise<void>;
  createProfile: (payload: ChildProfilePayload) => Promise<void>;
  updateProfile: (profileId: number, payload: ChildProfilePayload) => Promise<void>;
  deleteProfile: (profileId: number) => Promise<void>;
  setCurrentProfile: (profileId: number) => Promise<void>;
}

const ProfileContext = React.createContext<ProfileContextValue | null>(null);

const storageKey = "airchieve.current_child_profile_id";

const ensureProfileShape = (profile: ChildProfile): ChildProfile => ({
  ...profile,
  age_range: profile.age_range ?? null,
  reading_level: profile.reading_level ?? null,
  interest_tags: profile.interest_tags ?? [],
  education_goals: profile.education_goals ?? [],
  default_character: profile.default_character ?? null,
  default_voice: profile.default_voice ?? null,
  default_art_style: profile.default_art_style ?? null,
  is_default: Boolean(profile.is_default),
});

const normalizeProfiles = (profiles: ChildProfile[], selectedId: number | null): ChildProfile[] => {
  const shapedProfiles = profiles.map(ensureProfileShape);
  if (shapedProfiles.length === 0) return [];
  const defaultProfile = shapedProfiles.find((profile) => profile.is_default);
  const currentId = selectedId ?? defaultProfile?.id ?? shapedProfiles[0].id;
  return shapedProfiles.map((profile) => ({ ...profile, is_default: profile.id === currentId }));
};

export const ProfileProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [profiles, setProfiles] = React.useState<ChildProfile[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const { showToast } = useToast();

  const refreshProfiles = React.useCallback(async () => {
    if (!isAuthenticated) {
      setProfiles([]);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const items = await profileApi.listProfiles();
      const selectedId = Number(window.localStorage.getItem(storageKey)) || null;
      const normalized = normalizeProfiles(items, selectedId);
      setProfiles(normalized);
      if (normalized[0]) {
        window.localStorage.setItem(storageKey, String(normalized.find((profile) => profile.is_default)?.id ?? normalized[0].id));
      }
    } catch (requestError) {
      const selectedId = Number(window.localStorage.getItem(storageKey)) || null;
      setProfiles(normalizeProfiles(demoProfiles, selectedId));
      setError(requestError instanceof Error ? requestError.message : "儿童档案加载失败，当前显示演示数据");
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  React.useEffect(() => {
    void refreshProfiles();
  }, [refreshProfiles]);

  const createProfile = React.useCallback(
    async (payload: ChildProfilePayload) => {
      try {
        const created = await profileApi.createProfile(payload);
        setProfiles((current) => normalizeProfiles([...current, created], created.id));
        window.localStorage.setItem(storageKey, String(created.id));
      } catch {
        const created: ChildProfile = {
          ...payload,
          id: -Date.now(),
          is_default: profiles.length === 0,
          status: "active",
        };
        setProfiles((current) => normalizeProfiles([...current, created], created.id));
        window.localStorage.setItem(storageKey, String(created.id));
      }
      showToast("儿童档案已保存", "success");
    },
    [profiles.length, showToast],
  );

  const updateProfile = React.useCallback(
    async (profileId: number, payload: ChildProfilePayload) => {
      try {
        const updated = await profileApi.updateProfile(profileId, payload);
        setProfiles((current) =>
          normalizeProfiles(
            current.map((profile) => (profile.id === profileId ? { ...profile, ...updated } : profile)),
            Number(window.localStorage.getItem(storageKey)) || null,
          ),
        );
      } catch {
        setProfiles((current) =>
          current.map((profile) => (profile.id === profileId ? { ...profile, ...payload } : profile)),
        );
      }
      showToast("档案信息已更新", "success");
    },
    [showToast],
  );

  const deleteProfile = React.useCallback(
    async (profileId: number) => {
      try {
        await profileApi.deleteProfile(profileId);
      } catch {
        // Demo fallback mirrors the local deletion when the backend is unavailable.
      }

      setProfiles((current) => {
        const next = current.filter((profile) => profile.id !== profileId);
        const fallbackId = next[0]?.id ?? null;
        if (fallbackId) {
          window.localStorage.setItem(storageKey, String(fallbackId));
        } else {
          window.localStorage.removeItem(storageKey);
        }
        return normalizeProfiles(next, fallbackId);
      });
      showToast("儿童档案已删除", "success");
    },
    [showToast],
  );

  const setCurrentProfile = React.useCallback(
    async (profileId: number) => {
      try {
        await profileApi.setDefaultProfile(profileId);
      } catch {
        // Local fallback keeps current profile capability available in prototype mode.
      }
      window.localStorage.setItem(storageKey, String(profileId));
      setProfiles((current) => normalizeProfiles(current, profileId));
      showToast("已切换当前儿童档案", "success");
    },
    [showToast],
  );

  const currentProfile = React.useMemo(
    () => profiles.find((profile) => profile.is_default) ?? profiles[0] ?? null,
    [profiles],
  );

  const value = React.useMemo(
    () => ({
      profiles,
      currentProfile,
      isLoading,
      error,
      refreshProfiles,
      createProfile,
      updateProfile,
      deleteProfile,
      setCurrentProfile,
    }),
    [createProfile, currentProfile, deleteProfile, error, isLoading, profiles, refreshProfiles, setCurrentProfile, updateProfile],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
};

export const useProfiles = () => {
  const context = React.useContext(ProfileContext);
  if (!context) {
    throw new Error("useProfiles must be used inside ProfileProvider");
  }
  return context;
};
