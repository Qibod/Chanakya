import { Construction } from "lucide-react";

export default function ComingSoonPage() {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-slate-400">
      <Construction size={48} className="text-indigo-500/60" />
      <h1 className="text-2xl font-semibold text-slate-200 capitalize">Coming soon</h1>
      <p className="text-sm text-slate-400">This section is planned for a future sprint.</p>
    </div>
  );
}
