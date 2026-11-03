/* NEXUS — personagem animado (imagens 3D em camadas)
   Camadas: corpo (imagem inteira, com o miolo da cabeça escondido atrás)
          + cabeça recortada + íris desenhadas em SVG sobre os olhos vazios.
   Olhos rápidos, cabeça lenta, piscadas, olhar ocioso e expressões.
   API: Nexus.expressao("curioso" | "feliz" | "pensando" | "erro" | "pronto")
        Nexus.reagir("erro", 2200)  → muda a expressão e volta ao normal
        Nexus.olharPara(elemento)   → olha para um elemento da página (ex.: campo em foco)
        Nexus.atual                 → nome da expressão atual */
(() => {
  "use strict";

  const palco = document.getElementById("nexusPalco");
  if (!palco) return;

  const $ = (id) => document.getElementById(id);
  const limitar = (v, a, b) => Math.max(a, Math.min(b, v));
  const fmt = (n) => n.toFixed(2);
  const reduzirMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Medidas da imagem original (1105 × 1424). Tudo abaixo está nessa escala. */
  const LARGURA = 1105;
  const ALTURA = 1424;
  const PIVO = { x: 575, y: 520 };          // pescoço: ponto de giro da cabeça
  const CENTRO_OLHOS = { x: 582, y: 310 };  // referência para calcular a direção do olhar
  const NUCLEO = { x: 626, y: 737 };        // núcleo luminoso do peito

  const corpo = $("nexusCorpo");
  const cabeca = $("nexusCabeca");
  const nucleo = $("nexusNucleo");

  /* Cada olho: centro neutro da íris (olhando para quem vê), limites verticais e horizontais. */
  const olhos = [
    { lado: "E", neutro: { x: 511, y: 306 }, topo: 264, base: 340, x0: 444, x1: 556 },
    { lado: "D", neutro: { x: 655, y: 317 }, topo: 280, base: 349, x0: 616, x1: 713 }
  ].map((o) => ({
    ...o,
    iris: $("iris" + o.lado),
    brilho: $("brilho" + o.lado),
    pupila: $("pupila" + o.lado),
    erro: $("irisErro" + o.lado),
    sup: $("palpSup" + o.lado),
    cilio: $("cilio" + o.lado),
    inf: $("palpInf" + o.lado)
  }));

  /* Cada expressão é um conjunto de números; a transição entre elas é suave. */
  const EXPRESSOES = {
    curioso:  { palpSup: 0.06, palpInf: 0,    pupila: 17, erro: 0, inclinar: 0.5,  mirarX: 0,    mirarY: 0,    mirar: 0,    nucleo: 0 },
    feliz:    { palpSup: 0.02, palpInf: 0.28, pupila: 19, erro: 0, inclinar: -0.3, mirarX: 0,    mirarY: -0.1, mirar: 0.35, nucleo: 1 },
    /* login aceito: olhos bem abertos, olhando para quem está na tela */
    pronto:   { palpSup: 0,    palpInf: 0.06, pupila: 20, erro: 0, inclinar: 0,    mirarX: 0,    mirarY: 0,    mirar: 1,    nucleo: 1 },
    pensando: { palpSup: 0.24, palpInf: 0.08, pupila: 15, erro: 0, inclinar: -0.7, mirarX: 0.75, mirarY: -0.9, mirar: 1,    nucleo: 2 },
    erro:     { palpSup: 0.34, palpInf: 0.12, pupila: 13, erro: 1, inclinar: 0,    mirarX: 0,    mirarY: 0.35, mirar: 0.6,  nucleo: 3 }
  };

  let nome = "curioso";
  let alvo = { ...EXPRESSOES.curioso };
  const atual = { ...alvo };
  let tremerDesde = -1e9;

  function expressao(novo) {
    if (!EXPRESSOES[novo]) return;
    nome = novo;
    alvo = { ...EXPRESSOES[novo] };
    palco.dataset.expressao = novo;
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
  const giro = { x: 0, y: 0 };       // cabeça (lenta, com mola)
  const giroVel = { x: 0, y: 0 };
  let ultimoQuadro = performance.now();
  let ultimoMovimento = performance.now();
  let proximoDesvio = 0;
  let desvio = { x: 0, y: 0 };
  let elementoAlvo = null;

  /* Posições na tela guardadas em memória: medir a cada quadro obrigaria o navegador
     a recalcular estilos 60 vezes por segundo (pesa no celular). Remede ao rolar,
     redimensionar, trocar o alvo e, por garantia, a cada meio segundo. */
  let retPalco = palco.getBoundingClientRect();
  let retAlvo = null;
  let ultimaMedida = 0;
  function remedir() {
    retPalco = palco.getBoundingClientRect();
    retAlvo = elementoAlvo ? elementoAlvo.getBoundingClientRect() : null;
    ultimaMedida = performance.now();
  }
  window.addEventListener("scroll", remedir, { passive: true });

  function direcaoPara(px, py) {
    const r = retPalco;
    const cx = r.left + r.width * (CENTRO_OLHOS.x / LARGURA);
    const cy = r.top + r.height * (CENTRO_OLHOS.y / ALTURA);
    const dx = (px - cx) / Math.max(window.innerWidth * 0.36, 260);
    const dy = (py - cy) / Math.max(window.innerHeight * 0.36, 260);
    return {
      x: Math.sign(dx) * Math.pow(Math.min(Math.abs(dx), 1), 0.8),
      y: Math.sign(dy) * Math.pow(Math.min(Math.abs(dy), 1), 0.8)
    };
  }

  function seguirPonto(px, py) {
    const d = direcaoPara(px, py);
    ponteiro.x = d.x;
    ponteiro.y = d.y;
    ultimoMovimento = performance.now();
  }

  if (!reduzirMovimento) {
    window.addEventListener("pointermove", (ev) => {
      elementoAlvo = null;
      seguirPonto(ev.clientX, ev.clientY);
    }, { passive: true });

    /* No celular não há cursor: o olhar segue o toque. */
    window.addEventListener("touchstart", (ev) => {
      const t = ev.touches[0];
      if (t) seguirPonto(t.clientX, t.clientY);
    }, { passive: true });

    document.addEventListener("mouseleave", () => { ponteiro.x = 0; ponteiro.y = 0; });
  }

  /* Olhar para um elemento (ex.: o campo que está sendo preenchido). */
  function olharPara(elemento) {
    elementoAlvo = elemento || null;
    remedir();
    if (elementoAlvo) ultimoMovimento = performance.now();
  }

  /* Escala da imagem na tela, para converter deslocamentos da imagem em pixels. */
  let escala = 1;
  const medir = () => { escala = palco.clientWidth / LARGURA; remedir(); };
  medir();
  window.addEventListener("resize", medir);

  /* Com o personagem fora da tela (ex.: celular rolado até o formulário), não há o que desenhar. */
  let visivel = true;
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entradas) => { visivel = entradas[0].isIntersecting; }).observe(palco);
  }

  /* Só escreve no SVG/estilo quando o valor muda: em repouso, quase nada é redesenhado. */
  const gravados = new WeakMap();
  function definir(el, attr, valor) {
    let g = gravados.get(el);
    if (!g) { g = {}; gravados.set(el, g); }
    if (g[attr] === valor) return;
    g[attr] = valor;
    if (attr === "transform-css") el.style.transform = valor;
    else if (attr.startsWith("--")) el.style.setProperty(attr, valor);
    else el.setAttribute(attr, valor);
  }

  /* Piscadas */
  let piscadaInicio = -1;
  let proximaPiscada = performance.now() + 1600;
  const DURACAO_PISCADA = 180;

  /* Pálpebra superior: desce de cima; a borda é uma curva levemente arqueada. */
  function palpebraSuperior(o, c) {
    const borda = o.topo + c * (o.base - o.topo + 6);
    const curva = borda + 13 * (1 - c * 0.75);
    const meio = (o.x0 + o.x1) / 2;
    return {
      fundo: `M${o.x0} ${o.topo - 20} H${o.x1} V${fmt(borda)} Q${meio} ${fmt(curva)} ${o.x0} ${fmt(borda)} Z`,
      cilio: `M${o.x0} ${fmt(borda)} Q${meio} ${fmt(curva)} ${o.x1} ${fmt(borda)}`
    };
  }

  /* Pálpebra inferior: sobe de baixo, em arco (dá o "sorriso" dos olhos). */
  function palpebraInferior(o, c) {
    const borda = o.base - c * (o.base - o.topo);
    const curva = borda - 16 * Math.min(1, c * 3);
    const meio = (o.x0 + o.x1) / 2;
    return `M${o.x0} ${o.base + 20} H${o.x1} V${fmt(borda)} Q${meio} ${fmt(curva)} ${o.x0} ${fmt(borda)} Z`;
  }

  function quadro(t) {
    if (!visivel) {
      ultimoQuadro = t;
      requestAnimationFrame(quadro);
      return;
    }
    if (t - ultimaMedida > 500) remedir();

    /* 1. Para onde olhar: elemento em foco, cursor ou olhar ocioso. */
    if (elementoAlvo && retAlvo) {
      const r = retAlvo;
      const d = direcaoPara(r.left + Math.min(r.width * 0.35, 160), r.top + r.height / 2);
      ponteiro.x = d.x;
      ponteiro.y = d.y;
    }
    let mx = ponteiro.x;
    let my = ponteiro.y;
    if (!reduzirMovimento && !elementoAlvo && t - ultimoMovimento > 3000) {
      if (t > proximoDesvio) {
        desvio = { x: (Math.random() - 0.5) * 1.2, y: (Math.random() - 0.5) * 0.7 };
        proximoDesvio = t + 1400 + Math.random() * 2600;
      }
      mx = desvio.x;
      my = desvio.y;
    }
    if (reduzirMovimento) { mx = 0; my = 0; }

    /* 2. Mistura com o olhar fixo de certas expressões (ex.: pensando olha para cima). */
    const m = limitar(atual.mirar, 0, 1);
    const alvoX = mx * (1 - m) + atual.mirarX * m;
    const alvoY = my * (1 - m) + atual.mirarY * m;

    /* 3. Olhos são rápidos; a cabeça vem atrás, com uma mola (acelera, desacelera
          e passa um tiquinho do ponto, como um pescoço de verdade).
          Passos fixos de ~16 ms, para ter a mesma velocidade em telas de 60 ou 144 Hz. */
    const passos = limitar(Math.round((t - ultimoQuadro) / 16.7), 1, 4);
    ultimoQuadro = t;
    /* balanço leve e contínuo: ele nunca fica 100% parado */
    const balanco = reduzirMovimento ? 0 : 1;
    const cabecaX = alvoX + (Math.sin(t / 2300) * 0.07 + Math.sin(t / 3700) * 0.05) * balanco;
    const cabecaY = alvoY + Math.sin(t / 2900) * 0.05 * balanco;
    for (let p = 0; p < passos; p++) {
      olhar.x += (alvoX - olhar.x) * 0.26;
      olhar.y += (alvoY - olhar.y) * 0.26;
      giroVel.x = (giroVel.x + (cabecaX - giro.x) * 0.011) * 0.86;
      giroVel.y = (giroVel.y + (cabecaY - giro.y) * 0.011) * 0.86;
      giro.x += giroVel.x;
      giro.y += giroVel.y;

      /* 4. Suaviza a expressão. */
      for (const k in alvo) atual[k] += (alvo[k] - atual[k]) * 0.12;
    }

    /* 5. Piscar (às vezes duas vezes seguidas). */
    if (!reduzirMovimento && t > proximaPiscada && piscadaInicio < 0) {
      piscadaInicio = t;
      proximaPiscada = t + 2600 + Math.random() * 3800;
      if (Math.random() < 0.2) proximaPiscada = t + 360;
    }
    let piscar = 0;
    if (piscadaInicio >= 0) {
      const p = (t - piscadaInicio) / DURACAO_PISCADA;
      if (p >= 1) piscadaInicio = -1;
      else piscar = Math.sin(Math.PI * p) * 1.1;
    }

    /* 6. Olhos. Olhar para cima levanta a pálpebra; para baixo, abaixa. */
    const cobertura = limitar(Math.max(atual.palpSup + olhar.y * 0.08, piscar), 0, 1);
    olhos.forEach((o, i) => {
      /* o olho de dentro gira um pouco menos: dá sensação de convergência */
      const lado = i === 0 ? 1 : -1;
      const conv = olhar.x * lado > 0 ? 0.8 : 1;
      const ix = o.neutro.x + olhar.x * 21 * conv;
      const iy = o.neutro.y + olhar.y * 12;
      definir(o.iris, "transform", `translate(${fmt(ix)} ${fmt(iy)})`);
      /* o reflexo acompanha menos a íris: a luz vem de um ponto fixo */
      definir(o.brilho, "transform",
        `translate(${fmt(o.neutro.x + olhar.x * 14 * conv)} ${fmt(o.neutro.y + olhar.y * 8)})`);
      definir(o.pupila, "r", fmt(atual.pupila));
      definir(o.erro, "opacity", fmt(limitar(atual.erro, 0, 1) * 0.8));
      const sup = palpebraSuperior(o, cobertura);
      definir(o.sup, "d", sup.fundo);
      definir(o.cilio, "d", sup.cilio);
      definir(o.cilio, "opacity", fmt(limitar(cobertura * 6, 0, 1)));
      definir(o.inf, "d", palpebraInferior(o, limitar(atual.palpInf, 0, 1)));
    });

    /* 7. Cabeça: vira para os lados (giro 3D), inclina para cima/baixo, tomba um pouco
          e se desloca junto. A camada de trás cobre até ~40 px da imagem, então a soma
          dos deslocamentos abaixo não deve passar de ~35 px na borda do cabelo. */
    const dt = t - tremerDesde;
    const tremor = dt < 900 ? Math.sin(dt / 36) * Math.exp(-dt / 260) : 0;
    const respirar = reduzirMovimento ? 0 : Math.sin(t / 1700);
    const gx = limitar(giro.x, -1.15, 1.15);
    const gy = limitar(giro.y, -1.15, 1.15);
    const virar = gx * 9 + tremor * 6;                      // rotateY (graus)
    const acenar = -gy * 6;                                 // rotateX (graus)
    const tombar = gx * 1.6 + atual.inclinar * 0.6 + tremor * 0.8; // rotateZ (graus)
    const hx = (gx * 9 + tremor * 4) * escala;
    const hy = (gy * 6 + respirar * 0.8) * escala;
    definir(cabeca, "transform-css",
      `perspective(${fmt(1600 * escala)}px) translate(${fmt(hx)}px, ${fmt(hy)}px) ` +
      `rotateY(${fmt(virar)}deg) rotateX(${fmt(acenar)}deg) rotate(${fmt(tombar)}deg)`);
    definir(corpo, "transform-css", `translateY(${fmt(respirar * 1.6 * escala)}px)`);

    /* 8. Núcleo do peito: pulsa e muda de cor com a expressão.
          A variável fica no próprio núcleo, para não recalcular o estilo do palco inteiro. */
    definir(nucleo || palco, "--pulso", fmt(0.75 + Math.sin(t / (nome === "pensando" ? 260 : 900)) * 0.25));

    requestAnimationFrame(quadro);
  }

  /* Posiciona o núcleo luminoso a partir das medidas da imagem. */
  if (nucleo) {
    nucleo.style.left = `${(NUCLEO.x / LARGURA) * 100}%`;
    nucleo.style.top = `${(NUCLEO.y / ALTURA) * 100}%`;
  }
  cabeca.style.transformOrigin = `${(PIVO.x / LARGURA) * 100}% ${(PIVO.y / ALTURA) * 100}%`;

  palco.dataset.expressao = nome;
  requestAnimationFrame(quadro);

  window.Nexus = { expressao, reagir, olharPara, get atual() { return nome; } };
})();
