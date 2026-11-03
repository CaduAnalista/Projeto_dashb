
/* =====================================================
   ANALISTA — CAPTAÇÃO E CADASTRO
   Leitura do Excel, filtros e indicadores
===================================================== */

const arquivoExcel = document.getElementById("arquivoExcel");

let baseOriginal = [];
let baseFiltrada = [];
let colunasExcel = [];
let mapeamento = {};

/* =====================================================
   FUNÇÕES AUXILIARES
===================================================== */

function normalizar(valor) {
    return String(valor ?? "")
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\s+/g, " ");
}

function texto(valor) {
    if (valor === null || valor === undefined) return "";
    return String(valor).trim();
}

function ehSim(valor) {
    return ["sim", "s", "yes", "true", "1", "interessado",
        "interessada", "aceitou", "aceita"].includes(normalizar(valor));
}

function ehNao(valor) {
    return ["nao", "n", "no", "false", "0", "nao possui",
        "nao tem", "sem plano"].includes(normalizar(valor));
}

function encontrarColuna(possiveisNomes) {
    const colunasNormalizadas = colunasExcel.map(coluna => ({
        original: coluna,
        normalizada: normalizar(coluna)
    }));

    // Primeiro, tenta encontrar um nome exato.
    for (const nome of possiveisNomes) {
        const procurado = normalizar(nome);
        const encontrado = colunasNormalizadas.find(
            coluna => coluna.normalizada === procurado
        );

        if (encontrado) return encontrado.original;
    }

    // Depois, tenta encontrar um nome que contenha o termo.
    for (const nome of possiveisNomes) {
        const procurado = normalizar(nome);

        const encontrado = colunasNormalizadas.find(
            coluna => coluna.normalizada.includes(procurado)
        );

        if (encontrado) return encontrado.original;
    }

    return null;
}

function valorDaLinha(linha, campo) {
    const coluna = mapeamento[campo];
    return coluna ? linha[coluna] : "";
}

function contar(lista) {
    return lista.length;
}

function atualizarNumero(id, valor) {
    const elemento = document.getElementById(id);
    if (elemento) {
        elemento.textContent = Number(valor || 0).toLocaleString("pt-BR");
    }
}

function atualizarStatus(mensagem) {
    const elemento = document.getElementById("statusDados");
    if (elemento) elemento.textContent = mensagem;
}

/* =====================================================
   IDENTIFICAÇÃO DAS COLUNAS DO EXCEL
===================================================== */

function identificarColunas() {
    mapeamento = {
        orgao: encontrarColuna([
            "Órgão", "Nome do órgão", "Órgão de origem",
            "Empresa", "Instituição"
        ]),

        colaborador: encontrarColuna([
            "Colaborador", "Responsável", "Captador",
            "Nome do colaborador", "Responsável pela captação"
        ]),

        plano: encontrarColuna([
            "Possui plano", "Possui o plano",
            "Já possui o plano", "Tem plano",
            "Possui plano de saúde"
        ]),

        contato: encontrarColuna([
            "Contato", "Etapa do contato", "Número do contato",
            "Tentativa de contato", "Quantidade de contatos",
            "Contato realizado"
        ]),

        interesse: encontrarColuna([
            "Interessado", "Possui interesse", "Status do interesse",
            "Interesse", "Prospect interessado"
        ]),

        temperatura: encontrarColuna([
            "Temperatura", "Classificação", "Classificação do lead",
            "Perfil do prospect", "Lead quente/morno/frio"
        ]),

        adesao: encontrarColuna([
            "Aceitou preencher a adesão",
            "Aceitou adesão", "Preencher adesão",
            "Adesão", "Aceite da adesão",
            "Aceitou preencher"
        ])
    };
}

/* =====================================================
   CLASSIFICAÇÃO DOS INDICADORES
===================================================== */

function naoPossuiPlano(linha) {
    const valor = valorDaLinha(linha, "plano");

    if (ehNao(valor)) return true;
    if (normalizar(valor).includes("nao possui")) return true;

    return false;
}

function contatoCorresponde(linha, numero) {
    const valor = normalizar(valorDaLinha(linha, "contato"));

    if (!valor) return false;

    const alternativas = {
        1: [
            "1", "1o", "1 contato", "contato 1",
            "primeiro", "1a tentativa", "1a"
        ],
        2: [
            "2", "2o", "2 contato", "contato 2",
            "segundo", "2a tentativa", "2a"
        ],
        3: [
            "3", "3o", "3 contato", "contato 3",
            "terceiro", "3a tentativa", "3a"
        ]
    };

    return alternativas[numero].includes(valor);
}

function prospectInteressado(linha) {
    const valor = valorDaLinha(linha, "interesse");

    return ehSim(valor) ||
        ["interessado", "interessada", "interesse confirmado",
         "positivo"].includes(normalizar(valor));
}

function aceitouAdesao(linha) {
    const valor = valorDaLinha(linha, "adesao");
    const normalizado = normalizar(valor);

    return ehSim(valor) ||
        ["aceitou", "aceitou preencher", "sim, aceitou",
         "preenchimento aceito", "aceitou a adesao"].includes(normalizado);
}

function temperaturaDoProspect(linha) {
    const valor = normalizar(valorDaLinha(linha, "temperatura"));

    if (valor.includes("quente")) return "quente";
    if (valor.includes("morno")) return "morno";
    if (valor.includes("frio")) return "frio";

    return "";
}

/* =====================================================
   INDICADORES PRINCIPAIS
===================================================== */

function calcularIndicadores(dados) {
    atualizarNumero("totalLeads", contar(dados));

    atualizarNumero(
        "totalSemPlano",
        dados.filter(naoPossuiPlano).length
    );

    atualizarNumero(
        "totalContato1",
        dados.filter(linha => contatoCorresponde(linha, 1)).length
    );

    atualizarNumero(
        "totalContato2",
        dados.filter(linha => contatoCorresponde(linha, 2)).length
    );

    atualizarNumero(
        "totalContato3",
        dados.filter(linha => contatoCorresponde(linha, 3)).length
    );

    atualizarNumero(
        "totalInteressados",
        dados.filter(prospectInteressado).length
    );

    atualizarNumero(
        "totalAdesao",
        dados.filter(aceitouAdesao).length
    );

    atualizarNumero(
        "totalFrios",
        dados.filter(linha => temperaturaDoProspect(linha) === "frio").length
    );

    atualizarNumero(
        "totalMornos",
        dados.filter(linha => temperaturaDoProspect(linha) === "morno").length
    );

    atualizarNumero(
        "totalQuentes",
        dados.filter(linha => temperaturaDoProspect(linha) === "quente").length
    );
}

/* =====================================================
   FILTROS
===================================================== */

function preencherFiltro(id, campo, titulo) {
    const select = document.getElementById(id);
    if (!select) return;

    const valorAtual = select.value;
    const valores = [...new Set(
        baseOriginal
            .map(linha => texto(valorDaLinha(linha, campo)))
            .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, "pt-BR"));

    select.innerHTML = "";

    const opcaoTodos = document.createElement("option");
    opcaoTodos.value = "";
    opcaoTodos.textContent = titulo;
    select.appendChild(opcaoTodos);

    valores.forEach(valor => {
        const opcao = document.createElement("option");
        opcao.value = valor;
        opcao.textContent = valor;
        select.appendChild(opcao);
    });

    if (valores.includes(valorAtual)) {
        select.value = valorAtual;
    }
}

function aplicarFiltros() {
    const orgao = document.getElementById("filtroOrgao").value;
    const colaborador = document.getElementById("filtroColaborador").value;
    const plano = document.getElementById("filtroPlano").value;

    baseFiltrada = baseOriginal.filter(linha => {
        const correspondeOrgao =
            !orgao || texto(valorDaLinha(linha, "orgao")) === orgao;

        const correspondeColaborador =
            !colaborador ||
            texto(valorDaLinha(linha, "colaborador")) === colaborador;

        let correspondePlano = true;

        if (plano === "sim") {
            correspondePlano = ehSim(valorDaLinha(linha, "plano"));
        } else if (plano === "nao") {
            correspondePlano = naoPossuiPlano(linha);
        }

        return correspondeOrgao &&
            correspondeColaborador &&
            correspondePlano;
    });

    atualizarPainel();
}

function limparFiltros() {
    document.getElementById("filtroOrgao").value = "";
    document.getElementById("filtroColaborador").value = "";
    document.getElementById("filtroPlano").value = "";

    aplicarFiltros();
}

/* =====================================================
   TABELA POR ÓRGÃO
===================================================== */

function renderizarTabelaOrgaos(dados) {
    const tbody = document.getElementById("tabelaOrgaos");
    tbody.innerHTML = "";

    if (!mapeamento.orgao) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="mensagem-vazia">
                    Não foi identificada a coluna de órgão na planilha.
                </td>
            </tr>
        `;
        return;
    }

    const grupos = {};

    dados.forEach(linha => {
        const orgao = texto(valorDaLinha(linha, "orgao")) || "Não informado";

        if (!grupos[orgao]) grupos[orgao] = [];
        grupos[orgao].push(linha);
    });

    const ordenados = Object.entries(grupos).sort(
        (a, b) => b[1].length - a[1].length
    );

    if (ordenados.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="5" class="mensagem-vazia">
                Nenhum registro encontrado.
            </td></tr>
        `;
        return;
    }

    ordenados.forEach(([orgao, linhas]) => {
        const tr = document.createElement("tr");

        const valores = [
            orgao,
            linhas.length,
            linhas.filter(naoPossuiPlano).length,
            linhas.filter(prospectInteressado).length,
            linhas.filter(aceitouAdesao).length
        ];

        valores.forEach(valor => {
            const td = document.createElement("td");
            td.textContent = valor;
            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });
}

/* =====================================================
   TABELA POR COLABORADOR
===================================================== */

function renderizarTabelaColaboradores(dados) {
    const tbody = document.getElementById("tabelaColaboradores");
    tbody.innerHTML = "";

    if (!mapeamento.colaborador) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="mensagem-vazia">
                    Não foi identificada a coluna de colaborador.
                </td>
            </tr>
        `;
        return;
    }

    const grupos = {};

    dados.forEach(linha => {
        const colaborador =
            texto(valorDaLinha(linha, "colaborador")) || "Não informado";

        if (!grupos[colaborador]) grupos[colaborador] = [];
        grupos[colaborador].push(linha);
    });

    const ordenados = Object.entries(grupos).sort(
        (a, b) => b[1].length - a[1].length
    );

    if (ordenados.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="4" class="mensagem-vazia">
                Nenhum registro encontrado.
            </td></tr>
        `;
        return;
    }

    ordenados.forEach(([colaborador, linhas]) => {
        const tr = document.createElement("tr");

        [
            colaborador,
            linhas.length,
            linhas.filter(prospectInteressado).length,
            linhas.filter(aceitouAdesao).length
        ].forEach(valor => {
            const td = document.createElement("td");
            td.textContent = valor;
            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });
}

/* =====================================================
   PRÉVIA DA BASE DE LEADS
===================================================== */

function renderizarTabelaLeads(dados) {
    const thead = document.getElementById("cabecalhoLeads");
    const tbody = document.getElementById("tabelaLeads");

    thead.innerHTML = "";
    tbody.innerHTML = "";

    if (dados.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td class="mensagem-vazia">
                    Nenhum registro encontrado para os filtros selecionados.
                </td>
            </tr>
        `;
        return;
    }

    const colunasVisiveis = colunasExcel;

    const trCabecalho = document.createElement("tr");

    colunasVisiveis.forEach(coluna => {
        const th = document.createElement("th");
        th.textContent = coluna;
        trCabecalho.appendChild(th);
    });

    thead.appendChild(trCabecalho);

    // Limita a prévia a 100 registros para manter o painel leve.
    dados.slice(0, 100).forEach(linha => {
        const tr = document.createElement("tr");

        colunasVisiveis.forEach(coluna => {
            const td = document.createElement("td");
            td.textContent = texto(linha[coluna]);
            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });

    if (dados.length > 100) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");

        td.colSpan = colunasVisiveis.length;
        td.className = "mensagem-vazia";
        td.textContent =
            `Exibindo os primeiros 100 registros de ${dados.length} leads.`;

        tr.appendChild(td);
        tbody.appendChild(tr);
    }
}

/* =====================================================
   ATUALIZAÇÃO DO PAINEL
===================================================== */

function atualizarPainel() {
    calcularIndicadores(baseFiltrada);
    renderizarTabelaOrgaos(baseFiltrada);
    renderizarTabelaColaboradores(baseFiltrada);
    renderizarTabelaLeads(baseFiltrada);

    atualizarStatus(
        `${baseFiltrada.length.toLocaleString("pt-BR")} registros`
    );
}

/* =====================================================
   IMPORTAÇÃO DO EXCEL
===================================================== */

arquivoExcel.addEventListener("change", function (evento) {
    const arquivo = evento.target.files[0];

    if (!arquivo) return;

    if (typeof XLSX === "undefined") {
        alert(
            "Não foi possível carregar a biblioteca Excel. " +
            "Verifique sua conexão com a internet e tente novamente."
        );
        return;
    }

    const leitor = new FileReader();

    leitor.onload = function (e) {
        try {
            const dados = new Uint8Array(e.target.result);
            const workbook = XLSX.read(dados, { type: "array" });

            // Utiliza a primeira aba da planilha.
            const primeiraAba = workbook.SheetNames[0];
            const planilha = workbook.Sheets[primeiraAba];

            const registros = XLSX.utils.sheet_to_json(planilha, {
                defval: "",
                raw: false
            });

            if (!registros.length) {
                alert("A planilha selecionada não possui registros.");
                return;
            }

            baseOriginal = registros;
            colunasExcel = Object.keys(registros[0]);

            identificarColunas();

            preencherFiltro("filtroOrgao", "orgao", "Todos os órgãos");
            preencherFiltro(
                "filtroColaborador",
                "colaborador",
                "Todos os colaboradores"
            );

            baseFiltrada = [...baseOriginal];
            atualizarPainel();

            const atualizacao = document.getElementById("ultimaAtualizacao");

            if (atualizacao) {
                atualizacao.textContent =
                    `Arquivo: ${arquivo.name} · Aba: ${primeiraAba}`;
            }

            console.log("Colunas identificadas:", mapeamento);

            console.log(
                "Campos não identificados:",
                Object.entries(mapeamento)
                    .filter(([, coluna]) => !coluna)
                    .map(([campo]) => campo)
            );

        } catch (erro) {
            console.error("Erro ao importar planilha:", erro);
            alert(
                "Não foi possível ler a planilha. " +
                "Verifique se o arquivo está válido."
            );
        }
    };

    leitor.readAsArrayBuffer(arquivo);
});

/* =====================================================
   EVENTOS DOS FILTROS
===================================================== */

document.getElementById("filtroOrgao")
    .addEventListener("change", aplicarFiltros);

document.getElementById("filtroColaborador")
    .addEventListener("change", aplicarFiltros);

document.getElementById("filtroPlano")
    .addEventListener("change", aplicarFiltros);

document.getElementById("limparFiltros")
    .addEventListener("click", limparFiltros);

/* =====================================================
   INICIALIZAÇÃO
===================================================== */

atualizarStatus("Aguardando planilha");

console.log("Analista — Captação e Cadastro inicializado.");