/* NEXUS — chegada pelo portal
   Quando a página é aberta pelo login (transição de portal), continua a névoa
   clara que cobriu a tela e a dissolve aos poucos: primeiro a névoa fica
   transparente e o desfoque da página vai sumindo, como se a nova realidade
   entrasse em foco. Inclua no <head> das páginas de destino. */
(() => {
  "use strict";

  let veioDoPortal = false;
  try {
    veioDoPortal = sessionStorage.getItem("nexus-portal") === "1";
    sessionStorage.removeItem("nexus-portal");
  } catch (erro) {
    return;
  }
  if (!veioDoPortal) return;

  const reduzirMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const duracao = reduzirMovimento ? 200 : 1300;

  /* mesma névoa do fim do portal no login (login.css, .portal-nevoa) */
  const nevoa = document.createElement("div");
  nevoa.setAttribute("aria-hidden", "true");
  nevoa.style.cssText = [
    "position:fixed", "inset:0", "z-index:2147483647", "pointer-events:none",
    "background:radial-gradient(ellipse at center, #F2FEFF 0%, #C9F7FF 30%, #7FDDF0 62%, #2F7FA6 100%)",
    "opacity:1"
  ].join(";");

  /* camada que desfoca a página por trás e vai entrando em foco */
  const foco = document.createElement("div");
  foco.setAttribute("aria-hidden", "true");
  foco.style.cssText = [
    "position:fixed", "inset:0", "z-index:2147483646", "pointer-events:none",
    "backdrop-filter:blur(14px)", "-webkit-backdrop-filter:blur(14px)"
  ].join(";");

  /* o <body> ainda não existe enquanto o <head> carrega: entra no <html> */
  document.documentElement.appendChild(foco);
  document.documentElement.appendChild(nevoa);

  /* começa no próximo quadro; se o navegador atrasar os quadros (aba em segundo
     plano), começa assim mesmo depois de 120 ms, para a névoa nunca ficar presa */
  let comecou = false;
  const quandoPronto = (revelar) => {
    const umaVez = () => { if (!comecou) { comecou = true; revelar(); } };
    requestAnimationFrame(umaVez);
    window.setTimeout(umaVez, 120);
  };

  window.addEventListener("DOMContentLoaded", () => {
    quandoPronto(() => {
      /* a névoa se desfaz rápido no começo e devagar no fim, como fumaça */
      nevoa.animate(
        [
          { opacity: 1, transform: "scale(1)" },
          { opacity: 0.35, transform: "scale(1.06)", offset: 0.45 },
          { opacity: 0, transform: "scale(1.15)" }
        ],
        { duration: duracao, easing: "cubic-bezier(0.3, 0, 0.4, 1)", fill: "forwards" }
      );
      foco.animate(
        [
          { backdropFilter: "blur(14px)", webkitBackdropFilter: "blur(14px)" },
          { backdropFilter: "blur(0px)", webkitBackdropFilter: "blur(0px)" }
        ],
        { duration: duracao * 1.15, easing: "ease-out", fill: "forwards" }
      );
      window.setTimeout(() => { nevoa.remove(); foco.remove(); }, duracao * 1.15 + 80);
    });
  });
})();
