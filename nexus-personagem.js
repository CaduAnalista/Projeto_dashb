/* NEXUS — personagem animado
   Olhos que seguem o cursor, cabeça com atraso, piscadas e expressões.
   Uso: inclua o SVG com id="nexus" na página e carregue este arquivo.
   API: Nexus.expressao("curioso" | "feliz" | "pensando" | "erro")
        Nexus.reagir("erro", 2200)  → muda a expressão e volta ao normal */
(() => {
  "use strict";

  const svg = document.getElementById("nexus");
  if (!svg) return;

  const $ = (id) => document.getElementById(id);
  const limitar = (v, a, b) => Math.max(a, Math.min(b, v));
  const reduzirMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const cabeca = $("cabeca");
  const rosto = $("rosto");
  const sobE = $("sobE");
  const sobD = $("sobD");
  const boca = $("boca");
  const olhos = ["E", "D"].map((l) => ({
    iris: $("iris" + l),
    erro: $("erro" + l),
    pupila: $("pupila" + l),
    sup: $("palpSup" + l),
    inf: $("palpInf" + l)
  }));

  /* Cada expressão é um conjunto de números; a transição entre elas é suave. */
  const EXPRESSOES = {
    curioso: {
      palpSup: 0.12, palpInf: 0, sobEY: 0, sobER: 0, sobDY: -4, sobDR: -5,
      boca: [184, 214, 200, 221, 216, 211], erro: 0, pupila: 3.9, mirarX: 0, mirarY: 0, mirar: 0
    },
    feliz: {
      palpSup: 0.08, palpInf: 0.36, sobEY: -4, sobER: -3, sobDY: -4, sobDR: 3,
      boca: [179, 209, 200, 233, 221, 209], erro: 0, pupila: 4.4, mirarX: 0, mirarY: 0, mirar: 0
    },
    pensando: {
      palpSup: 0.2, palpInf: 0.04, sobEY: 3, sobER: 5, sobDY: -9, sobDR: -9,
      boca: [189, 217, 201, 214, 213, 215], erro: 0, pupila: 3.5, mirarX: 0.75, mirarY: -0.85, mirar: 1
    },
    erro: {
      palpSup: 0.3, palpInf: 0.06, sobEY: 3, sobER: 11, sobDY: 3, sobDR: -11,
      boca: [183, 223, 200, 209, 217, 223], erro: 1, pupila: 3.3, mirarX: 0, mirarY: 0.3, mirar: 0.55
    }
  };

  const achatar = (e) => {
    const r = { ...e, b0: e.boca[0], b1: e.boca[1], b2: e.boca[2], b3: e.boca[3], b4: e.boca[4], b5: e.boca[5] };
    delete r.boca;
    return r;
  };
  let nome = "curioso";
  let alvo = achatar(EXPRESSOES.curioso);
  const atual = { ...alvo };
  let tremerDesde = -1e9;

  function expressao(novo) {
    if (!EXPRESSOES[novo]) return;
    nome = novo;
    alvo = achatar(EXPRESSOES[novo]);
    if (novo === "erro") tremerDesde = performance.now();
  }

  let voltar = null;
  function reagir(novo, ms = 2200) {
    expressao(novo);
    clearTimeout(voltar);
    voltar = setTimeout(() => expressao("curioso"), ms);
  }

  /* Direção do olhar: (-1..1) em cada eixo. */
  const ponteiro = { x: 0, y: 0 };
  const olhar = { x: 0, y: 0 };      // olhos (rápidos)
  const giro = { x: 0, y: 0 };       // cabeça (lenta)
  let ultimoMovimento = performance.now();
  let proximoDesvio = 0;
  let desvio = { x: 0, y: 0 };

  if (!reduzirMovimento) {
    window.addEventListener("pointermove", (ev) => {
      const r = svg.getBoundingClientRect();
      const cx = r.left + r.width * 0.5;
      const cy = r.top + r.height * 0.33;
      const dx = (ev.clientX - cx) / (window.innerWidth * 0.38);
      const dy = (ev.clientY - cy) / (window.innerHeight * 0.38);
      ponteiro.x = Math.sign(dx) * Math.pow(Math.min(Math.abs(dx), 1), 0.85);
      ponteiro.y = Math.sign(dy) * Math.pow(Math.min(Math.abs(dy), 1), 0.85);
      ultimoMovimento = performance.now();
    }, { passive: true });

    document.addEventListener("mouseleave", () => { ponteiro.x = 0; ponteiro.y = 0; });
  }

  /* Piscadas */
  let piscadaInicio = -1;
  let proximaPiscada = performance.now() + 1800;
  const DURACAO_PISCADA = 170;

  const fmt = (n) => n.toFixed(2);
  const lidSup = (c) => {
    const y = -13 + c * 26;
    return `M-24 -32 H24 V${fmt(y)} Q0 ${fmt(y - 9)} -24 ${fmt(y)} Z`;
  };
  const lidInf = (c) => {
    const y = 13 - c * 26;
    return `M-24 32 H24 V${fmt(y)} Q0 ${fmt(y + 9)} -24 ${fmt(y)} Z`;
  };

  function quadro(t) {
    /* 1. Olhar ocioso: se o mouse parou, ele olha ao redor sozinho. */
    let mx = ponteiro.x;
    let my = ponteiro.y;
    if (!reduzirMovimento && t - ultimoMovimento > 3000) {
      if (t > proximoDesvio) {
        desvio = { x: (Math.random() - 0.5) * 1.1, y: (Math.random() - 0.5) * 0.6 };
        proximoDesvio = t + 1400 + Math.random() * 2400;
      }
      mx = desvio.x;
      my = desvio.y;
    }

    /* 2. Mistura com o olhar fixo de certas expressões (ex.: pensando olha para cima). */
    const m = limitar(atual.mirar, 0, 1);
    const alvoX = mx * (1 - m) + atual.mirarX * m;
    const alvoY = my * (1 - m) + atual.mirarY * m;

    /* 3. Olhos são rápidos, cabeça é lenta. */
    olhar.x += (alvoX - olhar.x) * 0.26;
    olhar.y += (alvoY - olhar.y) * 0.26;
    giro.x += (alvoX - giro.x) * 0.065;
    giro.y += (alvoY - giro.y) * 0.065;

    /* 4. Suaviza a expressão. */
    for (const k in alvo) atual[k] += (alvo[k] - atual[k]) * 0.13;

    /* 5. Piscar. */
    if (!reduzirMovimento && t > proximaPiscada && piscadaInicio < 0) {
      piscadaInicio = t;
      proximaPiscada = t + 2600 + Math.random() * 3800;
      if (Math.random() < 0.2) proximaPiscada = t + 380;
    }
    let piscar = 0;
    if (piscadaInicio >= 0) {
      const p = (t - piscadaInicio) / DURACAO_PISCADA;
      if (p >= 1) piscadaInicio = -1;
      else piscar = Math.sin(Math.PI * p) * 1.22;
    }

    /* 6. Aplica no desenho. */
    const cobertura = Math.max(atual.palpSup, piscar);
    olhos.forEach((o, i) => {
      /* o olho de dentro olha um pouco menos para o lado: dá sensação de convergência */
      const lado = i === 0 ? 1 : -1;
      const conv = olhar.x * lado > 0 ? 0.85 : 1;
      const ix = olhar.x * 7.2 * conv;
      const iy = olhar.y * 5.2;
      o.iris.setAttribute("transform", `translate(${fmt(ix)} ${fmt(iy)})`);
      o.erro.setAttribute("opacity", fmt(limitar(atual.erro, 0, 1)));
      o.pupila.setAttribute("r", fmt(atual.pupila));
      o.sup.setAttribute("d", lidSup(cobertura));
      o.inf.setAttribute("d", lidInf(atual.palpInf));
    });

    sobE.setAttribute("transform", `translate(172 ${fmt(126 + atual.sobEY)}) rotate(${fmt(atual.sobER)})`);
    sobD.setAttribute("transform", `translate(228 ${fmt(126 + atual.sobDY)}) rotate(${fmt(atual.sobDR)})`);
    boca.setAttribute("d",
      `M${fmt(atual.b0)} ${fmt(atual.b1)} Q${fmt(atual.b2)} ${fmt(atual.b3)} ${fmt(atual.b4)} ${fmt(atual.b5)}`);

    const dt = t - tremerDesde;
    const tremor = dt < 900 ? Math.sin(dt / 38) * 3.2 * Math.exp(-dt / 280) : 0;
    const rot = giro.x * 4.5 + tremor;
    cabeca.setAttribute("transform",
      `translate(${fmt(giro.x * 3.2)} ${fmt(giro.y * 2.2)}) rotate(${fmt(rot)} 200 262)`);
    rosto.setAttribute("transform", `translate(${fmt(giro.x * 2.6)} ${fmt(giro.y * 1.8)})`);

    requestAnimationFrame(quadro);
  }

  requestAnimationFrame(quadro);

  window.Nexus = { expressao, reagir, get atual() { return nome; } };
})();
