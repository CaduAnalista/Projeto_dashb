/* NEXUS — som da transição de portal
   Gerado na hora com a Web Audio API: não há arquivo de áudio para baixar.
   Linha do tempo (igual à animação): carga e vento subindo até ~1,1 s,
   depois o clarão (brilho + impacto grave), que some antes da troca de página (1,6 s).
   Uso: SomPortal.preparar() dentro do clique/Enter (o navegador só libera áudio
        depois de um gesto do usuário) e SomPortal.tocar() quando o portal abrir. */
(() => {
  "use strict";

  const Contexto = window.AudioContext || window.webkitAudioContext;
  let ctx = null;

  function preparar() {
    if (!Contexto) return;
    try {
      if (!ctx) ctx = new Contexto();
      if (ctx.state === "suspended") ctx.resume();
    } catch (erro) {
      ctx = null;
    }
  }

  /* Ruído branco reutilizável (vento e chiado do clarão). */
  let ruido = null;
  function bufferRuido() {
    if (ruido) return ruido;
    const tamanho = Math.floor(ctx.sampleRate * 2);
    ruido = ctx.createBuffer(1, tamanho, ctx.sampleRate);
    const dados = ruido.getChannelData(0);
    for (let i = 0; i < tamanho; i++) dados[i] = Math.random() * 2 - 1;
    return ruido;
  }

  /* Envelope: sobe até "pico" em "ataque" e cai até zero em "fim" (segundos, a partir de t0). */
  function envelope(ganho, t0, ataque, pico, fim, curva = "linear") {
    const g = ganho.gain;
    g.setValueAtTime(0.0001, t0);
    if (curva === "exp") {
      g.exponentialRampToValueAtTime(pico, t0 + ataque);
      g.exponentialRampToValueAtTime(0.0001, t0 + fim);
    } else {
      g.linearRampToValueAtTime(pico, t0 + ataque);
      g.linearRampToValueAtTime(0.0001, t0 + fim);
    }
  }

  function tocar() {
    if (!ctx || ctx.state !== "running") return;

    const t = ctx.currentTime + 0.02;
    const CLARAO = 1.1;

    /* Saída: volume geral e um compressor para nada estourar. */
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -16;
    compressor.ratio.value = 4;
    const mestre = ctx.createGain();
    mestre.gain.value = 0.55;
    mestre.connect(compressor).connect(ctx.destination);

    /* 1. Carga: dois osciladores subindo de tom, com o filtro abrindo. */
    const filtroCarga = ctx.createBiquadFilter();
    filtroCarga.type = "lowpass";
    filtroCarga.Q.value = 6;
    filtroCarga.frequency.setValueAtTime(260, t);
    filtroCarga.frequency.exponentialRampToValueAtTime(4200, t + CLARAO);
    const ganhoCarga = ctx.createGain();
    envelope(ganhoCarga, t, CLARAO - 0.08, 0.16, CLARAO + 0.06);
    filtroCarga.connect(ganhoCarga).connect(mestre);

    [["sawtooth", 1], ["triangle", 1.5], ["sine", 0.5]].forEach(([tipo, mult]) => {
      const osc = ctx.createOscillator();
      osc.type = tipo;
      osc.frequency.setValueAtTime(55 * mult, t);
      osc.frequency.exponentialRampToValueAtTime(440 * mult, t + CLARAO);
      osc.detune.value = tipo === "triangle" ? 7 : 0;
      osc.connect(filtroCarga);
      osc.start(t);
      osc.stop(t + CLARAO + 0.1);
    });

    /* 2. Vento: ruído passando por um filtro que sobe (o "whoosh" do túnel). */
    const vento = ctx.createBufferSource();
    vento.buffer = bufferRuido();
    const filtroVento = ctx.createBiquadFilter();
    filtroVento.type = "bandpass";
    filtroVento.Q.value = 0.9;
    filtroVento.frequency.setValueAtTime(240, t);
    filtroVento.frequency.exponentialRampToValueAtTime(5200, t + CLARAO);
    const ganhoVento = ctx.createGain();
    envelope(ganhoVento, t, CLARAO - 0.05, 0.38, CLARAO + 0.12);
    vento.connect(filtroVento).connect(ganhoVento).connect(mestre);
    vento.start(t);
    vento.stop(t + CLARAO + 0.15);

    /* 3. Clarão: acorde brilhante (dó maior agudo) que se apaga rápido. */
    [1046.5, 1568, 2093, 3136].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const g = ctx.createGain();
      envelope(g, t + CLARAO, 0.012, 0.1 / (i + 1) + 0.03, 0.46, "exp");
      osc.connect(g).connect(mestre);
      osc.start(t + CLARAO);
      osc.stop(t + CLARAO + 0.5);
    });

    /* chiado agudo junto com o clarão */
    const chiado = ctx.createBufferSource();
    chiado.buffer = bufferRuido();
    const filtroChiado = ctx.createBiquadFilter();
    filtroChiado.type = "highpass";
    filtroChiado.frequency.value = 3200;
    const ganhoChiado = ctx.createGain();
    envelope(ganhoChiado, t + CLARAO, 0.01, 0.22, 0.36, "exp");
    chiado.connect(filtroChiado).connect(ganhoChiado).connect(mestre);
    chiado.start(t + CLARAO);
    chiado.stop(t + CLARAO + 0.4);

    /* impacto grave: um "tum" que desce de tom */
    const grave = ctx.createOscillator();
    grave.type = "sine";
    grave.frequency.setValueAtTime(130, t + CLARAO);
    grave.frequency.exponentialRampToValueAtTime(38, t + CLARAO + 0.3);
    const ganhoGrave = ctx.createGain();
    envelope(ganhoGrave, t + CLARAO, 0.01, 0.55, 0.42, "exp");
    grave.connect(ganhoGrave).connect(mestre);
    grave.start(t + CLARAO);
    grave.stop(t + CLARAO + 0.45);
  }

  window.SomPortal = { preparar, tocar };
})();
