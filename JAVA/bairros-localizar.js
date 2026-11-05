/* NEXUS — localizar bairros (Saúde e Social)
   Acha a posição de um bairro do Rio de Janeiro ou de Niterói na tabela local
   BAIRROS_RJ (bairros-rj.js), sem acessar a internet. A planilha costuma trazer
   o mesmo bairro escrito de vários jeitos ("VL ISABEL", "JD BOTANICO",
   "FRG JACAREPAGUA", "COPACBANA", "RECREIO DOS BANDEIRA"); aqui essas variações
   são levadas ao nome oficial, nesta ordem:
     1. correções fixas (CORRECOES, abaixo);
     2. abreviações trocadas pela palavra inteira (ABREVIACOES);
     3. o nome inteiro, ou só a parte antes de " - ", "/", "," ou "(";
     4. nome cortado no fim (começo de um único nome oficial);
     5. erro de digitação pequeno (1 ou 2 letras de diferença, sem empate).
   Se nada servir, devolve null: o bairro fica só na lista, "sem localização".
   Uso: LocalizarBairro.posicao("RIO DE JANEIRO", "VL ISABEL") → [lat, lng] ou null. */
(() => {
  "use strict";

  const norm = (v) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toUpperCase().replace(/\s+/g, " ");
  /* só letras e números: "PONTA D'AREIA", "PONTA D AREIA" e "PONTA DAREIA" ficam iguais */
  const compacto = (v) => norm(v).replace(/[^A-Z0-9]/g, "");

  /* Bairros que existem hoje mas ainda não estão na malha do IBGE de 2022.
     Ponto aproximado, marcado à mão. */
  const EXTRAS = {
    "RIO DE JANEIRO": {
      "BARRA OLIMPICA": [-22.9766, -43.3953] /* criado em 2017; ponto no Parque Olímpico */
    },
    NITEROI: {}
  };

  /* Abreviações comuns na planilha (palavra inteira) */
  const ABREVIACOES = {
    VL: "VILA", JD: "JARDIM", JDM: "JARDIM", STA: "SANTA", STO: "SANTO", S: "SAO",
    PC: "PRACA", PCA: "PRACA", PRQ: "PARQUE", PQ: "PARQUE", MAL: "MARECHAL",
    FRG: "FREGUESIA", CPO: "CAMPO", RCR: "RECREIO", VIG: "VIGARIO", PNT: "PONTA",
    ENG: "ENGENHO"
  };

  /* Correções fixas: escrita da planilha (já sem acento) → nome oficial.
     Use para apelidos e casos ambíguos que as regras automáticas não resolvem. */
  const CORRECOES = {
    "RIO DE JANEIRO": {
      "RECREIO": "RECREIO DOS BANDEIRANTES",
      "QUINTINO": "QUINTINO BOCAIUVA",
      "LINS": "LINS DE VASCONCELOS",
      "COELHO": "COELHO NETO",
      "FREGUESIA JACAREPAGUA": "FREGUESIA (JACAREPAGUA)",
      "FREGUESIA JACAREPAG": "FREGUESIA (JACAREPAGUA)",
      "FREGUESIA ILHA DO GOVERNADOR": "FREGUESIA (ILHA DO GOVERNADOR)",
      "FREGUESIA ILHA DO G": "FREGUESIA (ILHA DO GOVERNADOR)"
    },
    NITEROI: {
      "CENTRO NITEROI": "CENTRO"
    }
  };

  /* Monta, por cidade, o índice "compacto → [nome oficial, posição]" */
  const indices = {};
  function indice(cidade) {
    if (indices[cidade]) return indices[cidade];
    const tabela = Object.assign({}, (window.BAIRROS_RJ || {})[cidade] || {}, EXTRAS[cidade] || {});
    const mapa = new Map();
    for (const [nome, pos] of Object.entries(tabela)) mapa.set(compacto(nome), { nome, pos });
    return (indices[cidade] = mapa);
  }

  function expandir(texto) {
    return norm(texto).split(" ").map((p) => ABREVIACOES[p] || p).join(" ");
  }

  /* distância de edição (quantas letras trocar, tirar ou pôr) */
  function distancia(a, b, limite) {
    if (Math.abs(a.length - b.length) > limite) return limite + 1;
    let anterior = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const atual = [i];
      let menor = i;
      for (let j = 1; j <= b.length; j++) {
        atual[j] = Math.min(anterior[j] + 1, atual[j - 1] + 1, anterior[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (atual[j] < menor) menor = atual[j];
      }
      if (menor > limite) return limite + 1;
      anterior = atual;
    }
    return anterior[b.length];
  }

  const cache = new Map();

  /* Devolve { nome, pos } do bairro oficial, ou null. */
  function achar(cidade, bairro) {
    cidade = norm(cidade);
    const chave = cidade + "|" + norm(bairro);
    if (cache.has(chave)) return cache.get(chave);
    const resultado = procurar(cidade, bairro);
    cache.set(chave, resultado);
    return resultado;
  }

  function procurar(cidade, bairro) {
    const mapa = indice(cidade);
    if (!mapa.size) return null;
    /* tira restos de acentuação quebrada (ex.: "HUMAITAI��") */
    const limpo = norm(bairro).replace(/[^A-Z0-9 ()\-\/,']/g, "").trim();
    if (!limpo) return null;

    /* 1. correções fixas (procuradas sem parênteses e sem traços) */
    const correcoes = CORRECOES[cidade] || {};
    const semSinais = expandir(limpo.replace(/[()\-\/,]/g, " "));
    if (correcoes[semSinais]) return mapa.get(compacto(correcoes[semSinais])) || null;

    /* 2 e 3. nome inteiro e só a parte principal (antes de " - ", "/", "," ou "(") */
    const tentativas = [expandir(limpo)];
    const principal = limpo.split(/\s+-\s+|\/|,|\(/)[0].trim();
    if (principal && principal !== limpo) tentativas.push(expandir(principal));
    /* nomes com a região no fim, sem separador ("MONERO ILHA DO GOVERNADOR") */
    tentativas.push(expandir(limpo.replace(/\s+(ILHA DO GOVERNADOR|ILHA DO GOV|JACAREPAGUA|NITEROI)$/, "")));
    for (const t of tentativas) {
      const achado = mapa.get(compacto(t));
      if (achado) return achado;
      if (correcoes[t]) return mapa.get(compacto(correcoes[t])) || null;
    }

    const alvo = compacto(tentativas[0]);

    /* 4. nome cortado no fim: começo de um único nome oficial */
    if (alvo.length >= 8) {
      const comeco = [...mapa.keys()].filter((k) => k.startsWith(alvo));
      if (comeco.length === 1) return mapa.get(comeco[0]);
    }

    /* 5. erro de digitação pequeno, sem empate */
    /* (8 letras ou mais aceitam 2 trocas: "BOTOFAGO" → BOTAFOGO) */
    const limite = alvo.length >= 8 ? 2 : alvo.length >= 6 ? 1 : 0;
    if (!limite) return null;
    let melhor = null;
    let empate = false;
    for (const k of mapa.keys()) {
      const d = distancia(alvo, k, limite);
      if (d > limite) continue;
      if (!melhor || d < melhor.d) { melhor = { k, d }; empate = false; }
      else if (d === melhor.d) empate = true;
    }
    return melhor && !empate ? mapa.get(melhor.k) : null;
  }

  window.LocalizarBairro = {
    /* [lat, lng] ou null */
    posicao(cidade, bairro) {
      const r = achar(cidade, bairro);
      return r ? r.pos : null;
    },
    /* nome oficial ou null (usado para juntar as variações na lista) */
    nomeOficial(cidade, bairro) {
      const r = achar(cidade, bairro);
      return r ? r.nome : null;
    }
  };
})();
