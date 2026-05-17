import React, { useState } from "react";
import { CopyPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useRouter } from "@/app/router";
import { discoveryApi } from "./api";

interface StartSimilarCreationButtonProps {
  bookId: number;
}

export const StartSimilarCreationButton: React.FC<StartSimilarCreationButtonProps> = ({ bookId }) => {
  const { navigate } = useRouter();
  const [loading, setLoading] = useState(false);

  const handleStart = async () => {
    setLoading(true);
    try {
      await discoveryApi.startSimilarCreation(bookId);
    } catch {
      // 未登录或后端未启动时仍进入创作入口，创作模块会继续处理登录和权益。
    } finally {
      setLoading(false);
      navigate("/create");
    }
  };

  return (
    <Button variant="sage" onClick={handleStart} disabled={loading}>
      <CopyPlus className="h-4 w-4" />
      创建类似作品
    </Button>
  );
};
