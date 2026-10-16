import { COMPANION_COLORS, type CustomCompanion } from "@/types/custom-companion";

const INK = "#1f2937";

/** Ears, antennae or horns, drawn behind the head. */
function Ears({ kind, body, shade }: { kind: CustomCompanion["ears"]; body: string; shade: string }) {
  switch (kind) {
    case "cat":
      return (
        <g>
          <path d="M20 40 L24 12 L44 26 Z" fill={body} />
          <path d="M80 40 L76 12 L56 26 Z" fill={body} />
          <path d="M25 33 L27 19 L37 27 Z" fill="#ffd1e3" />
          <path d="M75 33 L73 19 L63 27 Z" fill="#ffd1e3" />
        </g>
      );
    case "bunny":
      return (
        <g>
          <ellipse cx="34" cy="16" rx="8" ry="20" fill={body} />
          <ellipse cx="66" cy="16" rx="8" ry="20" fill={body} />
          <ellipse cx="34" cy="17" rx="4" ry="14" fill="#ffd1e3" />
          <ellipse cx="66" cy="17" rx="4" ry="14" fill="#ffd1e3" />
        </g>
      );
    case "bear":
      return (
        <g>
          <circle cx="24" cy="26" r="11" fill={body} />
          <circle cx="76" cy="26" r="11" fill={body} />
          <circle cx="24" cy="26" r="6" fill={shade} />
          <circle cx="76" cy="26" r="6" fill={shade} />
        </g>
      );
    case "antenna":
      return (
        <g>
          <path d="M50 22 Q46 12 52 5" stroke={shade} strokeWidth="3" fill="none" strokeLinecap="round" />
          <circle cx="52" cy="5" r="5" fill="#ffd86b" />
        </g>
      );
    case "horns":
      return (
        <g>
          <path d="M28 26 Q22 12 30 6 Q32 16 38 22 Z" fill="#fff4d6" stroke={shade} strokeWidth="1.5" />
          <path d="M72 26 Q78 12 70 6 Q68 16 62 22 Z" fill="#fff4d6" stroke={shade} strokeWidth="1.5" />
        </g>
      );
    default:
      return null;
  }
}

function OpenEye({ x, big = false }: { x: number; big?: boolean }) {
  const white = big ? 11 : 9;
  const pupil = big ? 7 : 5;
  return (
    <g>
      <circle cx={x} cy="50" r={white} fill="#ffffff" />
      <circle cx={x + 1} cy="51" r={pupil} fill={INK} />
      <circle cx={x + 3} cy="48" r={big ? 2.6 : 1.8} fill="#ffffff" />
      {big && <circle cx={x - 1.5} cy="54" r="1.2" fill="#ffffff" />}
    </g>
  );
}

function Eyes({ kind }: { kind: CustomCompanion["eyes"] }) {
  const arc = (x: number, up: boolean) => (
    <path d={up ? `M${x - 8} 53 Q${x} 43 ${x + 8} 53` : `M${x - 8} 49 Q${x} 56 ${x + 8} 49`} stroke={INK} strokeWidth="3.5" fill="none" strokeLinecap="round" />
  );
  const star = (x: number) => (
    <path
      d={`M${x} 40 L${x + 3} 47 L${x + 10} 47 L${x + 4.5} 51.5 L${x + 6.5} 59 L${x} 54.5 L${x - 6.5} 59 L${x - 4.5} 51.5 L${x - 10} 47 L${x - 3} 47 Z`}
      fill="#ffd86b"
      stroke={INK}
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  );
  switch (kind) {
    case "sparkle":
      return <g className="custom-companion__blink"><OpenEye x={36} big /><OpenEye x={64} big /></g>;
    case "happy":
      return <g>{arc(36, true)}{arc(64, true)}</g>;
    case "sleepy":
      return <g>{arc(36, false)}{arc(64, false)}</g>;
    case "star":
      return <g>{star(36)}{star(64)}</g>;
    case "wink":
      return <g><OpenEye x={36} />{arc(64, true)}</g>;
    default:
      return <g className="custom-companion__blink"><OpenEye x={36} /><OpenEye x={64} /></g>;
  }
}

function Mouth({ kind }: { kind: CustomCompanion["mouth"] }) {
  switch (kind) {
    case "open":
      return (
        <g>
          <path d="M40 64 Q50 80 60 64 Z" fill={INK} />
          <path d="M44 71 Q50 76 56 71 Q50 68 44 71 Z" fill="#ff7a9a" />
        </g>
      );
    case "tongue":
      return (
        <g>
          <path d="M40 65 Q50 73 60 65" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M47 69 Q50 78 53 69 Z" fill="#ff7a9a" />
        </g>
      );
    case "cat":
      return <path d="M41 66 Q45.5 71 50 66 Q54.5 71 59 66" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />;
    case "o":
      return <ellipse cx="50" cy="68" rx="4.5" ry="5.5" fill={INK} />;
    default:
      return <path d="M40 65 Q50 75 60 65" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />;
  }
}

/** A companion drawn from the parts the child chose. Scales to whatever box it is placed in. */
export function CustomCompanionArt({ parts, className = "" }: { parts: CustomCompanion; className?: string }) {
  const color = COMPANION_COLORS.find((option) => option.id === parts.color) ?? COMPANION_COLORS[0];
  return (
    <svg viewBox="0 0 100 100" className={`custom-companion ${className}`} aria-hidden="true">
      <Ears kind={parts.ears} body={color.body} shade={color.shade} />
      <ellipse cx="50" cy="56" rx="38" ry="36" fill={color.body} />
      <ellipse cx="50" cy="74" rx="22" ry="15" fill="#ffffff" opacity="0.35" />
      {parts.cheeks && (
        <g fill="#ff8fb1" opacity="0.55">
          <ellipse cx="24" cy="63" rx="6" ry="4" />
          <ellipse cx="76" cy="63" rx="6" ry="4" />
        </g>
      )}
      <Eyes kind={parts.eyes} />
      <Mouth kind={parts.mouth} />
    </svg>
  );
}
