import { useCallback, useEffect, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export type LiveEvent = {
  type: string;
  reason?: string;
  error?: { message?: string };
  usage?: { seconds?: number };
  finalized?: boolean;
  transport?: { type?: string; sdp?: string };
  delta?: string;
  [key: string]: unknown;
};

type LiveState = {
  status: "idle" | "connecting" | "connected" | "stopping" | "closed";
  error: string | null;
  hasConnected: boolean;
  finalized: boolean | null;
  muted: boolean;
  playbackBlocked: boolean;
};

const initialState: LiveState = {
  status: "idle",
  error: null,
  hasConnected: false,
  finalized: null,
  muted: false,
  playbackBlocked: false,
};

export function useLiveVoice(
  options: {
    url?: string;
    onEvent?: (event: LiveEvent) => void | Promise<void>;
  } = {},
) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const controller = useRef<ReturnType<typeof createRealtimeVoice> | null>(null);
  const mounted = useRef(false);
  const latest = useRef(options);
  const [call, setCall] = useState(initialState);

  useEffect(() => {
    latest.current = options;
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const voice = controller.current;
      controller.current = null;
      voice?.stop();
    };
  }, []);

  const start = useCallback(() => {
    if (!mounted.current || controller.current) return;
    const audio = audioRef.current;
    if (!audio) {
      setCall((previous) => ({ ...previous, error: "O áudio do canal de voz não está disponível." }));
      return;
    }

    const voice = createRealtimeVoice({
      tokenUrl: latest.current.url ?? "/api/realtime-token",
      audio,
      onEvent(event) {
        if (!mounted.current || controller.current !== voice) return;

        if (event.type === "app.connected") {
          setCall((previous) => ({ ...previous, status: "connected", hasConnected: true, error: null }));
        } else if (event.type === "app.stopping") {
          setCall((previous) => ({ ...previous, status: "stopping", playbackBlocked: false }));
        } else if (event.type === "app.closed") {
          controller.current = null;
          setCall((previous) => ({
            ...previous,
            status: "closed",
            muted: false,
            playbackBlocked: false,
            finalized: event.finalized === true,
          }));
        } else if (event.type === "app.playback.blocked" || event.type === "app.playback.resumed") {
          setCall((previous) => ({ ...previous, playbackBlocked: event.type === "app.playback.blocked" }));
        } else if (event.type === "app.error" || event.type === "error") {
          setCall((previous) => ({ ...previous, error: event.error?.message ?? "A solicitação de voz falhou." }));
        }

        try {
          void Promise.resolve(latest.current.onEvent?.(event)).catch((error) => {
            console.error("Live UI event handler failed", error);
          });
        } catch (error) {
          console.error("Live UI event handler failed", error);
        }
      },
    });

    controller.current = voice;
    setCall({ ...initialState, status: "connecting" });
    void voice.start();
  }, []);

  const stop = useCallback(() => {
    controller.current?.stop();
  }, []);

  const setMuted = useCallback((muted: boolean) => {
    if (controller.current?.setMuted(muted)) {
      setCall((previous) => ({ ...previous, muted }));
    }
  }, []);

  const resumePlayback = useCallback(() => {
    void controller.current?.resumePlayback();
  }, []);

  return { ...call, audioRef, start, stop, setMuted, resumePlayback };
}

type RealtimeOptions = {
  tokenUrl: string;
  audio: HTMLAudioElement;
  onEvent: (event: LiveEvent) => void;
};

function createRealtimeVoice(options: RealtimeOptions) {
  let state: "idle" | "starting" | "active" | "stopping" | "closed" = "idle";
  let peer: RTCPeerConnection | undefined;
  let channel: RTCDataChannel | undefined;
  let microphone: MediaStream | undefined;
  let playback: MediaStream | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let cancelGathering: (() => void) | undefined;
  let finalized = false;
  let muted = false;

  function emit(event: LiveEvent) {
    options.onEvent(event);
  }

  function stopAudio() {
    microphone?.getTracks().forEach((track) => track.stop());
    microphone = undefined;
    if (playback && options.audio.srcObject === playback) {
      options.audio.pause();
      options.audio.srcObject = null;
    }
    playback = undefined;
  }

  function release() {
    if (state === "closed") return;
    state = "closed";
    clearTimeout(deadline);
    cancelGathering?.();
    stopAudio();
    channel?.close();
    peer?.close();
    channel = undefined;
    peer = undefined;
    emit({ type: "app.closed", finalized });
  }

  function stop() {
    if (state === "stopping" || state === "closed") return;
    state = "stopping";
    clearTimeout(deadline);
    cancelGathering?.();
    emit({ type: "app.stopping" });
    release();
  }

  function setMuted(value: boolean) {
    if (state !== "starting" && state !== "active") return false;
    muted = value;
    microphone?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
    return true;
  }

  async function resumePlayback() {
    if ((state !== "starting" && state !== "active") || !options.audio.srcObject) return;
    try {
      await options.audio.play();
      if (state === "starting" || state === "active") emit({ type: "app.playback.resumed" });
    } catch {
      if (state === "starting" || state === "active") emit({ type: "app.playback.blocked" });
    }
  }

  function fail(message: string) {
    if (state === "stopping" || state === "closed") return;
    emit({ type: "app.error", error: { message } });
    stop();
  }

  async function gatherCandidates(connection: RTCPeerConnection) {
    if (connection.iceGatheringState === "complete") return;
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => finish(new Error("A configuração de rede de voz expirou.")), 10_000);

      function finish(error?: Error) {
        clearTimeout(timeout);
        connection.removeEventListener("icegatheringstatechange", changed);
        cancelGathering = undefined;
        if (error) reject(error);
        else resolve();
      }

      function changed() {
        if (connection.iceGatheringState === "complete") finish();
      }

      cancelGathering = () => finish(new Error("Canal de voz encerrado."));
      connection.addEventListener("icegatheringstatechange", changed);
      changed();
    });
  }

  function handleRealtimeEvent(event: LiveEvent) {
    if (event.type === "session.created") {
      clearTimeout(deadline);
      emit({ type: "session.started", session: event.session });
      if (state === "starting") {
        state = "active";
        emit({ type: "app.connected" });
        void resumePlayback();
      }
      return;
    }

    if (
      event.type === "conversation.item.input_audio_transcription.delta" ||
      event.type === "response.output_audio_transcript.delta"
    ) {
      emit({
        type: event.type.includes("input_audio") ? "session.input_transcript.delta" : "session.output_transcript.delta",
        delta: typeof event.delta === "string" ? event.delta : "",
      });
      return;
    }

    if (event.type === "error") {
      const error = typeof event.error === "object" && event.error !== null ? event.error as { message?: string } : undefined;
      emit({ type: "app.error", error: { message: error?.message ?? "O servidor de voz retornou um erro." } });
      return;
    }

    if (event.type === "input_audio_buffer.speech_started") {
      emit({ type: "app.speech.started" });
      return;
    }

    if (event.type === "input_audio_buffer.speech_stopped") {
      emit({ type: "app.speech.stopped" });
      return;
    }

    if (event.type === "response.done") {
      finalized = true;
      emit(event);
    }
  }

  async function start() {
    if (state !== "idle") return;
    state = "starting";

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Sua sessão expirou. Entre novamente.");

      const tokenResponse = await fetch(options.tokenUrl, {
        method: "GET",
        headers: { Authorization: "Bearer " + session.access_token },
        cache: "no-store",
      });
      if (!tokenResponse.ok) {
        const body = await tokenResponse.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error || "A voz independente não está disponível.");
      }

      const tokenBody = await tokenResponse.json() as { value?: string };
      const ephemeralKey = tokenBody.value;
      if (!ephemeralKey) throw new Error("O servidor não retornou a credencial temporária de voz.");

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      microphone = stream;

      const connection = new RTCPeerConnection();
      peer = connection;

      for (const track of stream.getAudioTracks()) {
        track.enabled = !muted;
        track.addEventListener("ended", () => fail("O microfone foi desconectado."));
        connection.addTrack(track, stream);
      }

      connection.addEventListener("track", ({ track }) => {
        if (state === "stopping" || state === "closed") return;
        playback = new MediaStream([track]);
        options.audio.srcObject = playback;
        options.audio.autoplay = true;
        void resumePlayback();
      });

      connection.addEventListener("connectionstatechange", () => {
        if (connection.connectionState === "failed") fail("A conexão de voz falhou.");
        else if (connection.connectionState === "closed" && state !== "stopping") fail("A conexão de voz foi encerrada.");
      });

      channel = connection.createDataChannel("oai-events");
      channel.addEventListener("open", () => {
        if (state === "starting" && connection.connectionState === "connected") {
          state = "active";
          emit({ type: "app.connected" });
          void resumePlayback();
        }
      });
      channel.addEventListener("message", ({ data }) => {
        try {
          if (typeof data !== "string") throw new Error("Evento de voz inválido.");
          const event = JSON.parse(data) as LiveEvent;
          handleRealtimeEvent(event);
        } catch {
          fail("O canal de voz enviou um evento inválido.");
        }
      });
      channel.addEventListener("error", () => fail("O canal de eventos de voz falhou."));
      channel.addEventListener("close", () => {
        if (state !== "stopping" && state !== "closed") release();
      });

      await connection.setLocalDescription(await connection.createOffer());
      await gatherCandidates(connection);
      const offerSdp = connection.localDescription?.sdp;
      if (!offerSdp) throw new Error("Não foi possível criar a oferta de voz.");

      deadline = setTimeout(() => fail("A sessão de voz demorou demais para iniciar."), 20_000);

      const answerResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + ephemeralKey,
          "Content-Type": "application/sdp",
        },
        body: offerSdp,
      });

      if (!answerResponse.ok) {
        const message = (await answerResponse.text()).slice(0, 400);
        throw new Error(message || "A API de voz recusou a conexão.");
      }

      await connection.setRemoteDescription({
        type: "answer",
        sdp: await answerResponse.text(),
      });

      if (connection.connectionState === "connected" && channel.readyState === "open") {
        state = "active";
        clearTimeout(deadline);
        emit({ type: "app.connected" });
        void resumePlayback();
      }
    } catch (error) {
      fail(error instanceof Error ? error.message : "Não foi possível iniciar o canal de voz.");
    }
  }

  return { start, stop, setMuted, resumePlayback };
}
