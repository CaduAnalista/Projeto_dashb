/* NEXUS — som da transição de portal ("mudança de realidade")
   Gerado na hora com a Web Audio API: não há arquivo de áudio para baixar.
   Clima espacial e suave, sem estalos: tudo passa por um reverb (eco de sala
   enorme, também gerado aqui) e é espalhado entre os lados esquerdo e direito.
   É UM SÓ som, que sobe e desce sem pausa, e termina todo aqui no login:
   o navegador corta qualquer áudio ao trocar de página, então o silêncio tem
   que chegar antes disso (pedido do autor: som fluido, sem parar e voltar).
   Linha do tempo (igual à animação de 2,8 s):
     0 → 1,4 s   um acorde de fundo vai crescendo e o ar "sopra" de um lado ao outro;
     0,8 → 1,4 s um grave bem macio cresce por baixo;
     1,0 → 2,1 s brilhos agudos, como estrelas, entram um a um;
     1,4 → 2,75 s tudo vai diminuindo aos poucos, numa curva só, até o silêncio,
                  junto com a névoa cobrindo a tela; a página troca em 2,8 s.
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

  /* Ruído branco reutilizável (o "ar" do portal). */
  let ruido = null;
  function bufferRuido() {
    if (ruido) return ruido;
    const tamanho = Math.floor(ctx.sampleRate * 3);
    ruido = ctx.createBuffer(1, tamanho, ctx.sampleRate);
    const dados = ruido.getChannelData(0);
    for (let i = 0; i < tamanho; i++) dados[i] = Math.random() * 2 - 1;
    return ruido;
  }

  /* Resposta do reverb: ruído estéreo que se apaga devagar (~2,8 s), um pouco
     abafado, como o eco de um espaço muito grande. */
  let respostaReverb = null;
  function bufferReverb() {
    if (respostaReverb) return respostaReverb;
    const segundos = 2.8;
    const tamanho = Math.floor(ctx.sampleRate * segundos);
    respostaReverb = ctx.createBuffer(2, tamanho, ctx.sampleRate);
    for (let canal = 0; canal < 2; canal++) {
      const dados = respostaReverb.getChannelData(canal);
      let anterior = 0;
      for (let i = 0; i < tamanho; i++) {
        const queda = Math.pow(1 - i / tamanho, 3.2);
        /* filtro simples: mistura com a amostra anterior para abafar os agudos */
        anterior = anterior * 0.55 + (Math.random() * 2 - 1) * 0.45;
        dados[i] = anterior * queda;
      }
    }
    return respostaReverb;
  }

  /* Liga um som à saída: parte direto, parte no reverb, numa posição do estéreo. */
  function ligar(no, saida, posicao = 0) {
    if (ctx.createStereoPanner) {
      const pan = ctx.createStereoPanner();
      pan.pan.value = posicao;
      no.connect(pan);
      pan.connect(saida.seco);
      pan.connect(saida.reverb);
      return pan;
    }
    no.connect(saida.seco);
    no.connect(saida.reverb);
    return null;
  }

  /* Curva suave de "de" até "ate": começa a baixar devagar, desce no meio e
     chega ao fim macio, sem degrau. */
  function curvaQueda(de, ate) {
    const pontos = 96;
    const curva = new Float32Array(pontos);
    for (let i = 0; i < pontos; i++) {
      const x = i / (pontos - 1);
      curva[i] = ate + (de - ate) * Math.pow(Math.cos((x * Math.PI) / 2), 2.2);
    }
    return curva;
  }

  function tocar() {
    if (!ctx || ctx.state !== "running") return false;

    const t = ctx.currentTime + 0.02;
    const PICO = 1.4;   /* ponto mais alto */
    const FIM = 2.75;   /* silêncio total (a página troca em 2,8 s) */
    const VOLUME = 0.65;

    /* Saída: volume geral (sobe com cada som e desce numa curva só),
       compressor bem leve, parte seca e reverb. */
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.02;
    compressor.release.value = 0.3;
    const mestre = ctx.createGain();
    mestre.gain.setValueAtTime(VOLUME, t);
    mestre.gain.setValueCurveAtTime(curvaQueda(VOLUME, 0), t + PICO, FIM - PICO);
    mestre.connect(compressor).connect(ctx.destination);

    const seco = ctx.createGain();
    seco.gain.value = 0.45;
    seco.connect(mestre);
    const reverb = ctx.createConvolver();
    reverb.buffer = bufferReverb();
    const molhado = ctx.createGain();
    molhado.gain.value = 0.8;
    reverb.connect(molhado).connect(mestre);
    const saida = { seco, reverb };

    /* 1. Acorde de fundo (lá, mi, si, mi): cresce devagar, o filtro abre até o
          pico e depois fecha (o som se afasta), e o tom sobe só um pouquinho. */
    const filtroAcorde = ctx.createBiquadFilter();
    filtroAcorde.type = "lowpass";
    filtroAcorde.Q.value = 0.7;
    filtroAcorde.frequency.setValueAtTime(380, t);
    filtroAcorde.frequency.exponentialRampToValueAtTime(2400, t + PICO + 0.2);
    filtroAcorde.frequency.exponentialRampToValueAtTime(800, t + FIM);
    const ganhoAcorde = ctx.createGain();
    ganhoAcorde.gain.setValueAtTime(0.0001, t);
    ganhoAcorde.gain.linearRampToValueAtTime(0.09, t + PICO);
    filtroAcorde.connect(ganhoAcorde);
    ligar(ganhoAcorde, saida, 0);

    [110, 164.81, 246.94, 329.63].forEach((freq, i) => {
      [-6, 6].forEach((desafino, lado) => {
        const osc = ctx.createOscillator();
        osc.type = lado === 0 ? "sine" : "triangle";
        osc.frequency.value = freq;
        osc.detune.setValueAtTime(desafino, t);
        osc.detune.linearRampToValueAtTime(desafino + 50, t + PICO + 0.3);
        if (ctx.createStereoPanner) {
          const pan = ctx.createStereoPanner();
          pan.pan.value = (i / 3 - 0.5) * 1.2 * (lado === 0 ? 1 : -1);
          osc.connect(pan).connect(filtroAcorde);
        } else {
          osc.connect(filtroAcorde);
        }
        osc.start(t);
        osc.stop(t + FIM + 0.05);
      });
    });

    /* 2. Ar: ruído num filtro que sobe até o pico e depois assenta,
          passando de um lado ao outro e voltando ao centro. */
    const ar = ctx.createBufferSource();
    ar.buffer = bufferRuido();
    const filtroAr = ctx.createBiquadFilter();
    filtroAr.type = "bandpass";
    filtroAr.Q.value = 0.6;
    filtroAr.frequency.setValueAtTime(350, t);
    filtroAr.frequency.exponentialRampToValueAtTime(2600, t + PICO + 0.2);
    filtroAr.frequency.exponentialRampToValueAtTime(700, t + FIM);
    const ganhoAr = ctx.createGain();
    ganhoAr.gain.setValueAtTime(0.0001, t);
    ganhoAr.gain.linearRampToValueAtTime(0.16, t + PICO);
    ar.connect(filtroAr).connect(ganhoAr);
    const panAr = ligar(ganhoAr, saida, -0.7);
    if (panAr) {
      panAr.pan.setValueAtTime(-0.7, t);
      panAr.pan.linearRampToValueAtTime(0.7, t + PICO);
      panAr.pan.linearRampToValueAtTime(0, t + FIM);
    }
    ar.start(t);
    ar.stop(t + FIM + 0.05);

    /* 3. Brilhos: notas agudas e suaves, cada uma de um lado, quase todas no reverb. */
    [[1.0, 1318.5, -0.5], [1.25, 1760, 0.45], [1.5, 1975.5, -0.25], [1.75, 2637, 0.6], [2.05, 2217.5, -0.6]]
      .forEach(([quando, freq, posicao]) => {
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t + quando);
        g.gain.linearRampToValueAtTime(0.035, t + quando + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, t + quando + 1.1);
        ligar(g, saida, posicao);
        [[freq, 1], [freq * 2, 0.25]].forEach(([f, peso]) => {
          const osc = ctx.createOscillator();
          osc.type = "sine";
          osc.frequency.value = f;
          const parcial = ctx.createGain();
          parcial.gain.value = peso;
          osc.connect(parcial).connect(g);
          osc.start(t + quando);
          osc.stop(t + Math.min(quando + 1.15, FIM + 0.05));
        });
      });

    /* 4. Grave macio: cresce por baixo até o pico, sem batida. */
    const grave = ctx.createOscillator();
    grave.type = "sine";
    grave.frequency.setValueAtTime(49, t + 0.8);
    grave.frequency.linearRampToValueAtTime(58, t + FIM);
    const ganhoGrave = ctx.createGain();
    ganhoGrave.gain.setValueAtTime(0.0001, t + 0.8);
    ganhoGrave.gain.linearRampToValueAtTime(0.18, t + PICO);
    grave.connect(ganhoGrave).connect(seco);
    grave.start(t + 0.8);
    grave.stop(t + FIM + 0.05);
    return true;
  }

  window.SomPortal = { preparar, tocar };
})();
