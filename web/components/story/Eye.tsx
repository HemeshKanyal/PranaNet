// Every node on the story site is an eye (docs/STORY.md "Visual language"):
// open = honest, half = offline, flagged = red, slashed = crossed out,
// sim = dotted outline (always labelled), official = gold reference station.
export type EyeState = "open" | "half" | "flagged" | "slashed" | "sim" | "official" | "closed";

const IRIS: Record<EyeState, string> = {
  open: "var(--color-olive)",
  sim: "var(--color-olive)",
  half: "var(--color-olive)",
  closed: "var(--color-olive)",
  flagged: "var(--color-vermilion)",
  slashed: "#8a7f74",
  official: "var(--color-saffron)",
};

export const EYE_LABEL: Record<EyeState, string> = {
  open: "honest node",
  half: "offline node",
  closed: "switched off",
  flagged: "flagged node",
  slashed: "slashed node",
  sim: "simulated node",
  official: "official reference station",
};

export function Eye({ state = "open", size = 44, blink = true, delay = 0, title, className = "" }: {
  state?: EyeState;
  size?: number;
  blink?: boolean;
  /** blink offset in seconds, so a crowd of eyes doesn't blink in unison */
  delay?: number;
  title?: string;
  className?: string;
}) {
  const outline = state === "official" ? "#b9770e" : state === "flagged" ? "var(--color-vermilion)" : "var(--color-kohl)";
  const canBlink = blink && (state === "open" || state === "sim" || state === "official" || state === "flagged");
  return (
    <svg
      viewBox="0 0 64 40"
      width={size}
      height={(size * 40) / 64}
      role="img"
      aria-label={title ?? EYE_LABEL[state]}
      className={`${canBlink ? "eye-blink" : ""} ${className}`}
      style={canBlink ? ({ ["--d" as string]: `${delay}s` } as React.CSSProperties) : undefined}
    >
      <title>{title ?? EYE_LABEL[state]}</title>
      {state === "flagged" && <path d="M1 20 Q32 -10 63 20 Q32 50 1 20Z" fill="var(--color-vermilion)" opacity="0.25" />}
      <g className="eye-ball" style={canBlink ? { animationDelay: `${delay}s` } : undefined}>
        <path
          d="M3 20 Q32 -5 61 20 Q32 45 3 20Z"
          fill={state === "official" ? "#fff3d6" : state === "slashed" ? "#e7dccb" : "#fffaf0"}
          stroke={outline}
          strokeWidth={state === "official" ? 3.5 : 2.5}
          strokeDasharray={state === "sim" ? "4 3" : undefined}
        />
        {state !== "closed" && (
          <>
            <circle cx="32" cy="20" r="10" fill={IRIS[state]} />
            <circle cx="32" cy="20" r="4.2" fill="var(--color-kohl)" />
            <circle cx="35" cy="17" r="1.8" fill="#fffaf0" />
          </>
        )}
      </g>
      {(state === "half" || state === "closed") && (
        <>
          <path d={state === "closed" ? "M3 20 Q32 -5 61 20 Q32 45 3 20Z" : "M3 20 Q32 -5 61 20 Q32 12 3 20Z"} fill="var(--color-olive)" stroke="var(--color-kohl)" strokeWidth="2.5" />
          <path d={state === "closed" ? "M5 21 Q32 34 59 21" : "M5 20 Q32 12 59 20"} fill="none" stroke="var(--color-kohl)" strokeWidth="2.5" strokeLinecap="round" />
        </>
      )}
      {state === "official" && <path d="M32 0.5l2 4 4.3.5-3.2 2.9.9 4.2L32 10l-4 2.1.9-4.2-3.2-2.9 4.3-.5z" fill="var(--color-saffron)" stroke="#b9770e" strokeWidth="0.8" />}
      {state === "slashed" && (
        <g stroke="var(--color-vermilion)" strokeWidth="4" strokeLinecap="round">
          <path d="M14 6 L50 34" />
          <path d="M50 6 L14 34" />
        </g>
      )}
    </svg>
  );
}
