import jarvisCore from "@/assets/jarvis-core.png";
import { cn } from "@/lib/utils";

export function OrbitalCore({ active = false, muted = false }: { active?: boolean; muted?: boolean }) {
  return (
    <div
      className={cn("orbital-core", active && "orbital-core--active", muted && "orbital-core--muted")}
      data-active={active}
      aria-hidden="true"
    >
      <div className="orbital-aura" />
      <div className="orbital-ring orbital-ring--outer" />
      <div className="orbital-ring orbital-ring--middle" />
      <div className="orbital-ring orbital-ring--inner" />
      <div className="orbital-ring orbital-ring--ticks" />
      <div className="orbital-ring orbital-ring--radar" />
      <div className="orbital-sweep" />
      <div className="orbital-crosshair" />
      <div className="orbital-lens">
        <div className="orbital-lens-glass" />
        <img src={jarvisCore} alt="" width={1024} height={1024} />
        <span className="orbital-lens-scan" />
      </div>
      <div className="orbital-wave" />
      <span className="orbital-tick orbital-tick--top" />
      <span className="orbital-tick orbital-tick--bottom" />
      <span className="orbital-label orbital-label--top">J.A.R.V.I.S.</span>
      <span className="orbital-label orbital-label--left">CORE // ONLINE</span>
      <span className="orbital-label orbital-label--right">NEURAL LINK</span>
      <div className="orbital-node orbital-node--a" />
      <div className="orbital-node orbital-node--b" />
      <div className="orbital-node orbital-node--c" />
      <div className="orbital-node orbital-node--d" />
      <div className="orbital-particle-field">
        {Array.from({ length: 12 }, (_, i) => <i key={i} style={{ "--i": i } as React.CSSProperties} />)}
      </div>
    </div>
  );
}
