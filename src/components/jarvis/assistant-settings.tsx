import { useEffect, useState } from "react";
import {
  Bot,
  BrainCircuit,
  Palette,
  Save,
  SlidersHorizontal,
  Sparkles,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type Settings = {
  personality: string;
  tone: string;
  verbosity: string;
  humor: number;
  proactive: boolean;
  confirm_actions: boolean;
  auto_memory: boolean;
  voice_speed: number;
  custom_instructions: string;
  motion_intensity: string;
};

const KEY = "jarvis-local-settings";

const defaults: Settings = {
  personality: "jarvis",
  tone: "calm",
  verbosity: "normal",
  humor: 20,
  proactive: true,
  confirm_actions: true,
  auto_memory: true,
  voice_speed: 0.98,
  custom_instructions: "",
  motion_intensity: "high",
};

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults;
    return { ...defaults, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return defaults;
  }
}

export function AssistantSettings() {
  const [settings, setSettings] = useState<Settings>(defaults);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  useEffect(() => {
    document.documentElement.dataset["motion"] = settings.motion_intensity;
  }, [settings.motion_intensity]);

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  function save() {
    localStorage.setItem(KEY, JSON.stringify(settings));
    toast.success("Configurações locais salvas.");
  }

  return (
    <div className="settings-console flex h-full flex-col">
      <div className="border-b border-primary/10 p-4">
        <div className="flex items-center gap-2 font-display text-[10px] uppercase tracking-[0.18em] text-primary">
          <SlidersHorizontal className="h-3.5 w-3.5" /> Configurações centrais
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Tudo fica salvo localmente neste computador.
        </p>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        <section className="settings-card">
          <div className="settings-card-title">
            <Bot className="h-4 w-4" /> Personalidade
          </div>
          <label className="settings-field">
            <span>Perfil</span>
            <select
              value={settings.personality}
              onChange={(e) => update("personality", e.target.value)}
            >
              <option value="jarvis">J.A.R.V.I.S. clássico</option>
              <option value="friendly">Amigável</option>
              <option value="professional">Profissional</option>
              <option value="coach">Coach</option>
              <option value="gamer">Companheiro gamer</option>
            </select>
          </label>
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
            <select
              value={settings.verbosity}
              onChange={(e) => update("verbosity", e.target.value)}
            >
              <option value="concise">Conciso</option>
              <option value="normal">Normal</option>
              <option value="detailed">Detalhado</option>
            </select>
          </label>
          <label className="settings-field">
            <span>Humor: {settings.humor}%</span>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={settings.humor}
              onChange={(e) => update("humor", Number(e.target.value))}
            />
          </label>
          <label className="settings-field">
            <span>Instruções</span>
            <textarea
              rows={4}
              value={settings.custom_instructions}
              onChange={(e) => update("custom_instructions", e.target.value)}
              placeholder="Ex.: fale de forma informal e seja direto."
            />
          </label>
        </section>

        <section className="settings-card">
          <div className="settings-card-title">
            <BrainCircuit className="h-4 w-4" /> Comportamento
          </div>
          {[
            ["proactive", "Proatividade"],
            ["confirm_actions", "Confirmar ações"],
            ["auto_memory", "Memória automática"],
          ].map(([key, title]) => (
            <label key={key} className="settings-toggle">
              <span>
                <strong>{title}</strong>
                <small>Preferência local do assistente.</small>
              </span>
              <input
                type="checkbox"
                checked={Boolean(settings[key as keyof Settings])}
                onChange={(e) => update(key as keyof Settings, e.target.checked as never)}
              />
            </label>
          ))}
        </section>

        <section className="settings-card">
          <div className="settings-card-title">
            <Palette className="h-4 w-4" /> Interface
          </div>
          <label className="settings-field">
            <span>Cor do núcleo</span>
            <input value="Ciano / âmbar" readOnly />
          </label>
          <label className="settings-field">
            <span>Intensidade das animações</span>
            <select
              value={settings.motion_intensity}
              onChange={(e) => update("motion_intensity", e.target.value)}
            >
              <option value="low">Baixa</option>
              <option value="medium">Média</option>
              <option value="high">Alta</option>
            </select>
          </label>
        </section>

        <section className="settings-card">
          <div className="settings-card-title">
            <Volume2 className="h-4 w-4" /> Voz local
          </div>
          <label className="settings-field">
            <span>Velocidade: {settings.voice_speed.toFixed(2)}×</span>
            <input
              type="range"
              min="0.75"
              max="1.25"
              step="0.05"
              value={settings.voice_speed}
              onChange={(e) => update("voice_speed", Number(e.target.value))}
            />
          </label>
        </section>
      </div>

      <div className="border-t border-primary/10 p-4">
        <Button onClick={save} className="w-full font-display text-xs uppercase tracking-[0.12em]">
          <Sparkles className="h-4 w-4" />
          <Save className="h-4 w-4" /> Salvar configurações
        </Button>
      </div>
    </div>
  );
}
