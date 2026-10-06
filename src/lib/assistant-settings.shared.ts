export type AssistantPersonality = "jarvis" | "friendly" | "professional" | "coach" | "gamer";
export type AssistantTone = "calm" | "warm" | "direct" | "technical" | "playful";
export type AssistantVerbosity = "concise" | "normal" | "detailed";
export type MotionIntensity = "low" | "medium" | "high";

export type AssistantSettings = {
  user_id: string;
  voice: string;
  browser_voice: string | null;
  personality: AssistantPersonality;
  tone: AssistantTone;
  verbosity: AssistantVerbosity;
  humor: number;
  proactive: boolean;
  confirm_actions: boolean;
  auto_memory: boolean;
  language: string;
  voice_speed: number;
  custom_instructions: string;
  hud_accent: string;
  motion_intensity: MotionIntensity;
};

export const DEFAULT_ASSISTANT_SETTINGS: Omit<AssistantSettings, "user_id"> = {
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

export function buildAssistantInstructions(settings: AssistantSettings) {
  const personality = {
    jarvis: "elegante, técnico, calmo e levemente irônico, como um assistente pessoal sofisticado",
    friendly: "amigável, próximo e conversacional",
    professional: "profissional, objetivo e focado em resultados",
    coach: "motivador, orientado a ação e progresso",
    gamer: "informal, estratégico e descontraído",
  }[settings.personality];

  const tone = {
    calm: "mantenha um tom calmo",
    warm: "mantenha um tom acolhedor",
    direct: "seja direto e vá rapidamente ao ponto",
    technical: "priorize precisão técnica e explique decisões importantes",
    playful: "pode ser descontraído e usar humor com moderação",
  }[settings.tone];

  const verbosity = {
    concise: "prefira respostas curtas e densas",
    normal: "use respostas equilibradas",
    detailed: "explique com mais contexto quando isso ajudar",
  }[settings.verbosity];

  const lines = [
    "Perfil personalizado do assistente:",
    "- Personalidade: " + personality + ".",
    "- Tom: " + tone + ".",
    "- Detalhamento: " + verbosity + ".",
    "- Humor configurado em " + settings.humor + "%; nunca deixe o humor atrapalhar a clareza.",
    settings.proactive
      ? "- Seja proativo quando houver uma sugestão claramente útil, sem tomar decisões irreversíveis sozinho."
      : "- Não antecipe tarefas; responda ao pedido atual e aguarde novas instruções.",
    settings.confirm_actions
      ? "- Após concluir ações relevantes, informe claramente o que foi feito."
      : "- Não faça confirmações redundantes após ações simples.",
    settings.auto_memory
      ? "- Quando surgir uma preferência ou informação duradoura útil, você pode usar a memória automática."
      : "- Não memorize informações automaticamente; só use a memória quando o usuário pedir explicitamente.",
    settings.custom_instructions.trim()
      ? "- Instruções pessoais adicionais: " + settings.custom_instructions.trim()
      : "",
  ].filter(Boolean);

  return lines.join("\n");
}
