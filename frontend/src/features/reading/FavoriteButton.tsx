import React from "react";
import { Heart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth";
import { useToast } from "@/shared/ui/toast";
import { readingApi } from "./api";

interface FavoriteButtonProps {
  bookId: number;
  childProfileId?: number | null;
  initialFavorite?: boolean;
  onChanged?: (isFavorite: boolean) => void;
}

export const FavoriteButton: React.FC<FavoriteButtonProps> = ({ bookId, childProfileId, initialFavorite = false, onChanged }) => {
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const [isFavorite, setIsFavorite] = React.useState(initialFavorite);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    setIsFavorite(initialFavorite);
  }, [initialFavorite]);

  React.useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    readingApi
      .getFavorite(bookId, childProfileId)
      .then((favorite) => {
        if (!active) return;
        setIsFavorite(favorite?.is_favorite ?? false);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [bookId, childProfileId, isAuthenticated]);

  const handleToggle = async () => {
    if (!isAuthenticated) {
      showToast("登录后可以为孩子保存收藏");
      return;
    }
    setIsSaving(true);
    try {
      const response = await readingApi.toggleFavorite(bookId, childProfileId);
      setIsFavorite(response.is_favorite);
      onChanged?.(response.is_favorite);
      showToast(response.is_favorite ? "已加入收藏" : "已取消收藏", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "收藏操作失败", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Button variant={isFavorite ? "default" : "outline"} size="lg" onClick={handleToggle} disabled={isSaving}>
      <Heart className={isFavorite ? "h-4 w-4 fill-current" : "h-4 w-4"} />
      {isFavorite ? "已收藏" : "收藏"}
    </Button>
  );
};
