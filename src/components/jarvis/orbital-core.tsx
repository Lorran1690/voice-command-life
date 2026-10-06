import jarvisCore from "@/assets/jarvis-core.png";
import { cn } from "@/lib/utils";

export function OrbitalCore({ active = false, muted = false }: { active?: boolean; muted?: boolean }) {
  return (
    <div className={cn("orbital-core", active && "orbital-core--active", muted && "orbital-core--muted")} data-active={active} aria-hidden="true">
      <div className="orbital-ring orbital-ring--outer" />
      <div className="orbital-ring orbital-ring--middle" />
      <div className="orbital-ring orbital-ring--inner" />
      <div className="orbital-crosshair" />
      <div className="orbital-lens"><img src={jarvisCore} alt="" width={1024} height={1024} /></div>
      <div className="orbital-wave" />
      <span className="orbital-tick orbital-tick--top" />
      <span className="orbital-tick orbital-tick--bottom" />
    </div>
  );
}