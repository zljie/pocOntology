"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface PropertyTypeIconProps {
  type: string;
  size?: "sm" | "md" | "lg";
}

const typeConfig: Record<string, { icon: string; color: string; bg: string }> = {
  STRING: { icon: "T", color: "text-blue-400", bg: "bg-blue-500/20" },
  INTEGER: { icon: "#", color: "text-green-400", bg: "bg-green-500/20" },
  DOUBLE: { icon: "π", color: "text-purple-400", bg: "bg-purple-500/20" },
  BOOLEAN: { icon: "∇", color: "text-orange-400", bg: "bg-orange-500/20" },
  TIMESTAMP: { icon: "◷", color: "text-yellow-400", bg: "bg-yellow-500/20" },
  STRUCT: { icon: "{ }", color: "text-cyan-400", bg: "bg-cyan-500/20" },
};

export function PropertyTypeIcon({ type, size = "sm" }: PropertyTypeIconProps) {
  const config = typeConfig[type] || typeConfig.STRING;

  const sizeClasses = {
    sm: "w-5 h-5 text-[10px]",
    md: "w-6 h-6 text-xs",
    lg: "w-7 h-7 text-sm",
  };

  return (
    <div
      className={cn(
        "rounded flex items-center justify-center font-mono font-bold",
        config.color,
        config.bg,
        sizeClasses[size]
      )}
    >
      {config.icon}
    </div>
  );
}
