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
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleReset = async () => {
    if (!confirming) {
      setConfirming(true);
      setError(null);
      return;
    }

    setLoading(true);
    setConfirming(false);
    const result = await resetWorkspaceData(workspaceId);
    if (result.success) {
      router.refresh();
    } else {
      setError(result.error ?? "Failed to reset workspace");
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {confirming && !loading && (
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleReset}
          disabled={loading}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${
            confirming && !loading
              ? "border border-red-300 bg-red-100 text-red-800 hover:bg-red-200"
              : "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
          }`}
        >
          {loading ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          {loading ? "Resetting..." : confirming ? "Confirm reset" : "Reset workspace"}
        </button>
      </div>

        {confirming && !loading && (
        <div className="max-w-sm text-right text-xs text-red-600">
          This removes every photo, face match, and guest group from {workspaceName}.
        </div>
      )}

      {error && <div className="max-w-sm text-right text-xs text-red-600">{error}</div>}
    </div>
  );
}
