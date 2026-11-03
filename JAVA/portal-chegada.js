/* NEXUS — chegada pelo portal
   Quando a página é aberta pelo login (transição de portal), continua o clarão
   e o dissolve, revelando a página. Inclua no <head> das páginas de destino. */
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
  const duracao = reduzirMovimento ? 200 : 900;

  const clarao = document.createElement("div");
  clarao.setAttribute("aria-hidden", "true");
  clarao.style.cssText = [
    "position:fixed", "inset:0", "z-index:2147483647", "pointer-events:none",
    "background:radial-gradient(circle, #FFFFFF 0%, #B8FBFF 35%, #00E5FF 75%, #062A3A 100%)",
    `transition:opacity ${duracao}ms ease-out, transform ${duracao}ms ease-out`,
    "opacity:1"
  ].join(";");

  /* o <body> ainda não existe enquanto o <head> carrega: entra no <html> */
  document.documentElement.appendChild(clarao);

  window.addEventListener("DOMContentLoaded", () => {
    requestAnimationFrame(() => {
      clarao.style.opacity = "0";
      clarao.style.transform = "scale(1.15)";
      window.setTimeout(() => clarao.remove(), duracao + 50);
    });
  });
})();
