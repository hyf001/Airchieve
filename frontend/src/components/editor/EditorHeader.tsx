import React from "react";

interface Props {
  title: string;
}

const EditorHeader: React.FC<Props> = ({ title }) => (
  <div className="flex h-14 items-center border-b border-border px-4 text-sm font-medium">
    {title}
  </div>
);

export default EditorHeader;
