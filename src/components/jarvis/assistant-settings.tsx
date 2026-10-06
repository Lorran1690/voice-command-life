import { useEffect, useMemo, useState } from "react";
import { Bot, BrainCircuit, Check, Palette, Save, SlidersHorizontal, Sparkles, Volume2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type Settings = {
  user_id: string;
  voice: string;
  browser_voice: string | null;
  personality: string;
  tone: string;
  verbosity: string;
  humor: number;
  proactive: boolean;
  confirm_actions: boolean;
  auto_memory: boolean;
  language: string;
  voice_speed: number;
  custom_instructions: string;
  hud_accent: string;
  motion_intensity: string;
};

const defaults: Omit<Settings, "user_id"> = {
  voice: "tempo",
  browser_voice: null,
  personality: "jarvis",
  tone: "calm",
  verbosity: "normal",
  humor: 20,
  proactive: true,
  confirm_actions: true,
  auto_memory: true,
  language: "pt-BR",
  voice_speed: 1,
  custom_instructions: "",
  hud_accent: "cyan",
  motion_intensity: "high",
};

const personalities = [
  ["jarvis", "J.A.R.V.I.S. clássico", "Elegante, calmo, técnico e prestativo."],
  ["friendly", "Amigável", "Mais próximo, leve e conversacional."],
  ["professional", "Profissional", "Objetivo, formal e focado em resultados."],
  ["coach", "Coach", "Motivador, orientado a ação e progresso."],
  ["gamer", "Companheiro gamer", "Informal, estratégico e descontraído."],
] as const;

export function AssistantSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void load();
    if ("speechSynthesis" in window) {
      const refresh = () => setVoices(window.speechSynthesis.getVoices().filter((voice) => voice.lang.toLowerCase().startsWith("pt")));
      refresh();
      window.speechSynthesis.addEventListener("voiceschanged", refresh);
      return () => window.speechSynthesis.removeEventListener("voiceschanged", refresh);
    }
  }, []);

  useEffect(() => {
    if (!settings) return;
    const accents: Record<string, string> = {
      cyan: "#22D3EE",
      blue: "#60A5FA",
      violet: "#A78BFA",
      amber: "#F5B942",
      green: "#34D399",
    };
    const accent = accents[settings.hud_accent] ?? accents.cyan;
    document.documentElement.style.setProperty("--primary", accent);
    document.documentElement.style.setProperty("--ring", accent);
    document.documentElement.style.setProperty("--hud", accent);
    document.documentElement.dataset.motion = settings.motion_intensity;
  }, [settings]);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("assistant_settings").select("*").eq("user_id", user.id).maybeSingle();
    if (data) {
      setSettings(data as Settings);
    } else {
      setSettings({ user_id: user.id, ...defaults });
    }
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("assistant_settings")
      .upsert(settings, { onConflict: "user_id" })
      .select("*")
      .single();
    setSaving(false);
    if (error || !data) {
      toast.error(error?.message ?? "Não foi possível salvar as configurações.");
      return;
    }
    setSettings(data as Settings);
    toast.success("Configurações do J.A.R.V.I.S. salvas.");
  }

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((current) => current ? { ...current, [key]: value } : current);
  };

  const selectedBrowserVoice = useMemo(
    () => voices.find((voice) => voice.name === settings?.browser_voice),
    [voices, settings?.browser_voice],
  );

  if (!settings) {
    return <div className="flex flex-1 items-center justify-center p-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="settings-console flex h-full flex-col">
      <div className="border-b border-primary/10 p-4">
        <div className="flex items-center gap-2 font-display text-[10px] uppercase tracking-[0.18em] text-primary">
          <SlidersHorizontal className="h-3.5 w-3.5" /> Configurações centrais
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Personalize voz, personalidade, comportamento e visual do seu assistente.</p>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        <section className="settings-card">
          <div className="settings-card-title"><Volume2 className="h-4 w-4" /> Voz</div>
          <label className="settings-field">
            <span>Voz ao vivo do provedor</span>
            <input value={settings.voice} onChange={(e) => update("voice", e.target.value)} placeholder="tempo" />
            <small>O valor precisa ser aceito pelo modelo de voz configurado.</small>
          </label>
          <label className="settings-field">
            <span>Voz do navegador</span>
            <select value={settings.browser_voice ?? ""} onChange={(e) => update("browser_voice", e.target.value || null)}>
              <option value="">Padrão do navegador</option>
              {voices.map((voice) => <option key={voice.name + voice.lang} value={voice.name}>{voice.name} · {voice.lang}</option>)}
            </select>
            {selectedBrowserVoice && <small>Leitura local ativa: {selectedBrowserVoice.name}</small>}
          </label>
          <label className="settings-field">
            <span>Velocidade da fala: {settings.voice_speed.toFixed(2)}×</span>
            <input type="range" min="0.75" max="1.25" step="0.05" value={settings.voice_speed} onChange={(e) => update("voice_speed", Number(e.target.value))} />
          </label>
        </section>

        <section className="settings-card">
          <div className="settings-card-title"><Bot className="h-4 w-4" /> Personalidade</div>
          <div className="settings-personality-grid">
            {personalities.map(([id, title, description]) => (
              <button key={id} type="button" className={settings.personality === id ? "settings-choice settings-choice--active" : "settings-choice"} onClick={() => update("personality", id)}>
                <strong>{title}</strong><span>{description}</span>
                {settings.personality === id && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
              </button>
            ))}
          </div>
          <label className="settings-field">
            <span>Tom</span>
            <select value={settings.tone} onChange={(e) => update("tone", e.target.value)}>
              <option value="calm">Calmo</option>
              <option value="warm">Acolhedor</option>
              <option value="direct">Direto</option>
              <option value="technical">Técnico</option>
              <option value="playful">Descontraído</option>
            </select>
          </label>
          <label className="settings-field">
            <span>Detalhamento</span>
            <select value={settings.verbosity} onChange={(e) => update("verbosity", e.target.value)}>
              <option value="concise">Conciso</option>
              <option value="normal">Normal</option>
              <option value="detailed">Detalhado</option>
            </select>
          </label>
          <label className="settings-field">
            <span>Humor: {settings.humor}%</span>
            <input type="range" min="0" max="100" step="5" value={settings.humor} onChange={(e) => update("humor", Number(e.target.value))} />
          </label>
          <label className="settings-field">
            <span>Instruções personalizadas</span>
            <textarea rows={4} value={settings.custom_instructions} onChange={(e) => update("custom_instructions", e.target.value)} placeholder="Ex.: fale comigo de forma informal e seja direto." />
          </label>
        </section>

        <section className="settings-card">
          <div className="settings-card-title"><BrainCircuit className="h-4 w-4" /> Comportamento</div>
          {[
            ["proactive", "Proatividade", "Antecipar sugestões úteis quando fizer sentido."],
            ["confirm_actions", "Confirmar ações", "Confirmar operações importantes depois de executá-las."],
            ["auto_memory", "Memória automática", "Guardar preferências e informações duradouras quando forem úteis."],
          ].map(([key, title, description]) => (
            <label key={key} className="settings-toggle">
              <span><strong>{title}</strong><small>{description}</small></span>
              <input type="checkbox" checked={Boolean(settings[key as keyof Settings])} onChange={(e) => update(key as keyof Settings, e.target.checked as never)} />
            </label>
          ))}
        </section>

        <section className="settings-card">
          <div className="settings-card-title"><Palette className="h-4 w-4" /> Interface HUD</div>
          <label className="settings-field">
            <span>Cor do núcleo</span>
            <select value={settings.hud_accent} onChange={(e) => update("hud_accent", e.target.value)}>
              <option value="cyan">Ciano</option><option value="blue">Azul</option><option value="violet">Violeta</option><option value="amber">Âmbar</option><option value="green">Verde</option>
            </select>
          </label>
          <label className="settings-field">
            <span>Intensidade das animações</span>
            <select value={settings.motion_intensity} onChange={(e) => update("motion_intensity", e.target.value)}>
              <option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option>
            </select>
          </label>
        </section>
      </div>

      <div className="border-t border-primary/10 p-4">
        <Button onClick={() => void save()} disabled={saving} className="w-full font-display text-xs uppercase tracking-[0.12em]">
          {saving ? <Sparkles className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Salvando…" : "Salvar configurações"}
        </Button>
      </div>
    </div>
  );
}
