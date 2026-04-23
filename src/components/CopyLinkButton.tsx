"use client";

import { Check, Link2 } from "lucide-react";
import { useState } from "react";

interface CopyLinkButtonProps {
  path: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
}

export default function CopyLinkButton({
  path,
  label = "Copy Link",
  copiedLabel = "Copied",
  className = "",
}: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (error) {
      console.error("Failed to copy link:", error);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={className}
    >
      {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Link2 className="h-4 w-4" />}
      {copied ? copiedLabel : label}
    </button>
  );
}
