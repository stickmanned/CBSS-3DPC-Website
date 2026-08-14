import type { AdminActionState } from "@/app/admin/actions";

const toneClass: Record<AdminActionState["tone"], string> = {
  idle: "border-transparent bg-transparent text-slate",
  success: "border-navy/20 bg-cloud text-navy",
  warning: "border-signal bg-signal/20 text-ink",
  error: "border-ink/20 bg-ink text-white",
};

export default function ActionMessage({ state }: { state: AdminActionState }) {
  if (!state.message) return null;
  return (
    <p
      className={`rounded-xl border px-4 py-3 text-sm font-semibold ${toneClass[state.tone]}`}
      role={state.tone === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      {state.message}
    </p>
  );
}

