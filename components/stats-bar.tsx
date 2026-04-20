import { Company } from "@/data/types";
import { uniqueGroups, uniqueStates } from "@/lib/companies-utils";

export default function StatsBar({ companies }: { companies: Company[] }) {
  const total = companies.length;
  const states = uniqueStates(companies).length;
  const groups = uniqueGroups(companies).length;

  return (
    <div className="flex gap-3">
      {[
        { value: total, label: "Unidades" },
        { value: states, label: "Estados" },
        { value: groups, label: "Grupos" },
      ].map((s) => (
        <div
          key={s.label}
          className="text-center px-4 py-1.5 rounded-lg"
          style={{
            background: "rgba(139,90,43,0.08)",
            border: "1px solid rgba(139,90,43,0.2)",
          }}
        >
          <div className="text-lg font-bold" style={{ color: "var(--accent-dark)" }}>
            {s.value}
          </div>
          <div className="text-[9px] uppercase tracking-wider" style={{ color: "var(--text-dim)" }}>
            {s.label}
          </div>
        </div>
      ))}
    </div>
  );
}
