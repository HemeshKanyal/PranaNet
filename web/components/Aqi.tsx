import { AQI_SCALE, aqiStyle } from "@/lib/aqi";

export function AqiChip({ value, size = "sm" }: { value: number | null; size?: "sm" | "lg" }) {
  if (value == null) return <span className="text-muted">—</span>;
  const s = aqiStyle(value);
  const cls = size === "lg" ? "px-3 py-1 text-base" : "px-2 py-0.5 text-xs";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${cls}`} style={{ background: s.bg, color: s.fg }}>
      {value}
      <span className="font-medium opacity-90">{s.cat}</span>
    </span>
  );
}

/** Horizontal AQI legend: category label + range under each colour step. */
export function AqiLegend({ className = "" }: { className?: string }) {
  let lo = 0;
  return (
    <div className={`text-[10px] ${className}`}>
      <div className="flex gap-0.5 overflow-hidden rounded">
        {AQI_SCALE.map((s) => {
          const range = `${lo}–${s.max}`;
          lo = s.max + 1;
          return (
            <div key={s.cat} className="flex-1 px-1 py-0.5 text-center font-medium" style={{ background: s.bg, color: s.fg }} title={`${s.cat}: ${range}. ${s.advice}`}>
              <div className="truncate">{s.cat}</div>
              <div className="opacity-80">{range}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
