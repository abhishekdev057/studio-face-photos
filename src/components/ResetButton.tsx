"use client"

import { useState } from "react";
import { resetEventData } from "@/actions/reset";
import { Trash2, RefreshCcw } from "lucide-react";
import { useRouter } from "next/navigation";

export default function ResetButton() {
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleReset = async () => {
        if (!confirm("DANGER: This will delete ALL photos, people, and albums from your event. \n\nUse this to clear stuck data or start fresh.\n\nAre you sure?")) return;

        setLoading(true);
        const res = await resetEventData();
        if (res.success) {
            router.refresh();
        } else {
            alert("Failed to reset");
        }
        setLoading(false);
    };

    return (
        <button
            onClick={handleReset}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-lg text-sm font-medium transition disabled:opacity-50"
        >
            {loading ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {loading ? "Resetting..." : "Reset All Data"}
        </button>
    );
}
