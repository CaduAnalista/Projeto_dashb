/* NEXUS — Login e roteamento inicial
   Protótipo local: a lista abaixo é apenas uma validação no navegador.
   Para uso real, a autenticação precisa ser validada no servidor. */
(() => {
  "use strict";

  const form = document.getElementById("formLogin");
  const nome = document.getElementById("nome");
  const painel = document.getElementById("painel");
  const email = document.getElementById("email");
  const aviso = document.getElementById("aviso");
  const cartao = document.getElementById("painelLogin");
  const balao = document.getElementById("balao");
  const balaoTexto = document.getElementById("balaoTexto");
  const botao = document.getElementById("botaoEntrar");
  const botaoDemo = document.getElementById("botaoDemo");
  const palco = document.getElementById("nexusPalco");

  /* Se o nexus.js não carregar, a página continua funcionando sem o personagem. */
  const nexus = window.Nexus || { expressao() {}, reagir() {}, olharPara() {} };
  const reduzirMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const PAGINAS_POR_PAINEL = {
    "Inteligência de Rede": "./inteligencia.html",
    "Relacionamento": "./cad-cap.html",
    "Saúde e Social": "./saude-social.html",
  };

  // Mantenha aqui os usuários autorizados.
  // O usuário de demonstração serve para quem visita o portfólio.
  const USUARIOS_AUTORIZADOS = [
    {
      nome: "Visitante",
      email: "visitante@nexus.dev",
      paineis: "Saúde e Social"
    }
  ];

  const normalizar = (valor) => String(valor || "")
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

  const primeiroNome = (valor) => {
    const p = valor.trim().split(/\s+/)[0] || "";
    return p.charAt(0).toUpperCase() + p.slice(1);
  };

  /* Balão de fala com efeito de digitação. */
  let digitacao = null;
  function falar(texto) {
    clearInterval(digitacao);
    if (reduzirMovimento) {
      balaoTexto.textContent = texto;
      return;
    }
    let i = 0;
    balaoTexto.textContent = "";
    balao.classList.add("digitando");
    digitacao = setInterval(() => {
      i += 1;
      balaoTexto.textContent = texto.slice(0, i);
      if (i >= texto.length) {
        clearInterval(digitacao);
        balao.classList.remove("digitando");
      }
    }, 24);
  }

  function mostrarAviso(texto, tipo = "erro") {
    aviso.textContent = texto;
    aviso.classList.toggle("sucesso", tipo === "sucesso");
  }

  function reagirErro(texto, fala = "Hmm... algo não bateu. Confira seus dados.") {
    mostrarAviso(texto);
    falar(fala);
    nexus.reagir("erro", 2400);
    cartao.classList.remove("tremer");
    void cartao.offsetWidth;
    cartao.classList.add("tremer");
  }

  /* Login recusado: a tela inteira (NEXUS e fundo) fica vermelha por 2 s e volta ao normal. */
  const raiz = document.documentElement;
  let fimAlerta = null;
  function modoAlerta() {
    raiz.classList.add("alerta");
    clearTimeout(fimAlerta);
    fimAlerta = setTimeout(() => raiz.classList.remove("alerta"), 2000);
  }

  /* Login aceito: "mudança de realidade" (~2,8 s). A cena se desfaz em desfoque,
     uma nebulosa de fumaça nasce no centro e toma a tela, o fundo entra em dobra
     espacial e, coberta por uma névoa clara, a página de destino abre. */
  const DURACAO_PORTAL = 2800;
  let pararFumaca = null;

  function abrirPortal(destino) {
    const portal = document.createElement("div");
    portal.className = "portal" + (reduzirMovimento ? " simples" : "");
    portal.setAttribute("aria-hidden", "true");
    portal.innerHTML = '<div class="portal-nevoa"></div>';
    document.body.appendChild(portal);
    document.body.classList.add("portal-ativo");
    if (window.PortalFumaca && !reduzirMovimento) pararFumaca = window.PortalFumaca.iniciar(portal, DURACAO_PORTAL);
    if (window.FundoRede) window.FundoRede.dobraEspacial();
    /* um erro no som nunca pode impedir a entrada */
    try {
      if (window.SomPortal && !reduzirMovimento) window.SomPortal.tocar();
    } catch (erro) {
      console.warn("Som do portal indisponível:", erro);
    }

    /* a página de destino continua a névoa e a dissolve */
    try { sessionStorage.setItem("nexus-portal", "1"); } catch (erro) { /* sem armazenamento: só não há chegada animada */ }

    window.setTimeout(() => { window.location.href = destino; }, reduzirMovimento ? 300 : DURACAO_PORTAL);
  }

  /* Reações aos campos: o NEXUS olha para o campo e comenta. */
  const FALAS = {
    nome: "Olá! Como posso te chamar?",
    painel: "Qual painel vamos abrir hoje?",
    email: "Agora, seu e-mail de acesso."
  };

  [nome, painel, email].forEach((campo) => {
    campo.addEventListener("focus", () => {
      nexus.olharPara(campo);
      nexus.expressao("curioso");
      falar(FALAS[campo.id]);
    });
    campo.addEventListener("input", () => nexus.olharPara(campo));
    campo.addEventListener("blur", () => nexus.olharPara(null));
  });

  nome.addEventListener("change", () => {
    if (nome.value.trim()) {
      nexus.reagir("feliz", 1600);
      falar(`Prazer, ${primeiroNome(nome.value)}!`);
    }
  });

  painel.addEventListener("change", () => {
    falar(`${painel.value}? Ótima escolha.`);
  });

  form.addEventListener("input", () => {
    aviso.textContent = "";
    aviso.classList.remove("sucesso");
  });

  /* Clicar no personagem */
  palco.addEventListener("click", () => {
    nexus.reagir("feliz", 1400);
    falar("Ei! Estou pronto para analisar seus dados.");
  });

  /* Preenche o acesso de demonstração (para quem visita o portfólio). */
  botaoDemo.addEventListener("click", () => {
    const demo = USUARIOS_AUTORIZADOS[0];
    nome.value = demo.nome;
    email.value = demo.email;
    if (!painel.value) painel.value = demo.paineis[0];
    aviso.textContent = "";
    nexus.reagir("feliz", 1600);
    falar("Acesso de demonstração pronto. É só entrar!");
    botao.focus();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const nomeInformado = nome.value.trim();
    const emailInformado = normalizar(email.value);
    const painelInformado = painel.value;

    if (!nomeInformado || !painelInformado || !emailInformado) {
      reagirErro("Preencha nome, painel e e-mail para continuar.", "Faltou alguma coisa ali.");
      (!nomeInformado ? nome : !painelInformado ? painel : email).focus();
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInformado)) {
      reagirErro("Informe um endereço de e-mail válido.", "Esse e-mail parece incompleto.");
      email.focus();
      return;
    }

    const usuario = USUARIOS_AUTORIZADOS.find((item) =>
      normalizar(item.nome) === normalizar(nomeInformado) &&
      normalizar(item.email) === emailInformado &&
      item.paineis.includes(painelInformado)
    );

    const destino = PAGINAS_POR_PAINEL[painelInformado];

    if (!usuario || !destino) {
      modoAlerta();
      if (!usuario) {
        reagirErro("Acesso não autorizado. Confira seus dados ou solicite seu cadastro.",
          "Acesso negado! Não encontrei você na lista.");
      } else {
        reagirErro("O painel selecionado ainda não está configurado.", "Esse painel ainda está em construção.");
      }
      return;
    }

    /* o áudio precisa ser liberado aqui, ainda dentro do clique/Enter do usuário */
    if (window.SomPortal && !reduzirMovimento) window.SomPortal.preparar();

    botao.disabled = true;
    botao.querySelector("span").textContent = "Acessando...";
    mostrarAviso("Acesso autorizado. Abrindo o portal...", "sucesso");
    nexus.olharPara(null);
    nexus.expressao("pronto");
    falar(`Tudo certo, ${primeiroNome(nomeInformado)}! Segure firme...`);

    window.setTimeout(() => abrirPortal(destino), reduzirMovimento ? 0 : 450);
  });

  /* Ao voltar com o botão "voltar" do navegador, a página pode vir da memória
     ainda com o portal aberto: desfaz a transição. */
  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    if (pararFumaca) { pararFumaca(); pararFumaca = null; }
    document.querySelectorAll(".portal").forEach((p) => p.remove());
    document.body.classList.remove("portal-ativo");
    botao.disabled = false;
    botao.querySelector("span").textContent = "Entrar";
    aviso.textContent = "";
    nexus.expressao("curioso");
  });

  /* Primeira fala ao abrir a página */
  window.setTimeout(() => falar("Olá! Eu sou o NEXUS. Vamos analisar alguns dados?"), 500);
})();
