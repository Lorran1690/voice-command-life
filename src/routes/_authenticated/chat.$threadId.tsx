import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Activity, Aperture, Crosshair, Cpu, Gauge, LogOut, Orbit, Radio, ShieldCheck, Sparkles, Zap } from "lucide-react";

import { VoicePanel } from "@/components/jarvis/voice-panel";
import { clearLocalUser, getLocalUser } from "@/lib/local-mode";

export const Route = createFileRoute("/_authenticated/chat/$threadId")({
  head: () => ({
    meta: [
      { title: "J.A.R.V.I.S. — 3D Visual Demo" },
      { name: "description", content: "Demonstração visual do núcleo 3D J.A.R.V.I.S." },
    ],
  }),
  component: VisualDemoPage,
});

function VisualDemoPage() {
  const navigate = useNavigate();
  const operator = getLocalUser()?.name ?? "OPERADOR";

  function signOut() {
    clearLocalUser();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="jarvis-visual-command">
      <div className="jarvis-visual-grid" aria-hidden="true" />
      <div className="jarvis-visual-vignette" aria-hidden="true" />

      <header className="jarvis-visual-header">
        <div className="jarvis-visual-brand">
          <div className="jarvis-visual-brand-mark"><Aperture size={21} /></div>
          <div>
            <h1>J.A.R.V.I.S.</h1>
            <p>PERSONAL COMMAND SYSTEM <span>//</span> VISUAL LAB</p>
          </div>
        </div>

        <div className="jarvis-visual-header-center">
          <span className="jarvis-demo-led" />
          <span>3D CORE PREVIEW</span>
          <i />
          <span className="jarvis-visual-muted">WEBGL / SPATIAL RENDER</span>
        </div>

        <div className="jarvis-visual-header-actions">
          <div className="jarvis-visual-operator">
            <span>OPERATOR</span>
            <strong>{operator.toUpperCase()}</strong>
          </div>
          <button type="button" className="jarvis-visual-icon-button" onClick={signOut} aria-label="Sair da demo" title="Sair">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <main className="jarvis-visual-layout">
        <aside className="jarvis-demo-rail jarvis-demo-rail--left">
          <div className="jarvis-demo-section-title">
            <span>01</span><b>SCENE OVERVIEW</b><i />
          </div>

          <section className="jarvis-demo-panel jarvis-demo-identity">
            <div className="jarvis-demo-panel-topline"><ShieldCheck size={14} /><span>LOCAL VISUAL SESSION</span></div>
            <div className="jarvis-demo-identity-main">
              <div className="jarvis-demo-avatar"><Sparkles size={20} /></div>
              <div><small>OPERATOR PROFILE</small><strong>{operator.toUpperCase()}</strong></div>
            </div>
            <div className="jarvis-demo-divider" />
            <div className="jarvis-demo-readout"><span>SCENE TYPE</span><b>VOLUMETRIC CORE</b></div>
            <div className="jarvis-demo-readout"><span>RENDER PATH</span><b>WEBGL / GPU</b></div>
            <div className="jarvis-demo-readout"><span>COLOUR PROFILE</span><b>BLACK / VIOLET</b></div>
          </section>

          <section className="jarvis-demo-panel">
            <div className="jarvis-demo-panel-topline"><Orbit size={14} /><span>SPATIAL GEOMETRY</span></div>
            <div className="jarvis-demo-feature">
              <span className="jarvis-demo-feature-icon"><Aperture size={15} /></span>
              <div><strong>Volumetric sphere</strong><small>SHADER-LIT SURFACE</small></div>
              <span className="jarvis-demo-feature-led" />
            </div>
            <div className="jarvis-demo-feature">
              <span className="jarvis-demo-feature-icon"><Orbit size={15} /></span>
              <div><strong>3 orbital toruses</strong><small>TILTED IN 3D SPACE</small></div>
              <span className="jarvis-demo-feature-led" />
            </div>
            <div className="jarvis-demo-feature">
              <span className="jarvis-demo-feature-icon"><Sparkles size={15} /></span>
              <div><strong>Particle field</strong><small>DEPTH POSITIONED</small></div>
              <span className="jarvis-demo-feature-led" />
            </div>
          </section>

          <div className="jarvis-demo-rail-note">
            <span className="jarvis-demo-note-mark">i</span>
            <p>Inicie a chamada de voz para ver as partículas se organizarem em uma presença holográfica. Ao encerrar, ela se dissolve e volta a circular.</p>
          </div>
        </aside>

        <section className="jarvis-demo-stage" aria-label="Núcleo tridimensional JARVIS">
          <div className="jarvis-demo-stage-corners" aria-hidden="true"><i /><i /><i /><i /></div>
          <div className="jarvis-demo-stage-top">
            <div><span className="jarvis-demo-eyebrow">NEURAL INTERFACE / VISUALIZATION 001</span><h2>J.A.R.V.I.S. <em>CORE</em></h2></div>
            <div className="jarvis-demo-live-tag"><span /> LIVE RENDER</div>
          </div>

          <div className="jarvis-demo-orbital-field">
            <div className="jarvis-demo-nebula" aria-hidden="true" />
            <div className="jarvis-demo-starfield" aria-hidden="true" />
            <div className="jarvis-demo-depth-ring jarvis-demo-depth-ring--one" aria-hidden="true" />
            <div className="jarvis-demo-depth-ring jarvis-demo-depth-ring--two" aria-hidden="true" />
            <div className="jarvis-demo-depth-ring jarvis-demo-depth-ring--three" aria-hidden="true" />
            <div className="jarvis-demo-axis jarvis-demo-axis--x">X <span>AXIS</span></div>
            <div className="jarvis-demo-axis jarvis-demo-axis--y">Y <span>AXIS</span></div>
            <div className="jarvis-demo-axis jarvis-demo-axis--z">Z <span>AXIS</span></div>
            <div className="jarvis-demo-reticle jarvis-demo-reticle--one" aria-hidden="true" />
            <div className="jarvis-demo-reticle jarvis-demo-reticle--two" aria-hidden="true" />
            <VoicePanel className="jarvis-demo-voice-panel" coreClassName="jarvis-hero-core" particleAvatar />
          </div>

          <div className="jarvis-demo-core-label">
            <span className="jarvis-demo-core-line" />
            <div><strong>VOICE-REACTIVE AVATAR</strong><small>PARTICLE REST · LIVE VOICE · AUDIO LIP SYNC</small></div>
            <span className="jarvis-demo-core-line" />
          </div>

          <div className="jarvis-demo-stage-bottom">
            <div className="jarvis-demo-stage-metric"><Activity size={15} /><span>DEPTH RENDERING</span><b>ENABLED</b></div>
            <div className="jarvis-demo-stage-metric"><Crosshair size={15} /><span>SPATIAL AXES</span><b>X / Y / Z</b></div>
            <div className="jarvis-demo-stage-metric"><Radio size={15} /><span>POINTER PARALLAX</span><b>INTERACTIVE</b></div>
          </div>

          
        </section>

        <aside className="jarvis-demo-rail jarvis-demo-rail--right">
          <div className="jarvis-demo-section-title">
            <span>02</span><b>RENDER PIPELINE</b><i />
          </div>

          <section className="jarvis-demo-panel jarvis-demo-pipeline">
            <div className="jarvis-demo-panel-topline"><Cpu size={14} /><span>GRAPHICS ENGINE</span></div>
            <div className="jarvis-demo-pipeline-step"><div className="jarvis-demo-pipeline-number">01</div><div><strong>Vertex Geometry</strong><small>SPHERE / TORUS MESHES</small></div><span>✓</span></div>
            <div className="jarvis-demo-pipeline-step"><div className="jarvis-demo-pipeline-number">02</div><div><strong>Depth Projection</strong><small>PERSPECTIVE MATRIX</small></div><span>✓</span></div>
            <div className="jarvis-demo-pipeline-step"><div className="jarvis-demo-pipeline-number">03</div><div><strong>Lighting Shader</strong><small>RIM / DIFFUSE / SPECULAR</small></div><span>✓</span></div>
            <div className="jarvis-demo-pipeline-step"><div className="jarvis-demo-pipeline-number">04</div><div><strong>Motion Layer</strong><small>ROTATION / PARALLAX</small></div><span>✓</span></div>
          </section>

          <section className="jarvis-demo-panel jarvis-demo-spec-panel">
            <div className="jarvis-demo-panel-topline"><Gauge size={14} /><span>SCENE PARAMETERS</span></div>
            <div className="jarvis-demo-spec">
              <span>COORDINATES</span><div><b> X </b><b> Y </b><b> Z </b></div>
            </div>
            <div className="jarvis-demo-spec">
              <span>LIGHT MODEL</span><strong>FRESNEL + SPECULAR</strong>
            </div>
            <div className="jarvis-demo-spec">
              <span>ANIMATION</span><strong>VOICE-DRIVEN MORPH</strong>
            </div>
            <div className="jarvis-demo-spec">
              <span>BACKGROUND</span><strong>TRANSPARENT WEBGL</strong>
            </div>
          </section>

          <section className="jarvis-demo-status-panel">
            <div className="jarvis-demo-status-icon"><Zap size={16} /></div>
            <div><strong>PARTICLE LIFE SYSTEM</strong><p>As partículas circulam em repouso e se organizam em um avatar holográfico com movimento facial. Nesta prévia, a boca simula fala; no painel de voz, o estado acompanha a reprodução sonora.</p></div>
          </section>
        </aside>
      </main>

      <footer className="jarvis-visual-footer">
        <div><span className="jarvis-demo-led" /><span>J.A.R.V.I.S. VISUAL LAB</span></div>
        <span>LIVING PARTICLES <i /> AVATAR MORPH <i /> VOICE-REACTIVE MOTION</span>
        <span>BUILD / 3D CONCEPT</span>
      </footer>
    </div>
  );
}
