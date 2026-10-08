import jarvisCore from "@/assets/jarvis-core.png";
import type { VoicePhase } from "@/components/jarvis/hud-state";
import { cn } from "@/lib/utils";

export function OrbitalCore({
  active = false,
  muted = false,
  phase = "ready",
}: {
  active?: boolean;
  muted?: boolean;
  phase?: VoicePhase;
}) {
  return (
    <div
      className={cn(
        "command-core",
        active && "command-core--active",
        muted && "command-core--muted",
      )}
      data-phase={phase}
      aria-hidden="true"
    >
      <div className="core-axis core-axis--horizontal" />
      <div className="core-axis core-axis--vertical" />
      <div className="core-ring core-ring--ticks" />
      <div className="core-ring core-ring--outer" />
      <div className="core-ring core-ring--middle" />
      <div className="core-ring core-ring--inner" />
      <div className="core-wave" />
      <div className="core-lens">
        <img src={jarvisCore} alt="" width={1024} height={1024} />
        <span className="core-lens-line" />
      </div>
      <span className="core-marker core-marker--top" />
      <span className="core-marker core-marker--bottom" />
    </div>
  );
}
