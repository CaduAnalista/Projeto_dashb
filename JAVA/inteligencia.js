/* ==========================================================

   INTELIGÊNCIA DE REDE — ASSEFAZ

   Importação Excel, indicadores, gráficos, filtros e exportação

   ========================================================== */



(() => {

    'use strict';



    const $ = (id) => document.getElementById(id);



    const hoje = () => {

        const d = new Date();

        d.setHours(0, 0, 0, 0);

        return d;

    };



    let baseOriginal = [];

    let baseFiltrada = [];

    let graficos = {};



    // ======================================================

    // 1. IDENTIFICAÇÃO DAS COLUNAS DO EXCEL

    // ======================================================



    const CAMPOS = {

        protocolo: ['PROTOCOLO', 'NUMERO DO PROTOCOLO', 'Nº PROTOCOLO', 'NUMERO', 'ID CHAMADO', 'ID'],

        beneficiario: ['NOME DO BENEFICIARIO', 'BENEFICIARIO', 'NOME BENEFICIARIO', 'NOME'],

        cpf: ['CPF', 'CPF BENEFICIARIO', 'DOCUMENTO'],

        email: ['EMAIL', 'E MAIL', 'E-MAIL', 'EMAIL DO BENEFICIARIO'],

        assunto: ['DESCRICAO ASSUNTO', 'ASSUNTO', 'DESCRICAO DO ASSUNTO'],

        grupo: ['DESCRICAO GRP OCORRENCIA', 'GRUPO DE OCORRENCIA', 'GRUPO OCORRENCIA', 'GRUPO'],

        subgrupo: ['DESCRICAO OCORRENCIA', 'SUBGRUPO', 'OCORRENCIA', 'DESCRICAO DA OCORRENCIA'],

        abertura: ['DATA ABERTURA', 'DATA DE ABERTURA', 'DATA ABERTURA OCORRENCIA', 'ABERTURA'],

        encerramento: ['DATA ENCERRAMENTO', 'DATA DE ENCERRAMENTO', 'DATA ENCERRAMENTO OCORRENCIA', 'ENCERRAMENTO', 'DATA FECHAMENTO'],

        previsao: ['DATA PREVISAO', 'DATA DA PREVISAO', 'PREVISAO', 'DATA LIMITE', 'PRAZO'],

        status566: ['STATUS SLA', 'STATUS 566', 'STATUS RN 566', 'SLA', 'SITUACAO SLA', 'STATUS PRAZO'],

        status: ['STATUS', 'STATUS OCORRENCIA', 'STATUS DO CHAMADO', 'SITUACAO', 'STATUS ATENDIMENTO'],

        observacao: ['OBS ABERTURA', 'OBSERVACAO ABERTURA', 'OBSERVACAO', 'OBSERVAÇÕES', 'OBS'],

        plano: ['PLANO', 'NOME DO PLANO', 'PLANO DE SAUDE', 'PRODUTO', 'CATEGORIA DO PLANO'],

        tipoManifestacao: ['DESCRICAO TIPO OCORRENCIA'],
        tipo: ['TIPO', 'TIPO DE CHAMADO', 'TIPO OCORRENCIA', 'CLASSIFICACAO', 'CATEGORIA']

    };



    function normalizar(valor) {

        return String(valor ?? '')

            .normalize('NFD')

            .replace(/[\u0300-\u036f]/g, '')

            .toUpperCase()

            .replace(/\s+/g, ' ')

            .trim();

    }



    function chaveCabecalho(valor) {

        return normalizar(valor).replace(/[^A-Z0-9]/g, '');

    }



    function acharCampo(obj, aliases) {

        const chaves = Object.keys(obj || {});

        const mapa = new Map(chaves.map(k => [chaveCabecalho(k), k]));



        for (const alias of aliases) {

            const encontrado = mapa.get(chaveCabecalho(alias));

            if (encontrado !== undefined) return obj[encontrado];

        }



        for (const alias of aliases) {

            const alvo = chaveCabecalho(alias);

            const encontrado = chaves.find(k => {

                const chave = chaveCabecalho(k);

                return chave === alvo ||

                    (chave.length > 4 && (chave.includes(alvo) || alvo.includes(chave)));

            });



            if (encontrado !== undefined) return obj[encontrado];

        }



        return '';

    }



    // ======================================================

    // 2. TRATAMENTO DE DATAS

    // ======================================================



    function dataValida(valor) {

        if (valor instanceof Date && !isNaN(valor)) {

            const d = new Date(valor);

            d.setHours(0, 0, 0, 0);

            return d;

        }



        if (typeof valor === 'number' && window.XLSX && XLSX.SSF) {

            const partes = XLSX.SSF.parse_date_code(valor);

            if (partes) {

                return new Date(partes.y, partes.m - 1, partes.d);

            }

        }



        if (valor === null || valor === undefined || String(valor).trim() === '') {

            return null;

        }



        const texto = String(valor).trim();



        const m = texto.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);



        if (m) {

            let ano = Number(m[3]);

            if (ano < 100) ano += ano < 50 ? 2000 : 1900;



            const d = new Date(ano, Number(m[2]) - 1, Number(m[1]));

            return isNaN(d) ? null : d;

        }



        const d = new Date(texto);



        if (isNaN(d)) return null;



        d.setHours(0, 0, 0, 0);

        return d;

    }



    function formatarData(valor) {

        const d = dataValida(valor);

        return d ? d.toLocaleDateString('pt-BR') : '—';

    }



    function ehMesmoDia(a, b) {

        const da = dataValida(a);

        const db = dataValida(b);



        return !!(da && db && da.getTime() === db.getTime());

    }



    // Conta dias úteis de segunda a sexta.

    // Feriados ainda não estão incluídos.

    function diasUteisEntre(inicio, fim) {

        const a = dataValida(inicio);

        const b = dataValida(fim);



        if (!a || !b || b <= a) return 0;



        let total = 0;

        const cursor = new Date(a);

        cursor.setDate(cursor.getDate() + 1);



        while (cursor <= b) {

            const dia = cursor.getDay();



            if (dia !== 0 && dia !== 6) {

                total++;

            }



            cursor.setDate(cursor.getDate() + 1);

        }



        return total;

    }



    function valorTexto(valor) {

        return String(valor ?? '').trim();

    }



    function dataAbertura(r) {

        return dataValida(acharCampo(r, CAMPOS.abertura));

    }



    function dataEncerramento(r) {

        return dataValida(acharCampo(r, CAMPOS.encerramento));

    }



    function statusFechado(r) {

        const encerramento = dataEncerramento(r);

        const status = normalizar(acharCampo(r, CAMPOS.status));



        return !!encerramento ||

            /ENCERRAD|CONCLUID|RESOLVID|FECHAD|FINALIZAD/.test(status);

    }



    // ======================================================

    // 3. CLASSIFICAÇÃO DOS SETORES

    // As regras abaixo são uma versão inicial.

    // Precisam ser validadas com os dados reais do CRM.

    // ======================================================



    const REGRAS_SETORES = [

        {

            setor: 'CADASTRO',

            assuntos: [

                'ADESAO A SAUDE', 'DEMAIS INFORMACOES',

                'INFORMACAO SOBRE ADESAO A SAUDE',

                'INFORMACAO SOBRE ADESAO AO SOCIAL',

                'INFORMACOES SOBRE CANCELAMENTO',

                'INFORMACOES CADASTRAIS', 'PORTAL - ADESAO',

                'PORTAL - SOCIAL'

            ],

            grupos: [

                'PORTABILIDADE', 'INCLUSAO DE DEPENDENTES/AGREGADO',

                'MUDANCA DE ORGAO', 'MIGRACAO DE PLANO',

                'SOLICITAR ADESAO', 'REINGRESSO',

                'ACOMPANHAMENTO DE ADESAO',

                'SITE/EXTRATO BENEFICIARIO', 'MOVIMENTACAO CADASTRAL',

                'DOCUMENTOS PARA ADESAO',

                'PORTABILIDADE / CARTA PERMANENCIA',

                'INFORMACOES SOBRE REINGRESSO', 'CARENCIAS - INFORMACOES',

                'ATUALIZACAO CADASTRAL', 'CARTEIRINHA',

                'INFORMACOES MUDANCA DE PATROCINADOR',

                'PRE INSCRICAO', 'OUTROS SERVICOS',

                'DESLIGAMENTO DE BENEFICIARIOS'

            ],

            subgrupos: [

                'PORTABILIDADE', 'INCLUSAO DE DEPENDENTES/AGREGA',

                'MUDANCA DE ORGAO', 'MIGRACAO DE PLANO',

                'SOLICITAR ADESAO', 'REINGRESSO',

                'ACOMPANHAMENTO DE ADESAO',

                'EXTRATO E COPARTICIPACOES', 'ADESAO E INCLUSAO',

                'TRANSFERENCIA DE PLANO',

                'MUDANCA DE CONVENIO/PATROCINADOR',

                'SUSPENSAO DE MENSALIDADE TEMPORARIA',

                'MANUTENCAO ESPECIAL - OBITO',

                'MANUTENCAO ESPECIAL - EXONERACAO',

                'REEINGRESSO', 'PORTABILIDADE DE PLANO',

                'RESSARCIMENTO DE MENSALIDADE',

                'DOCUMENTOS PARA ADESAO',

                'PORTABILIDADE / CARTA PERMANENCIA',

                'INFORMACOES SOBRE REINGRESSO',

                'CARENCIAS - INFORMACOES', 'ATUALIZACAO CADASTRAL',

                '2 VIA DA CARTEIRINHA',

                'INFORMACOES MUDANCA DE PATROCINADOR',

                'INFORMACOES SOBRE MIGRACAO DE PLANO',

                'SUSPENDER TEMPORARIAMENTE O PLANO (VIAGEM AO EXTERIOR)',

                'EXCLUSAO POR OBITO', 'OUTROS',

                'INCLUSAO AO PLANO DE SAUDE',

                'DESMEMBRAMENTO DE MENSALIDADE', 'OUTROS SERVICOS',

                'ADESAO AO SOCIAL', 'ADESAO AO PLANO DE SAUDE',

                'ORIENTACOES GERAIS',

                'EXONERACAO PELO ORGAO PATROCINADOR'

            ]

        },

        {

            setor: 'SOCIAL',

            assuntos: [

                'ATENCAO PRIMARIA A SAUDE', 'ATUALIZACAO CADASTRAL',

                'CENTROS DE LAZER', 'DEMAIS INFORMACOES',

                'DEMAIS INFORMACOES SOCIAL'

            ],

            grupos: [

                'ESPACO VIVA SAUDE', 'SITE', 'RESERVA',

                'OUTRAS INFORMACOES', 'OUTROS SERVICOS SOCIAL',

                'CONCIERGE'

            ],

            subgrupos: [

                'AGENDAMENTO APS', 'ACESSO PORTAL', 'RESERVA',

                'OUTRAS INFORMACOES', 'BENEFIFIOS DO SOCIAL'

            ]

        },

        {

            setor: 'CREDENCIAMENTO',

            assuntos: [

                'ATUALIZACAO CADASTRAL', 'CREDENCIAMENTO',

                'REDE CREDENCIADA'

            ],

            grupos: [

                'CREDENCIAMENTO', 'INFORMACOES SOBRE CREDENCIAMENTO',

                'ANALISE DE GARANTIA', 'RECIPROCIDADE',

                'REDE CREDENCIADA', 'SUSPENSAO DE ATENDIMENTO',

                'LANCAMENTO DE GUIAS'

            ],

            subgrupos: [

                'DESCREDENCIAMENTO', 'INFORMACOES CREDENCIAMENTO',

                'ATUALIZACAO / ALTERACAO CADASTRAL',

                'INCLUSAO DE CORPO CLINICO',

                'SOLICITACAO CREDENCIAMENTO / DESCREDENCIAMENTO',

                'RESET DE SENHA - AUTORIZADOR',

                'PRIMEIRO ACESSO AO PORTAL DO PRESTADOR',

                'EXAME LABORATORIAL', 'CANCELAMENTO DE AGENDAMENTO',

                'REDE INDIRETA - CASSI',

                'RECIPROCIDADE - DEMAIS CONVENIOS', 'UNIMED',

                'REDE CREDENCIADA LOCAL', 'SUSPENSAO DE ATENDIMENTO',

                'REDE CREDENCIADA', 'CONSULTA BASICA',

                'ESPECIALIDADES NAO MEDICAS',

                'AGENDAMENTO CONSULTA EM DEMAIS ESPECIALIDADES',

                'AGENDAMENTO INTERNACAO ELETIVA',

                'ATENDIMENTO URGENCIA/EMERGENCIA',

                'DEMAIS EXAMES / PROCEDIMENTOS',

                'ANALISE CONTRATUAL - (OPCAO EXCLUSIVA - CAS)',

                'CREDENCIAMENTO'

            ]

        },

        {

            setor: 'AUDITORIA',

            assuntos: [

                'AUTORIZACAO MEDICA',

                'INFORMACAO SOBRE AUTORIZACAO MEDICA',

                'PORTAL - SAUDE', 'PROGRAMAS DE SAUDE'

            ],

            grupos: [

                'AUTORIZACAO DE PROCEDIMENTOS', 'CANCELAMENTO DE GUIA',

                'COBERTURA ASSISTENCIAL', 'REMOCAO',

                'SOLICITACAO DE MEDICAMENTOS', 'AUTORIZACAO',

                'PROGRAMA DE IMUNIZACAO ASSEFAZ',

                'PROGRAMA DE ATENCAO DOMICILIAR - PAD'

            ],

            subgrupos: [

                'AUTORIZACAO/ MEDICAMENTOS QUIMIOTERAPICOS',

                'CONSULTA/ ACOMPANHAMENTO', 'ELEGIBILIDADE',

                'FORMULARIO TISS PELO SITE DA ASSEFAZ',

                'GUIAS - ALTERACAO DE FLUXO/CANCELAMENTO',

                'GUIA RETROATIVA/ OBITO DO BENEFICIARIO',

                'OPME - SOLICITACAO DE GUIAS',

                'PRORROGACAO DIARIA/ ORIENTACAO',

                'PEDIDO MEDICO - FISICO/ DIGITAL', 'CANCELAMENTO',

                'ACOMPANHAMENTO DE GUIAS',

                'ATENDIMENTO DE URGENCIA/EMERGENCIA',

                'CANCELAMENTO DE GUIAS',

                'ACOMPANHAMENTO DE GUIAS CNU',

                'QUIMIOTERAPICO - ORAL', 'REGRAS GERAIS',

                'ANALISE DE SOLICITACAO (REGULACAO MEDICA)',

                'SOLICITACAO DE MEDICAMENTO QUIMIOTERAPICO ORAL',

                'IMUNOFAZ', 'ADMISSAO HOSPITAL DE TRANSICAO',

                'ADMISSAO PAD', 'ALTA HOSPITAL DE TRANSICAO',

                'RJ - RIO DE JANEIRO', 'MONITORAMENTO',

                'COBERTURA PARA ACOMPANHANTE',

                'LENTE INTRAOCULAR - LIO (OPME)',

                'PARECER DE COBERTURA (PEDIDO MEDICO)',

                'PLANO ODONTOLOGICO', 'OUTROS SERVICOS'

            ]

        },

        {

            setor: 'FINANCEIRO',

            assuntos: [

                'DEMAIS INFORMACOES', 'FATURAMENTO', 'FINANCEIRO',

                'FINANCEIRO/2 VIA DE BOLETO',

                'PORTAL - SAUDE', 'PORTAL - SOCIAL'

            ],

            grupos: [

                'MOVIMENTACAO CADASTRAL', 'FATURAMENTO',

                'ALTERAR FORMA DE PAGAMENTO',

                'DESMEMBRAMENTO FINANCEIRO', 'VALORES DOS PLANOS',

                'NEGOCIACAO DE DIVIDAS',

                'NOTIFICACAO DE INADIMPLENCIA',

                'SOLICITACOES FINANCEIRAS', 'FATURAMENTO OPME',

                'IMPOSTO DE RENDA'

            ],

            subgrupos: [

                'DESMEMBRAMENTO DE MENSALIDADE',

                'INSTRUCOES SOBRE FATURAMENTO / RECURSO DE GLOSA',

                'BPO - AUSENCIA DE PAGAMENTO POR EXTRAVIO DE FATURAS',

                'BPO - FATURAS GLOSADAS POR FALTA DE FISICO',

                'DEMONSTRATIVO DE PAGAMENTO',

                'DUVIDAS - ENVIO DE FATURAS EM FFP OU XML',

                'ENTREGA DE FATURAMENTO', 'FATURAMENTO OPME',

                'PAGAMENTO - FATURAMENTO / NF - CRONOGRAMA',

                'BPO - PRESTADOR NAO ENCONTRADO NO SISTEMA',

                'CANCELAMENTO DE FATURAS - FFP OU XML',

                'CANCELAMENTO DE NF',

                'ERROS - ENVIO DE FATURAS EM XML/FFP',

                'NEGOCIACAO CONTRATUAL', 'ALTERAR FORMA DE PAGAMENTO',

                'DESMEMBRAMENTO FINANCEIRO', 'NEGOCIACAO DE VALORES / PARCELA',

                'NEGOCIACAO DE DIVIDAS', 'NOTIFICACAO DE INADIMPLENCIA',

                'SOLICITACOES DE SERVICOS FINANCEIROS',

                'EMISSAO DE DECLARACAO - PJ', 'FATURA FORA DO PRAZO'

            ]

        },

        {

            setor: 'REEMBOLSO',

            assuntos: [

                'INFORMACOES SOBRE REEMBOLSO', 'PORTAL - SAUDE'

            ],

            grupos: [

                'REEMBOLSO DE VACINAS', 'PROCEDIMENTOS MEDICOS',

                'CONSULTAR EXTRATO - REEMBOLSO',

                'REEMBOLSO DE MEDICAMENTOS', 'ODONTOLOGICO',

                'SOLICITACAO DE REEMBOLSO'

            ],

            subgrupos: [

                'REEMBOLSO DE VACINAS', 'PROCEDIMENTOS MEDICOS',

                'CONSULTAR EXTRATO - REEMBOLSO',

                'REEMBOLSO DE MEDICAMENTOS', 'ODONTOLOGICO',

                'SOLICITACAO DE REEMBOLSO',

                'REEMBOLSO DE PROCEDIMENTOS'

            ]

        },

        {

            setor: 'CAPTAÇÃO',

            assuntos: ['INFORMACOES SOBRE CANCELAMENTO'],

            grupos: ['DESLIGAMENTO DE BENEFICIARIOS'],

            subgrupos: [

                'CANCELAMENTO DE DEPENDENTE',

                'CANCELAMENTO DE AGREGADO', 'MOTIVOS FINANCEIROS',

                'PORTABILIDADE/TROCA POR OUTRA OPERADORA',

                'INSUFICIENCIA DE REDE CREDENCIADA',

                'CANCELAMENTO ASSEFAZ SOCIAL',

                'MUDANCA DE CIDADE (UF)'

            ]

        },

        {

            setor: 'OUTROS',

            assuntos: ['DEMAIS INFORMACOES', 'PORTAL - SAUDE'],

            grupos: ['OUTROS SERVICOS'],

            subgrupos: ['OUTROS SERVICOS']

        }

    ];



    function classificarSetor(r) {

        const assunto = normalizar(acharCampo(r, CAMPOS.assunto));

        const grupo = normalizar(acharCampo(r, CAMPOS.grupo));

        const subgrupo = normalizar(acharCampo(r, CAMPOS.subgrupo));



        for (const regra of REGRAS_SETORES) {

            if (

                regra.assuntos.includes(assunto) &&

                regra.grupos.includes(grupo) &&

                regra.subgrupos.includes(subgrupo)

            ) {

                return regra.setor;

            }

        }



        const setorExistente = acharCampo(r, [

            'SETOR', 'SETORES', 'SETOR RESPONSAVEL', 'AREA RESPONSAVEL'

        ]);



        return valorTexto(setorExistente) || 'NÃO CLASSIFICADO';

    }



    // ======================================================

    // 4. STATUS DOS PRAZOS

    // ======================================================



    function statusRN623(r) {

        const abertura = dataAbertura(r);



        if (!abertura) return 'Sem data';



        const fim = dataEncerramento(r) || hoje();

        const dias = diasUteisEntre(abertura, fim);



        if (dias > 5) return 'Atraso';

        if (dias >= 4) return 'Atenção';



        return 'Em dia';

    }



    function statusRN566(r) {

        const bruto = normalizar(acharCampo(r, CAMPOS.status566));



        if (!bruto) return 'Não informado';



        if (/ATRAS|VENCID|FORA DO PRAZO|EM DESACORDO/.test(bruto)) {

            return 'Atraso';

        }



        if (/ATENCAO|VENCE HOJE|PROXIMO DO PRAZO/.test(bruto)) {

            return 'Atenção';

        }



        if (/EM DIA|NO PRAZO|DENTRO DO PRAZO|CUMPRIDO|RESOLVIDO NO PRAZO/.test(bruto)) {

            return 'Em dia';

        }



        return valorTexto(acharCampo(r, CAMPOS.status566));

    }



    function ehReclamacao(r) {
        // Na planilha do CRM, a classificação correta está em
        // DESCRICAO_TIPO_OCORRENCIA. Não usar TIPO_OCORRENCIA,
        // pois essa coluna contém códigos numéricos (001, 002, 003...).
        const tipoManifestacao = normalizar(
            acharCampo(r, CAMPOS.tipoManifestacao)
        );

        return tipoManifestacao === 'RECLAMACAO';
    }

    // ======================================================

    // 5. PREPARAÇÃO DOS REGISTROS

    // ======================================================



    function prepararRegistro(r) {

        const setor = classificarSetor(r);

        const abertura = dataAbertura(r);

        const encerramento = dataEncerramento(r);

        const fechado = statusFechado(r);

        const status623 = statusRN623(r);

        const status566Texto = statusRN566(r);

        const status566Norm = normalizar(status566Texto);



        const resolvidoNoPrazo = fechado &&

            /EM DIA|NO PRAZO|CUMPRIDO|RESOLVIDO NO PRAZO/.test(status566Norm);



        return {

            original: r,

            protocolo: valorTexto(acharCampo(r, CAMPOS.protocolo)),

            beneficiario: valorTexto(acharCampo(r, CAMPOS.beneficiario)),

            cpf: valorTexto(acharCampo(r, CAMPOS.cpf)),

            email: valorTexto(acharCampo(r, CAMPOS.email)),

            setor,

            assunto: valorTexto(acharCampo(r, CAMPOS.assunto)),

            grupo: valorTexto(acharCampo(r, CAMPOS.grupo)),

            subgrupo: valorTexto(acharCampo(r, CAMPOS.subgrupo)),

            descricao: valorTexto(acharCampo(r, CAMPOS.subgrupo)) ||

                valorTexto(acharCampo(r, CAMPOS.assunto)),

            abertura,

            encerramento,

            previsao: dataValida(acharCampo(r, CAMPOS.previsao)),

            status566: status566Texto,

            status623,

            observacao: valorTexto(acharCampo(r, CAMPOS.observacao)),

            status: fechado ? 'Encerrado' : 'Aberto',

            plano: valorTexto(acharCampo(r, CAMPOS.plano)) || 'Não informado',

            reclamacao: ehReclamacao(r),

            resolvidoNoPrazo,

            diasParaEncerrar: encerramento && abertura

                ? diasUteisEntre(abertura, encerramento)

                : null

        };

    }



    // ======================================================

    // 6. FUNÇÕES AUXILIARES

    // ======================================================



    function setTexto(id, texto) {

        const el = $(id);

        if (el) el.textContent = texto;

    }



    function numeroBR(n) {

        return Number(n || 0).toLocaleString('pt-BR');

    }



    function percentual(n) {

        return `${Number(n || 0).toLocaleString('pt-BR', {

            maximumFractionDigits: 2,

            minimumFractionDigits: 2

        })}%`;

    }



    function media(nums) {

        const validos = nums.filter(n => Number.isFinite(n));



        return validos.length

            ? validos.reduce((a, b) => a + b, 0) / validos.length

            : 0;

    }



    function criarGrafico(id, tipo, labels, datasets, opcoesExtras = {}) {

        const canvas = $(id);



        if (!canvas || !window.Chart) return;



        if (graficos[id]) {

            graficos[id].destroy();

        }



        graficos[id] = new Chart(canvas, {

            type: tipo,

            data: { labels, datasets },

            options: {

                responsive: true,

                maintainAspectRatio: false,

                interaction: {

                    intersect: false,

                    mode: 'index'

                },

                plugins: {

                    legend: {

                        display: datasets.length > 1,

                        position: 'bottom',

                        labels: {

                            usePointStyle: true,

                            boxWidth: 8,

                            padding: 16

                        }

                    },

                    tooltip: { enabled: true }

                },

                scales: tipo === 'doughnut' || tipo === 'pie' ? {} : {

                    x: {

                        grid: { display: false },

                        ticks: {

                            color: '#738196',

                            maxRotation: 45,

                            minRotation: 0

                        }

                    },

                    y: {

                        beginAtZero: true,

                        grid: { color: '#edf1f6' },

                        ticks: {

                            color: '#738196',

                            precision: 0

                        }

                    }

                },

                ...opcoesExtras

            }

        });

    }



    function contarPor(lista, fn) {

        const mapa = new Map();



        lista.forEach(item => {

            const chave = fn(item) || 'Não informado';

            mapa.set(chave, (mapa.get(chave) || 0) + 1);

        });



        return [...mapa.entries()].sort((a, b) => b[1] - a[1]);

    }



    function mesesOrdenados(lista) {

        const mapa = new Map();



        lista.forEach(r => {

            if (!r.abertura) return;



            const chave =

                `${r.abertura.getFullYear()}-${String(r.abertura.getMonth() + 1).padStart(2, '0')}`;



            mapa.set(chave, (mapa.get(chave) || 0) + 1);

        });



        return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0]));

    }



    function rotuloMes(chave) {

        const [ano, mes] = chave.split('-');

        return `${mes}/${ano}`;

    }



    // ======================================================

    // 7. FILTROS

    // ======================================================



    function popularFiltroSetor() {

        const select = $('filtroSetor');

        if (!select) return;



        const atual = select.value;



        const setores = [...new Set(baseOriginal.map(r => r.setor))]

            .sort((a, b) => a.localeCompare(b, 'pt-BR'));



        select.innerHTML = '<option value="">Todos os setores</option>';



        setores.forEach(setor => {

            const opt = document.createElement('option');

            opt.value = setor;

            opt.textContent = setor;

            select.appendChild(opt);

        });



        if (setores.includes(atual)) {

            select.value = atual;

        }

    }



    function aplicarFiltros() {

        const setor = $('filtroSetor')?.value || '';

        const status = $('filtroStatus')?.value || '';

        const sla = $('filtroSLA')?.value || '';

        const inicial = dataValida($('dataInicial')?.value);

        const final = dataValida($('dataFinal')?.value);



        baseFiltrada = baseOriginal.filter(r => {

            if (setor && r.setor !== setor) return false;



            if (status && r.status.toLowerCase() !== status) {

                return false;

            }



            if (sla && normalizar(r.status623).toLowerCase() !== sla) {

                return false;

            }



            if (inicial && (!r.abertura || r.abertura < inicial)) {

                return false;

            }



            if (final && (!r.abertura || r.abertura > final)) {

                return false;

            }



            return true;

        });



        renderizarPainel(baseFiltrada);

    }



    // ======================================================

    // 8. INDICADORES PRINCIPAIS

    // ======================================================



    function renderizarIndicadores(lista) {

        const agora = hoje();



        const abertos = lista.filter(r => r.status === 'Aberto');

        const encerrados = lista.filter(r => r.status === 'Encerrado');



        const abertosHoje = lista.filter(r => ehMesmoDia(r.abertura, agora));

        const encerradosHoje = lista.filter(r => ehMesmoDia(r.encerramento, agora));



        const atrasados623 = abertos.filter(r => r.status623 === 'Atraso').length;



        const atrasados566 = lista.filter(r =>

            /ATRAS|VENCID|FORA DO PRAZO/.test(normalizar(r.status566))

        ).length;



        const tempos = encerrados

            .map(r => r.diasParaEncerrar)

            .filter(n => n !== null);



        const mesAtual = agora.getMonth();

        const anoAtual = agora.getFullYear();



        const chamadosMes = lista.filter(r =>

            r.abertura &&

            r.abertura.getMonth() === mesAtual &&

            r.abertura.getFullYear() === anoAtual

        );



        const encerradosMes = chamadosMes.filter(r => r.status === 'Encerrado');



        const resolvidosNoPrazo = encerradosMes.filter(r => r.resolvidoNoPrazo).length;



        const ir = encerradosMes.length

            ? resolvidosNoPrazo / encerradosMes.length * 100

            : 0;



        setTexto('totalChamados', numeroBR(lista.length));

        setTexto('abertosHoje', numeroBR(abertosHoje.length));

        setTexto('encerradosHoje', numeroBR(encerradosHoje.length));

        setTexto('totalAbertos', numeroBR(abertos.length));

        setTexto('atrasadosRN623', numeroBR(atrasados623));

        setTexto('atrasadosRN566', numeroBR(atrasados566));



        setTexto(

            'tempoMedioEncerramento',

            tempos.length

                ? `${media(tempos).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} dias úteis`

                : '—'

        );



        setTexto('irMes', encerradosMes.length ? percentual(ir) : '—');



        const reclamacoes = lista.filter(r => r.reclamacao);



        setTexto('totalReclamacoes', numeroBR(reclamacoes.length));



        const mesesReclamacao = new Set(

            reclamacoes

                .filter(r => r.abertura)

                .map(r => `${r.abertura.getFullYear()}-${r.abertura.getMonth()}`)

        );



        const mediaReclamacoes = mesesReclamacao.size

            ? media([...mesesReclamacao].map(m =>

                reclamacoes.filter(r =>

                    r.abertura &&

                    `${r.abertura.getFullYear()}-${r.abertura.getMonth()}` === m

                ).length

            ))

            : null;



        setTexto(

            'mediaReclamacoes',

            mediaReclamacoes === null

                ? '—'

                : mediaReclamacoes.toLocaleString('pt-BR', { maximumFractionDigits: 1 })

        );

    }



    // ======================================================

    // 9. SLA POR SETOR

    // ======================================================



    function renderizarSLA(lista) {

        const porSetor = contarPor(lista, r => r.setor).map(([setor]) => {

            const itens = lista.filter(r => r.setor === setor);



            return {

                setor,

                total: itens.length,

                emDia: itens.filter(r => r.status623 === 'Em dia').length,

                atencao: itens.filter(r => r.status623 === 'Atenção').length,

                atraso: itens.filter(r => r.status623 === 'Atraso').length

            };

        });



        const tbody = $('tabelaSLABody');



        if (tbody) {

            tbody.innerHTML = '';



            if (!porSetor.length) {

                tbody.innerHTML =

                    '<tr><td colspan="5" class="empty-state">Nenhum dado para os filtros selecionados.</td></tr>';

            } else {

                porSetor.forEach(item => {

                    const tr = document.createElement('tr');



                    [

                        item.setor,

                        numeroBR(item.total),

                        numeroBR(item.emDia),

                        numeroBR(item.atencao),

                        numeroBR(item.atraso)

                    ].forEach((v, i) => {

                        const td = document.createElement('td');

                        td.textContent = v;



                        if (i === 3) td.style.color = '#b7790b';

                        if (i === 4) td.style.color = '#c43d43';

                        if (i === 2) td.style.color = '#16845b';



                        tr.appendChild(td);

                    });



                    tbody.appendChild(tr);

                });

            }

        }



        criarGrafico(

            'graficoSLASetores',

            'bar',

            porSetor.map(x => x.setor),

            [

                {

                    label: 'Em dia',

                    data: porSetor.map(x => x.emDia),

                    backgroundColor: '#16845b',

                    borderRadius: 4

                },

                {

                    label: 'Em atenção',

                    data: porSetor.map(x => x.atencao),

                    backgroundColor: '#e5b32c',

                    borderRadius: 4

                },

                {

                    label: 'Em atraso',

                    data: porSetor.map(x => x.atraso),

                    backgroundColor: '#c43d43',

                    borderRadius: 4

                }

            ],

            {

                scales: {

                    x: { stacked: false, grid: { display: false } },

                    y: {

                        beginAtZero: true,

                        grid: { color: '#edf1f6' },

                        ticks: { precision: 0 }

                    }

                }

            }

        );

    }



    // ======================================================

    // 10. EVOLUÇÃO DOS CHAMADOS

    // ======================================================



    function renderizarEvolucao(lista) {

        const meses = mesesOrdenados(lista);

        const labels = meses.map(([mes]) => rotuloMes(mes));

        const valores = meses.map(([, total]) => total);



        criarGrafico(

            'graficoEvolucaoChamados',

            'line',

            labels,

            [

                {

                    label: 'Chamados',

                    data: valores,

                    borderColor: '#1769aa',

                    backgroundColor: 'rgba(23,105,170,.12)',

                    fill: true,

                    tension: .3

                },

                {

                    label: 'Média',

                    data: labels.map(() => media(valores)),

                    borderColor: '#e5b32c',

                    borderDash: [6, 5],

                    pointRadius: 0,

                    fill: false

                }

            ]

        );



        const mesesFluxo = [

            ...new Set(

                lista

                    .filter(r => r.abertura)

                    .map(r =>

                        `${r.abertura.getFullYear()}-${String(r.abertura.getMonth() + 1).padStart(2, '0')}`

                    )

            )

        ].sort();



        const aberturas = mesesFluxo.map(m =>

            lista.filter(r =>

                r.abertura &&

                `${r.abertura.getFullYear()}-${String(r.abertura.getMonth() + 1).padStart(2, '0')}` === m

            ).length

        );



        const fechamentos = mesesFluxo.map(m =>

            lista.filter(r =>

                r.encerramento &&

                `${r.encerramento.getFullYear()}-${String(r.encerramento.getMonth() + 1).padStart(2, '0')}` === m

            ).length

        );



        const cores = fechamentos.map((n, i) =>

            n > aberturas[i] ? '#16845b'

                : n === aberturas[i] ? '#e5b32c'

                : '#c43d43'

        );



        criarGrafico(

            'graficoAbertosEncerrados',

            'bar',

            mesesFluxo.map(rotuloMes),

            [

                {

                    type: 'line',

                    label: 'Aberturas',

                    data: aberturas,

                    borderColor: '#1769aa',

                    backgroundColor: '#1769aa',

                    tension: .25,

                    yAxisID: 'y'

                },

                {

                    type: 'bar',

                    label: 'Encerramentos',

                    data: fechamentos,

                    backgroundColor: cores,

                    borderRadius: 4,

                    yAxisID: 'y'

                }

            ]

        );

    }



    // ======================================================

    // 11. DISTRIBUIÇÃO POR ASSUNTO E SETOR

    // ======================================================



    function renderizarDistribuicao(lista) {

        const assuntos = contarPor(lista, r => r.assunto || r.subgrupo).slice(0, 12);



        criarGrafico(

            'graficoAssuntos',

            'bar',

            assuntos.map(x => x[0]),

            [{

                label: 'Chamados',

                data: assuntos.map(x => x[1]),

                backgroundColor: '#2878c8',

                borderRadius: 4

            }],

            {

                indexAxis: 'y',

                plugins: { legend: { display: false } },

                scales: {

                    x: { beginAtZero: true, ticks: { precision: 0 } },

                    y: { grid: { display: false } }

                }

            }

        );



        const setores = contarPor(lista, r => r.setor);



        criarGrafico(

            'graficoSetores',

            'doughnut',

            setores.map(x => x[0]),

            [{

                label: 'Chamados',

                data: setores.map(x => x[1]),

                backgroundColor: [

                    '#1769aa', '#16845b', '#e5b32c', '#c43d43',

                    '#7656b5', '#46a6a0', '#e58b45', '#8c9bad'

                ],

                borderWidth: 0

            }]

        );

    }



    // ======================================================

    // 12. RECLAMAÇÕES

    // ======================================================



    function renderizarReclamacoes(lista) {

        const reclamacoes = lista.filter(r => r.reclamacao);



        const plano = contarPor(reclamacoes, r => r.plano);

        const assunto = contarPor(reclamacoes, r => r.assunto || r.subgrupo).slice(0, 10);

        const setor = contarPor(reclamacoes, r => r.setor);



        criarGrafico(

            'graficoReclamacoesPlano',

            'doughnut',

            plano.map(x => x[0]),

            [{

                label: 'Reclamações',

                data: plano.map(x => x[1]),

                backgroundColor: [

                    '#1769aa', '#16845b', '#e5b32c', '#c43d43',

                    '#7656b5', '#46a6a0', '#8c9bad'

                ],

                borderWidth: 0

            }]

        );



        criarGrafico(

            'graficoReclamacoesAssunto',

            'bar',

            assunto.map(x => x[0]),

            [{

                label: 'Reclamações',

                data: assunto.map(x => x[1]),

                backgroundColor: '#2878c8',

                borderRadius: 4

            }],

            {

                indexAxis: 'y',

                plugins: { legend: { display: false } },

                scales: {

                    x: { beginAtZero: true, ticks: { precision: 0 } },

                    y: { grid: { display: false } }

                }

            }

        );



        criarGrafico(

            'graficoReclamacoesSetor',

            'doughnut',

            setor.map(x => x[0]),

            [{

                label: 'Reclamações',

                data: setor.map(x => x[1]),

                backgroundColor: [

                    '#1769aa', '#16845b', '#e5b32c', '#c43d43',

                    '#7656b5', '#46a6a0', '#8c9bad'

                ],

                borderWidth: 0

            }]

        );



        const mesesMap = new Map();



        reclamacoes.forEach(r => {

            if (!r.abertura) return;



            const k =

                `${r.abertura.getFullYear()}-${String(r.abertura.getMonth() + 1).padStart(2, '0')}`;



            mesesMap.set(k, (mesesMap.get(k) || 0) + 1);

        });



        const meses = [...mesesMap.entries()]

            .sort((a, b) => a[0].localeCompare(b[0]));



        const vals = meses.map(x => x[1]);



        criarGrafico(

            'graficoReclamacoesMensal',

            'line',

            meses.map(x => rotuloMes(x[0])),

            [

                {

                    label: 'Reclamações',

                    data: vals,

                    borderColor: '#c43d43',

                    backgroundColor: 'rgba(196,61,67,.10)',

                    fill: true,

                    tension: .3

                },

                {

                    label: 'Média',

                    data: vals.map(() => media(vals)),

                    borderColor: '#e5b32c',

                    borderDash: [6, 5],

                    pointRadius: 0,

                    fill: false

                }

            ]

        );

    }



    // ======================================================

    // 13. TABELA DE CHAMADOS

    // ======================================================



    function renderizarTabela(lista) {

        const tbody = $('corpoTabelaChamados');

        if (!tbody) return;



        tbody.innerHTML = '';



        setTexto('quantidadeRegistros', `${numeroBR(lista.length)} registros encontrados`);



        if (!lista.length) {

            tbody.innerHTML =

                '<tr><td colspan="11" class="empty-state">Nenhum chamado encontrado para os filtros selecionados.</td></tr>';

            return;

        }



        const fragmento = document.createDocumentFragment();



        lista.forEach(r => {

            const tr = document.createElement('tr');



            const valores = [

                r.protocolo,

                r.beneficiario,

                r.cpf,

                r.email,

                r.setor,

                r.descricao,

                formatarData(r.abertura),

                formatarData(r.previsao),

                r.status566,

                r.status623,

                r.observacao

            ];



            valores.forEach((valor, i) => {

                const td = document.createElement('td');



                if (i === 8 || i === 9) {

                    const span = document.createElement('span');

                    span.textContent = valor || 'Não informado';



                    const n = normalizar(valor);



                    span.className =

                        /ATRAS/.test(n) ? 'status-atraso'

                        : /ATENCAO/.test(n) ? 'status-atencao'

                        : /EM DIA|NO PRAZO/.test(n) ? 'status-em-dia'

                        : '';



                    td.appendChild(span);

                } else {

                    td.textContent = valor || '—';

                }



                tr.appendChild(td);

            });



            fragmento.appendChild(tr);

        });



        tbody.appendChild(fragmento);

    }



    function renderizarPainel(lista) {

        renderizarIndicadores(lista);

        renderizarSLA(lista);

        renderizarEvolucao(lista);

        renderizarDistribuicao(lista);

        renderizarReclamacoes(lista);

        renderizarTabela(lista);

    }



    // ======================================================

    // 14. EXPORTAÇÃO PARA EXCEL

    // ======================================================



    function exportarExcel() {

        if (!baseFiltrada.length) {

            alert('Não há chamados para exportar. Importe uma planilha e confira os filtros.');

            return;

        }



        const dados = baseFiltrada.map(r => ({

            'Protocolo': r.protocolo,

            'Nome do beneficiário': r.beneficiario,

            'CPF': r.cpf,

            'E-mail': r.email,

            'Setor': r.setor,

            'Descrição da ocorrência': r.descricao,

            'Data de abertura': r.abertura ? formatarData(r.abertura) : '',

            'Data da previsão': r.previsao ? formatarData(r.previsao) : '',

            'Status_566': r.status566,

            'Status623': r.status623,

            'obs_abertura': r.observacao

        }));



        if (window.XLSX) {

            const ws = XLSX.utils.json_to_sheet(dados);



            ws['!cols'] = [

                { wch: 18 }, { wch: 30 }, { wch: 16 },

                { wch: 28 }, { wch: 20 }, { wch: 36 },

                { wch: 18 }, { wch: 18 }, { wch: 18 },

                { wch: 18 }, { wch: 40 }

            ];



            const wb = XLSX.utils.book_new();



            XLSX.utils.book_append_sheet(wb, ws, 'Chamados');



            XLSX.writeFile(wb, 'Inteligencia_de_Rede_Chamados.xlsx');

        } else {

            const cab = Object.keys(dados[0]);



            const csv = [cab, ...dados.map(o => cab.map(k => o[k] ?? ''))]

                .map(l => l.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'))

                .join('\r\n');



            const blob = new Blob(['\ufeff' + csv], {

                type: 'text/csv;charset=utf-8;'

            });



            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');



            a.href = url;

            a.download = 'Inteligencia_de_Rede_Chamados.csv';

            a.click();



            URL.revokeObjectURL(url);

        }

    }



    // ======================================================

    // 15. IMPORTAÇÃO DO EXCEL

    // ======================================================



    async function importarArquivo(arquivo) {

        if (!arquivo) return;



        if (!window.XLSX) {

            setTexto(

                'mensagemImportacao',

                'Não foi possível carregar a biblioteca de Excel. Verifique a conexão com a internet.'

            );

            return;

        }



        setTexto('statusBase', 'Importando...');

        setTexto('mensagemImportacao', `Lendo ${arquivo.name}...`);



        try {

            const buffer = await arquivo.arrayBuffer();



            const workbook = XLSX.read(buffer, {

                type: 'array',

                cellDates: true

            });



            const nomeAba = workbook.SheetNames[0];

            const planilha = workbook.Sheets[nomeAba];



            const linhas = XLSX.utils.sheet_to_json(planilha, {

                defval: '',

                raw: true

            });



            if (!linhas.length) {

                throw new Error('A primeira aba da planilha está vazia.');

            }



            baseOriginal = linhas.map(prepararRegistro);



            popularFiltroSetor();

            aplicarFiltros();



            setTexto('statusBase', 'Planilha carregada');



            setTexto(

                'mensagemImportacao',

                `${arquivo.name} · ${numeroBR(baseOriginal.length)} registros · Aba: ${nomeAba}`

            );



            setTexto(

                'ultimaAtualizacao',

                `Atualizado em ${new Date().toLocaleString('pt-BR')}`

            );



        } catch (erro) {

            console.error(erro);



            setTexto('statusBase', 'Falha na importação');



            setTexto(

                'mensagemImportacao',

                `Não foi possível ler a planilha: ${erro.message}`

            );

        }

    }



    // ======================================================

    // 16. INICIALIZAÇÃO E EVENTOS

    // ======================================================



    function iniciar() {

        $('arquivoExcel')?.addEventListener('change', e => {

            importarArquivo(e.target.files?.[0]);

        });



        [

            'filtroSetor',

            'filtroStatus',

            'filtroSLA',

            'dataInicial',

            'dataFinal'

        ].forEach(id => {

            $(id)?.addEventListener('change', aplicarFiltros);

        });



        $('limparFiltros')?.addEventListener('click', () => {

            [

                'filtroSetor',

                'filtroStatus',

                'filtroSLA',

                'dataInicial',

                'dataFinal'

            ].forEach(id => {

                if ($(id)) $(id).value = '';

            });



            aplicarFiltros();

        });



        $('exportarChamados')?.addEventListener('click', exportarExcel);



        $('btnAtualizar')?.addEventListener('click', () => {

            if (baseOriginal.length) {

                aplicarFiltros();

            } else {

                setTexto(

                    'mensagemImportacao',

                    'Importe uma planilha para atualizar os indicadores.'

                );

            }

        });

    }



    document.addEventListener('DOMContentLoaded', iniciar);



})();