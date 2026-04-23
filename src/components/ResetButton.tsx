"use client";

import { useState } from "react";
import { resetWorkspaceData } from "@/actions/reset";
import { Trash2, RefreshCcw } from "lucide-react";
import { useRouter } from "next/navigation";

interface ResetButtonProps {
  workspaceId: string;
  workspaceName: string;
}

export default function ResetButton({ workspaceId, workspaceName }: ResetButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleReset = async () => {
    if (
      !confirm(
        `This will remove every photo, detected face, and guest grouping from ${workspaceName}. Use this only when you want to start the workspace over from scratch.`,
      )
    ) {
      return;
    }

    setLoading(true);
    const result = await resetWorkspaceData(workspaceId);
    if (result.success) {
      router.refresh();
    } else {
      alert(result.error ?? "Failed to reset workspace");
    }
    setLoading(false);
  };

  return (
    <button
      onClick={handleReset}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-50"
    >
      {loading ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      {loading ? "Resetting..." : "Reset workspace"}
    </button>
  );
}
