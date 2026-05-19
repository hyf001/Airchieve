import React from "react";
import { Upload } from "lucide-react";

interface AssetUploadFieldProps {
  title: string;
  hint: string;
  accept: string;
  disabled?: boolean;
  onFileSelected?: (file: File) => void;
}

export const AssetUploadField: React.FC<AssetUploadFieldProps> = ({ title, hint, accept, disabled, onFileSelected }) => {
  const inputId = React.useId();

  return (
    <label
      className="flex min-h-[170px] cursor-pointer flex-col items-center justify-center rounded-[var(--radius-md)] border-2 border-dashed border-[rgba(212,114,92,0.22)] bg-white p-5 text-center transition hover:border-[var(--peach)] hover:bg-[rgba(255,138,101,0.05)]"
      htmlFor={inputId}
    >
      <Upload className="mb-3 h-8 w-8 text-[var(--terracotta)]" />
      <span className="text-sm font-bold text-[var(--text-dark)]">{title}</span>
      <span className="mt-1 text-xs text-[var(--text-light)]">{hint}</span>
      <input
        id={inputId}
        className="sr-only"
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFileSelected?.(file);
        }}
      />
    </label>
  );
};
