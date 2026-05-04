"use client";

import { UserButton } from "@clerk/nextjs";

interface TopNavProps {
  title?: string;
}

export function TopNav({ title }: TopNavProps) {
  return (
    <header className="flex items-center justify-between h-14 px-6 border-b border-slate-800 bg-slate-900 shrink-0">
      {title && (
        <h1 className="text-slate-200 text-sm font-medium">{title}</h1>
      )}
      <div className="ml-auto">
        <UserButton />
      </div>
    </header>
  );
}
