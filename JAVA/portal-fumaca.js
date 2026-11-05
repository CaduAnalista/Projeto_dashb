/* NEXUS — fumaça da transição de portal (login aceito)
   Uma nebulosa de fumaça ciano, azul e violeta nasce no centro, gira devagar
   e se espalha até tomar a tela; no fim, uma névoa clara cobre tudo e a página
   de destino abre (lá o portal-chegada.js dissolve a mesma névoa).
   Desenhada num <canvas> em meia resolução: a fumaça é desfocada de propósito,
   então isso não muda o visual e deixa o celular leve.
   Uso: PortalFumaca.iniciar(elementoDoPortal, duracaoEmMs). */
(() => {
  "use strict";

  /* Cores da fumaça: primária, secundária, acento e um branco azulado */
  const CORES = ["#00E5FF", "#3D7BFF", "#8F6BFF", "#BFF7FF"];

  /* "Baforada" pronta: um círculo de gradiente suave, desenhado uma vez por cor */
  function criarBaforada(cor) {
    const tamanho = 128;
    const tela = document.createElement("canvas");
    tela.width = tela.height = tamanho;
    const c = tela.getContext("2d");
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, cor);
    g.addColorStop(0.35, cor + "99");
    g.addColorStop(0.7, cor + "26");
    g.addColorStop(1, cor + "00");
    c.fillStyle = g;
    c.fillRect(0, 0, tamanho, tamanho);
    return tela;
  }

  /* suavização: começa e termina devagar */
  const suave = (x) => x * x * (3 - 2 * x);

  function iniciar(portal, duracao) {
    const tela = document.createElement("canvas");
    tela.className = "portal-fumaca";
    portal.prepend(tela);
    const ctx = tela.getContext("2d");

    const ESCALA = 0.5;
    let largura = 0;
    let altura = 0;
    function medir() {
      largura = Math.ceil(window.innerWidth * ESCALA);
      altura = Math.ceil(window.innerHeight * ESCALA);
      tela.width = largura;
      tela.height = altura;
    }
    medir();
    window.addEventListener("resize", medir);

    const baforadas = CORES.map(criarBaforada);
    const raioTela = Math.hypot(largura, altura) / 2;
    const particulas = [];

    function nova(progresso) {
      /* no começo nascem coladas ao centro; depois, um pouco mais longe */
      const ang = Math.random() * Math.PI * 2;
      /* cor: mais azul e violeta, pouco branco (para não estourar em luz) */
      const sorteio = Math.random();
      const cor = sorteio < 0.35 ? 0 : sorteio < 0.65 ? 1 : sorteio < 0.94 ? 2 : 3;
      return {
        ang,
        raio: raioTela * (0.03 + Math.random() * (0.05 + progresso * 0.35)),
        giro: (0.5 + Math.random() * 0.6) * (Math.random() < 0.85 ? 1 : -1),
        saida: raioTela * (0.25 + Math.random() * 0.3),
        tamanho: raioTela * (0.22 + Math.random() * 0.22),
        cresce: raioTela * (0.3 + Math.random() * 0.3),
        vida: 0,
        duracaoVida: 1.0 + Math.random() * 0.8,
        cor,
        forca: 0.06 + Math.random() * 0.07
      };
    }

    const inicio = performance.now();
    let anterior = inicio;
    let ativo = true;

    function quadro(agora) {
      if (!ativo) return;
      const dt = Math.min(0.05, (agora - anterior) / 1000);
      anterior = agora;
      const p = Math.min(1, (agora - inicio) / duracao);

      /* quantas baforadas nascem: aumenta até a metade e depois se mantém */
      const nascer = Math.round(1 + 3 * suave(Math.min(1, p * 2)));
      for (let i = 0; i < nascer && particulas.length < 180; i++) particulas.push(nova(p));

      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, largura, altura);

      /* brilho do núcleo, crescendo junto */
      const cx = largura / 2;
      const cy = altura / 2;
      const nucleo = raioTela * (0.15 + 0.9 * suave(p));
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, nucleo);
      g.addColorStop(0, `rgba(230, 253, 255, ${0.3 * suave(Math.min(1, p * 1.6))})`);
      g.addColorStop(0.5, `rgba(0, 229, 255, ${0.1 * suave(Math.min(1, p * 1.6))})`);
      g.addColorStop(1, "rgba(0, 229, 255, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, largura, altura);

      /* as baforadas somam luz entre si, como fumaça iluminada */
      ctx.globalCompositeOperation = "lighter";
      for (let i = particulas.length - 1; i >= 0; i--) {
        const f = particulas[i];
        f.vida += dt;
        const t = f.vida / f.duracaoVida;
        if (t >= 1) { particulas.splice(i, 1); continue; }

        /* espiral: gira e se afasta, cada vez mais rápido com o avanço do portal */
        f.ang += f.giro * dt * (1 + p);
        f.raio += f.saida * dt * (0.6 + 2.2 * p);
        const x = cx + Math.cos(f.ang) * f.raio;
        const y = cy + Math.sin(f.ang) * f.raio * 0.82;
        const tam = f.tamanho + f.cresce * t;

        /* entra e sai devagar; esticada na direção do giro, vira um fio de fumaça */
        ctx.globalAlpha = f.forca * Math.sin(Math.PI * t);
        ctx.setTransform(1, 0, 0, 1, x, y);
        ctx.rotate(f.ang + Math.PI / 2);
        ctx.scale(1.9, 0.6);
        ctx.drawImage(baforadas[f.cor], -tam / 2, -tam / 2, tam, tam);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
      ctx.globalAlpha = 1;

      requestAnimationFrame(quadro);
    }
    requestAnimationFrame(quadro);

    /* se a transição for desfeita (voltar pelo histórico), para de desenhar */
    return function parar() {
      ativo = false;
      window.removeEventListener("resize", medir);
    };
  }

  window.PortalFumaca = { iniciar };
})();
