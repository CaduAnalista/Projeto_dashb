/* OPTMUS — Login e roteamento inicial
   Protótipo local: a lista abaixo é apenas uma validação no navegador.
   Para uso real, a autenticação precisa ser validada no servidor. */
(() => {
  "use strict";

  const form = document.getElementById("loginForm");
  const nome = document.getElementById("nome");
  const dashboard = document.getElementById("dashboard");
  const email = document.getElementById("email");
  const feedback = document.getElementById("formFeedback");
  const frame = document.getElementById("loginFrame");
  const mascot = document.getElementById("mascotStage");
  const mascotImage = document.getElementById("optmusHead");
  const greeting = document.getElementById("mascotGreeting");
  const button = document.getElementById("submitButton");

  const PAGINAS_POR_DASHBOARD = {
    "Inteligência de Rede": "./inteligencia.html",
    "Captação/Cadastro": "./cad-cap.html"
  };

  // Mantenha aqui os usuários autorizados já cadastrados.
  // O primeiro registro é o usuário de protótipo anteriormente definido.
  const USUARIOS_AUTORIZADOS = [
    {
      nome: "Carlos",
      email: "carlos.porto@assefaz.org.br",
      dashboards: ["Inteligência de Rede"]
    }
  ];

  const normalizar = (valor) => String(valor || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  function mostrarMensagem(texto, tipo = "error") {
    feedback.textContent = texto;
    feedback.classList.toggle("success", tipo === "success");
  }

  function reagirErro(texto) {
    mostrarMensagem(texto);
    greeting.lastElementChild.textContent = "Ops! Confira seus dados.";
    frame.classList.remove("is-error");
    mascot.classList.remove("is-error");
    void frame.offsetWidth;
    frame.classList.add("is-error");
    mascot.classList.add("is-error");
    window.setTimeout(() => {
      frame.classList.remove("is-error");
      mascot.classList.remove("is-error");
    }, 600);
  }

  // Somente a cabeça acompanha o cursor; o corpo permanece imóvel.
  const movimentoPermitido = window.matchMedia("(pointer:fine)").matches;
  if (movimentoPermitido) {
    const limitar = (valor, minimo, maximo) => Math.max(minimo, Math.min(maximo, valor));

    document.addEventListener("pointermove", (event) => {
      const rect = mascot.getBoundingClientRect();
      const x = limitar((event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2), -1, 1);
      const y = limitar((event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2), -1, 1);

      const rotateY = x * 7;
      const rotateX = -y * 4;
      const moveX = x * 4;
      const moveY = y * 2;

      mascotImage.style.transform =
        `translate3d(${moveX}px, ${moveY}px, 0) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    }, { passive: true });

    document.addEventListener("pointerleave", () => {
      mascotImage.style.transform = "translate3d(0,0,0) rotateX(0deg) rotateY(0deg)";
    });
  }

  // Reações leves ao foco dos campos.
  nome.addEventListener("focus", () => greeting.lastElementChild.textContent = "Olá! Como posso te chamar?");
  dashboard.addEventListener("focus", () => greeting.lastElementChild.textContent = "Vou abrir o painel certo para você.");
  email.addEventListener("focus", () => greeting.lastElementChild.textContent = "Só falta confirmar seu e-mail.");

  form.addEventListener("input", () => {
    feedback.textContent = "";
    feedback.classList.remove("success");
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const nomeInformado = nome.value.trim();
    const emailInformado = normalizar(email.value);
    const dashboardInformado = dashboard.value;

    if (!nomeInformado || !dashboardInformado || !emailInformado) {
      reagirErro("Preencha nome, dashboard e e-mail para continuar.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInformado)) {
      reagirErro("Informe um endereço de e-mail válido.");
      email.focus();
      return;
    }

    const usuario = USUARIOS_AUTORIZADOS.find((item) =>
      normalizar(item.nome) === normalizar(nomeInformado) &&
      normalizar(item.email) === emailInformado &&
      item.dashboards.includes(dashboardInformado)
    );

    if (!usuario) {
      reagirErro("Acesso não autorizado. Confira seus dados ou solicite seu cadastro.");
      return;
    }

    const destino = PAGINAS_POR_DASHBOARD[dashboardInformado];
    if (!destino) {
      reagirErro("O dashboard selecionado ainda não está configurado.");
      return;
    }

    mostrarMensagem("Acesso autorizado. Preparando seu ambiente...", "success");
    greeting.lastElementChild.textContent = "Tudo certo! Vamos começar.";
    mascot.classList.add("is-success");
    button.disabled = true;
    button.querySelector("span").textContent = "Acessando...";
    frame.classList.add("is-leaving");

    window.setTimeout(() => {
      window.location.href = destino;
    }, 650);
  });
})();
