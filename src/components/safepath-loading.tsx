type SafePathLoadingProps = {
  label?: string;
  variant?: "screen" | "inline" | "button";
  tone?: "dark" | "light";
  className?: string;
};

export function SafePathLoading({
  label = "Ачаалж байна…",
  variant = "inline",
  tone = "dark",
  className = "",
}: SafePathLoadingProps) {
  const light = tone === "light";
  if (variant === "button") {
    return <span className="inline-flex shrink-0" aria-hidden="true"><LoadingMark mark="size-6 rounded-lg" icon="size-3" /></span>;
  }
  const mark = variant === "screen" ? "size-16 rounded-[22px]" : "size-9 rounded-xl";
  const icon = variant === "screen" ? "size-8" : "size-[18px]";

  if (variant === "screen") {
    return (
      <main
        className={`relative isolate flex min-h-dvh items-center justify-center overflow-hidden bg-[linear-gradient(155deg,#05090d_0%,#07151b_52%,#03080c_100%)] px-6 py-[calc(24px+env(safe-area-inset-top))] pb-[calc(24px+env(safe-area-inset-bottom))] ${className}`}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <span className="pointer-events-none absolute -right-24 top-[12%] size-72 rounded-full bg-[#06b6d4]/20 blur-3xl" aria-hidden="true" />
        <span className="pointer-events-none absolute -bottom-28 -left-24 size-80 rounded-full bg-[#0e7490]/30 blur-3xl" aria-hidden="true" />
        <div className="relative z-10 flex w-full max-w-[390px] flex-col items-center text-center">
          <LoadingMark mark={mark} icon={icon} />
          <p className="mt-7 text-xl font-bold tracking-[-0.03em] text-[#f0f6f1]">SafePath</p>
          <p className="mt-2 text-sm text-[#c2d0d5]">{label}</p>
        </div>
      </main>
    );
  }

  return (
    <div
      className={`flex items-center justify-center gap-3 px-4 py-3 ${light ? "text-[#526966]" : "text-[#c2d0d5]"} ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <LoadingMark mark={mark} icon={icon} light={light} />
      <span className="text-xs leading-5">{label}</span>
    </div>
  );
}

function LoadingMark({
  mark,
  icon,
  light = false,
  radius = 30, 
}: {
  mark: string;
  icon: string;
  light?: boolean;
  radius?: number;
}) {
  const color = light ? "text-[#0e7490]" : "text-[#67e8f9]";
  const r = Math.min(Math.max(radius, 0), 48);
  const a = 2;   
  const b = 98;  


  const d = [
    `M ${a + r} ${a}`,
    `H ${b - r}`,
    `A ${r} ${r} 0 0 1 ${b} ${a + r}`,
    `V ${b - r}`,
    `A ${r} ${r} 0 0 1 ${b - r} ${b}`,
    `H ${a + r}`,
    `A ${r} ${r} 0 0 1 ${a} ${b - r}`,
    `V ${a + r}`,
    `A ${r} ${r} 0 0 1 ${a + r} ${a}`,
    "Z",
  ].join(" ");

  return (
    <span className={`relative grid shrink-0 place-items-center ${mark}`}>
      <svg viewBox="0 0 100 100" className={`absolute inset-0 size-full ${color}`} fill="none" aria-hidden="true">
        <path d={d} stroke="currentColor" strokeOpacity="0.15" strokeWidth="3" />
        <path
          d={d}
          pathLength={100}
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="25 75"
        >
          <animate
            attributeName="stroke-dashoffset"
            from="0"
            to="-100"
            dur="1s"
            repeatCount="indefinite"
          />
        </path>
      </svg>
      <span className={`grid place-items-center bg-gradient-to-br from-[#67e8f9] to-[#0891b2] text-[#06212a] shadow-[0_6px_18px_rgba(6,182,212,.25)] ${variantRadius(mark)}`}>
        <svg viewBox="0 0 24 24" className={icon} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" strokeLinejoin="round" />
          <circle cx="12" cy="10" r="2.5" fill="currentColor" />
        </svg>
      </span>
    </span>
  );
}

function variantRadius(mark: string) {
  if (mark.startsWith("size-16")) return "size-12 rounded-[17px]";
  if (mark.startsWith("size-6")) return "size-4 rounded-[5px]";
  return "size-7 rounded-[9px]";
}
