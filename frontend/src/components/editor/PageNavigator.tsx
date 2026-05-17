import React from "react";

interface Props {
  pages: number;
}

const PageNavigator: React.FC<Props> = ({ pages }) => (
  <div className="grid grid-cols-3 gap-2">
    {Array.from({ length: pages }, (_, index) => (
      <button
        key={index}
        className="aspect-[4/3] rounded-md border border-border bg-secondary text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        {index + 1}
      </button>
    ))}
  </div>
);

export default PageNavigator;
