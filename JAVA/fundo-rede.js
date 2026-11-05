/* NEXUS — fundo animado: pontos que se ligam formando uma rede de dados.
   Leve de propósito: poucos pontos, pausa quando a aba está escondida
   e fica parado se o usuário pediu menos movimento. */
(() => {
  "use strict";

  const canvas = document.getElementById("fundoRede");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const reduzirMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  /* As cores vêm das variáveis CSS, para a rede acompanhar o modo alerta (vermelho).
     Ler o estilo a cada quadro pesa; por isso só lemos durante ~0,7 s depois que a
     classe do <html> muda (o tempo da transição de cor). */
  const estilo = getComputedStyle(document.documentElement);
  let COR_PONTO = "#00E5FF";
  let COR_LINHA = "#3D7BFF";
  let lerCoresAte = performance.now() + 700;
  function lerCores() {
    if (performance.now() > lerCoresAte) return;
    COR_PONTO = estilo.getPropertyValue("--nexus-primaria").trim() || COR_PONTO;
    COR_LINHA = estilo.getPropertyValue("--nexus-secundaria").trim() || COR_LINHA;
  }
  new MutationObserver(() => { lerCoresAte = performance.now() + 700; })
    .observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  const DISTANCIA = 140;
  const DISTANCIA2 = DISTANCIA * DISTANCIA;
  const DISTANCIA_MOUSE = DISTANCIA * 1.3;
  const DISTANCIA_MOUSE2 = DISTANCIA_MOUSE * DISTANCIA_MOUSE;

  /* Dobra espacial: os pontos disparam do centro para fora, como estrelas em alta velocidade. */
  let dobra = false;
  let velocidadeDobra = 0;

  let largura = 0;
  let altura = 0;
  let pontos = [];
  const mouse = { x: -9999, y: -9999 };

  function criarPontos() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    largura = window.innerWidth;
    altura = window.innerHeight;
    canvas.width = largura * dpr;
    canvas.height = altura * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const quantidade = Math.round(Math.min(90, (largura * altura) / 16000));
    pontos = Array.from({ length: quantidade }, () => ({
      x: Math.random() * largura,
      y: Math.random() * altura,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      r: 0.8 + Math.random() * 1.6
    }));
  }

  function desenhar() {
    ctx.clearRect(0, 0, largura, altura);

    /* compara distâncias ao quadrado: a raiz só é calculada para os pares que se ligam */
    ctx.lineWidth = 1;
    for (let i = 0; i < pontos.length; i++) {
      const a = pontos[i];
      ctx.strokeStyle = COR_LINHA;
      for (let j = i + 1; j < pontos.length; j++) {
        const b = pontos[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < DISTANCIA2) {
          ctx.globalAlpha = (1 - Math.sqrt(d2) / DISTANCIA) * 0.35;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
      /* perto do cursor, o ponto acende e se liga a ele */
      const mx = a.x - mouse.x;
      const my = a.y - mouse.y;
      const dm2 = mx * mx + my * my;
      if (dm2 < DISTANCIA_MOUSE2) {
        ctx.globalAlpha = (1 - Math.sqrt(dm2) / DISTANCIA_MOUSE) * 0.5;
        ctx.strokeStyle = COR_PONTO;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(mouse.x, mouse.y);
        ctx.stroke();
      }
    }

    /* todos os pontos num único desenho */
    ctx.fillStyle = COR_PONTO;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    for (const p of pontos) {
      ctx.moveTo(p.x + p.r, p.y);
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function mover() {
    for (const p of pontos) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < -10) p.x = largura + 10;
      if (p.x > largura + 10) p.x = -10;
      if (p.y < -10) p.y = altura + 10;
      if (p.y > altura + 10) p.y = -10;
    }
  }

  function desenharDobra() {
    const cx = largura / 2;
    const cy = altura / 2;
    /* acelera aos poucos (transição de 2,2 s, sem tranco) */
    velocidadeDobra = Math.min(velocidadeDobra * 1.045 + 0.25, 42);

    /* rastro: apaga só um pouco do quadro anterior (rastros longos e macios) */
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = "#050812";
    ctx.fillRect(0, 0, largura, altura);

    ctx.lineCap = "round";
    for (const p of pontos) {
      const dx = p.x - cx;
      const dy = p.y - cy;
      const dist = Math.hypot(dx, dy) || 1;
      const passo = velocidadeDobra * (0.3 + dist / Math.max(largura, altura));
      const nx = p.x + (dx / dist) * passo;
      const ny = p.y + (dy / dist) * passo;

      ctx.globalAlpha = Math.min(1, 0.3 + dist / 500);
      ctx.strokeStyle = p.r > 1.6 ? "#FFFFFF" : COR_PONTO;
      ctx.lineWidth = p.r * 1.3;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(nx, ny);
      ctx.stroke();

      p.x = nx;
      p.y = ny;
      /* saiu da tela: renasce perto do centro */
      if (nx < -20 || nx > largura + 20 || ny < -20 || ny > altura + 20) {
        const ang = Math.random() * Math.PI * 2;
        const raio = 10 + Math.random() * 120;
        p.x = cx + Math.cos(ang) * raio;
        p.y = cy + Math.sin(ang) * raio;
      }
    }
    ctx.globalAlpha = 1;
  }

  function quadro() {
    lerCores();
    if (dobra) {
      desenharDobra();
    } else {
      mover();
      desenhar();
    }
    requestAnimationFrame(quadro);
  }

  /* Usado pelo login na transição de portal. */
  window.FundoRede = {
    dobraEspacial() {
      if (reduzirMovimento || dobra) return;
      dobra = true;
      velocidadeDobra = 0;
      /* mais pontos, para a dobra ficar cheia */
      const extra = Math.round(pontos.length * 1.5);
      for (let i = 0; i < extra; i++) {
        const ang = Math.random() * Math.PI * 2;
        const raio = Math.random() * Math.max(largura, altura) * 0.5;
        pontos.push({
          x: largura / 2 + Math.cos(ang) * raio,
          y: altura / 2 + Math.sin(ang) * raio,
          vx: 0, vy: 0,
          r: 0.8 + Math.random() * 1.6
        });
      }
    }
  };

  criarPontos();
  /* No celular, a barra de endereço some/aparece ao rolar e dispara "resize" só na altura.
     Nesse caso basta ajustar o canvas: recriar os pontos faria a rede "pular". */
  window.addEventListener("resize", () => {
    if (window.innerWidth === largura && Math.abs(window.innerHeight - altura) < 160) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      altura = window.innerHeight;
      canvas.height = altura * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    } else {
      criarPontos();
    }
    if (reduzirMovimento) desenhar();
  });

  if (reduzirMovimento) {
    lerCores();
    desenhar();
    return;
  }

  window.addEventListener("pointermove", (ev) => {
    mouse.x = ev.clientX;
    mouse.y = ev.clientY;
  }, { passive: true });
  document.addEventListener("mouseleave", () => { mouse.x = -9999; mouse.y = -9999; });

  requestAnimationFrame(quadro);
})();
