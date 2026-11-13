/* ==========================================================
   INTELIGÊNCIA DE REDE — NEXUS
   Tela 1 (Visão operacional): pendentes, abertos e encerrados hoje,
   pendentes por setor (RN 623) e tabela de protocolos com exportação.
   Tudo é calculado no navegador: a planilha não sai daqui.
   A versão anterior desta página está em ARQUIVO/inteligencia-v1/.
   ========================================================== */

(() => {
    'use strict';

    const $ = (id) => document.getElementById(id);

    /* ======================================================
       1. COLUNAS DA PLANILHA
       Reconhecidas pelo nome do cabeçalho, ignorando acentos,
       maiúsculas, espaços e sublinhados. Primeiro procura o nome
       exato; se não achar, aceita um nome que contenha o outro.
    ====================================================== */

    const CAMPOS = {
        protocolo: ['PROTOCOLO ANS', 'PROTOCOLO', 'NUMERO DO PROTOCOLO', 'Nº PROTOCOLO'],
        cpf: ['CPF BENEFICIARIO', 'CPF', 'CPF DO BENEFICIARIO'],
        nome: ['NOME BENEFICIARIO', 'NOME DO BENEFICIARIO', 'NOME', 'Nome Beneficiário', 'DESC BENEFICIARIO'],
        email: ['EMAIL', 'E-MAIL', 'E MAIL', 'EMAIL DO BENEFICIARIO'],
        assunto: ['DESC ASSUNTO', 'DESCRICAO ASSUNTO', 'ASSUNTO', 'DESCRICAO DO ASSUNTO'],
        grupo: ['DESC GRP OCORRENCIA', 'DESCRICAO GRP OCORRENCIA', 'GRUPO DE OCORRENCIA', 'GRUPO OCORRENCIA'],
        ocorrencia: ['DESC OCORRENCIA', 'DESCRICAO OCORRENCIA', 'DESCRICAO DA OCORRENCIA', 'OCORRENCIA'],
        tipo: ['DESC TIPO OCORRENCIA', 'DESCRICAO TIPO OCORRENCIA', 'TIPO DE OCORRENCIA'],

        /* canal de comunicação. Não usar "COMUNICACAO": essa coluna só tem códigos (000005...) */
        canal: ['DESC COMUNICACAO', 'DESCRICAO COMUNICACAO', 'DESCRICAO DA COMUNICACAO', 'CANAL DE COMUNICACAO', 'CANAL'],
        abertura: ['DATA ABERTURA OCORRENCIA', 'DATA ABERTURA', 'DATA DE ABERTURA'],
        encerramento: ['DATA ENCERRAMENTO OCORRENCIA', 'DATA ENCERRAMENTO', 'DATA DE ENCERRAMENTO'],
        previsao: ['DATA PREVISAO SLA', 'DATA PREVISAO', 'DATA DA PREVISAO', 'PRAZO'],
        status: ['STATUS OCORRENCIA', 'STATUS'],
        observacao: ['OBS ABERTURA', 'OBSERVACAO ABERTURA', 'OBSERVACAO DE ABERTURA'],
        setor: ['SETOR', 'SETOR RESPONSAVEL']
    };

    /* Sem estas a tela não tem como funcionar. */
    const CAMPOS_OBRIGATORIOS = ['abertura', 'ocorrencia'];

    
   function normalizar(valor) {
       return String(valor ?? '')
           .normalize('NFD')
           .replace(/[\u0300-\u036f]/g, '')
           .toUpperCase()
           .replace(/\s+/g, ' ')
           .trim();
   }


    const chaveCabecalho = (valor) => normalizar(valor).replace(/[^A-Z0-9]/g, '');

    /* Resolve, uma vez por planilha, qual cabeçalho corresponde a cada campo.
       Os nomes de CAMPOS são tentados na ordem em que aparecem (o primeiro é o preferido),
       e não na ordem das colunas da planilha. */
    
      function resolverColunas(cabecalhos) {
          const chaves = cabecalhos.map((c) => ({
              original: c,
              chave: chaveCabecalho(c)
          }));
      
          const mapa = {};
      
          for (const [campo, nomes] of Object.entries(CAMPOS)) {
              const alvos = nomes.map(chaveCabecalho);
              let achado = null;
      
              // Primeiro procura correspondência exata.
              for (const a of alvos) {
                  achado = chaves.find((c) => c.chave === a);
      
                  if (achado) break;
              }
      
              // Evita confundir códigos com descrições.
              if (
                  !achado &&
                  !['assunto', 'grupo', 'ocorrencia', 'tipo'].includes(campo)
              ) {
                  for (const a of alvos) {
                      achado = chaves.find(
                          (c) =>
                              c.chave.length > 4 &&
                              (
                                  c.chave.includes(a) ||
                                  a.includes(c.chave)
                              )
                      );
      
                      if (achado) break;
                  }
              }
      
              mapa[campo] = achado ? achado.original : null;
          }
      
          return mapa;
      }


    /* ======================================================
       2. DATAS
    ====================================================== */

    function dataDeCelula(valor) {
        if (valor === null || valor === undefined || valor === '') return null;

        if (valor instanceof Date && !isNaN(valor)) {
            return new Date(valor.getFullYear(), valor.getMonth(), valor.getDate());
        }

        /* número de série do Excel */
        if (typeof valor === 'number' && window.XLSX && XLSX.SSF) {
            const p = XLSX.SSF.parse_date_code(valor);
            return p ? new Date(p.y, p.m - 1, p.d) : null;
        }

        const texto = String(valor).trim();
        let m = texto.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
        if (m) {
            let ano = Number(m[3]);
            if (ano < 100) ano += ano < 50 ? 2000 : 1900;
            const d = new Date(ano, Number(m[2]) - 1, Number(m[1]));
            return isNaN(d) ? null : d;
        }
        m = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));

        if (/^\d+(\.\d+)?$/.test(texto) && window.XLSX && XLSX.SSF) {
            return dataDeCelula(Number(texto));
        }
        return null;
    }

    /* Data como número AAAAMMDD: comparar dias fica simples e rápido. */
    const chaveDia = (d) => (d ? d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate() : 0);

    const doisDigitos = (n) => String(n).padStart(2, '0');
    const formatarData = (d) => (d ? `${doisDigitos(d.getDate())}/${doisDigitos(d.getMonth() + 1)}/${d.getFullYear()}` : '—');
    const formatarDataCurta = (d) => (d ? `${doisDigitos(d.getDate())}/${doisDigitos(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}` : '');
    const paraInput = (d) => (d ? `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}` : '');
    const deInput = (texto) => (texto ? dataDeCelula(texto) : null);

    const DIA_MS = 86400000;

    /* Dias úteis entre duas datas: conta de segunda a sexta, a partir do dia
       seguinte à abertura até o fim (inclusive). Feriados não entram (seção 8
       do CLAUDE.md). Mesmo resultado do laço dia a dia, mas sem laço. */
    function diasUteisEntre(inicio, fim) {
        if (!inicio || !fim) return 0;
        const total = Math.round((Date.UTC(fim.getFullYear(), fim.getMonth(), fim.getDate()) -
            Date.UTC(inicio.getFullYear(), inicio.getMonth(), inicio.getDate())) / DIA_MS);
        if (total <= 0) return 0;

        let uteis = Math.floor(total / 7) * 5;
        let diaSemana = inicio.getDay();
        for (let i = 0; i < total % 7; i++) {
            diaSemana = (diaSemana + 1) % 7;
            if (diaSemana !== 0 && diaSemana !== 6) uteis++;
        }
        return uteis;
    }

    /* RN 623: em atraso > 5 dias úteis; atenção 4 a 5; em dia < 4. */
    function prazoRN623(dias) {
        if (dias > 5) return 'atraso';
        if (dias >= 4) return 'atencao';
        return 'ok';
    }

    const ROTULO_PRAZO = { ok: 'Em dia', atencao: 'Atenção', atraso: 'Em atraso', sem: 'Sem data' };
    const PESO_PRAZO = { atraso: 3, atencao: 2, ok: 1, sem: 0 };

    /* ======================================================
       3. CLASSIFICAÇÃO DOS SETORES
       A planilha não traz o setor: ele sai da combinação
       assunto + grupo + ocorrência. Os valores seguem a planilha
       original do CRM exatamente como ela vem (não trocar nomes).
       Vale a primeira regra que bater, na ordem abaixo.
    ====================================================== */

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
            assuntos: ['INFORMACOES SOBRE REEMBOLSO', 'PORTAL - SAUDE'],
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
    ].map((r) => ({ setor: r.setor, assuntos: new Set(r.assuntos), grupos: new Set(r.grupos), subgrupos: new Set(r.subgrupos) }));

    /* Complemento aprovado pelo autor em 03/11/2026: combinações exatas
       (assunto | grupo | ocorrência) que as regras acima não cobriam.
       Ocorrência ou grupo vazio na planilha = ''. */
    const COMPLEMENTO_SETORES = {
        FINANCEIRO: [
            ['FINANCEIRO/2 VIA DE BOLETO', 'BOLETO', '2 VIA DE BOLETO'],
            ['FINANCEIRO', 'BOLETO', '2 VIA DE BOLETO'],
            ['FINANCEIRO', 'BOLETO', 'BOLETO/PIX'],
            ['FINANCEIRO/2 VIA DE BOLETO', 'BOLETO', 'BOLETO/PIX'],
            ['FINANCEIRO', 'BOLETO', 'COMPROVANTE DE PAGAMENTO'],
            ['FINANCEIRO', 'DIVERGENCIA DE VALORES', 'DIVERGENCIA DE VALORES'],
            ['FINANCEIRO/2 VIA DE BOLETO', 'DIVERGENCIA DE VALORES', 'DIVERGENCIA DE VALORES'],
            ['FINANCEIRO/2 VIA DE BOLETO', 'DIVERGENCIA DE VALORES', ''],
            ['FINANCEIRO', 'VALORES DOS PLANOS', 'MENSALIDADE'],
            ['FINANCEIRO', 'VALORES DOS PLANOS', 'COPARTICIPACAO'],
            ['FINANCEIRO', 'VALORES DOS PLANOS', 'PER CAPITA / SUBSIDIO'],
            ['FINANCEIRO', 'DEBITO EM CONTA', 'DEBITO/INFORMACOES'],
            ['FINANCEIRO', 'DEBITO EM CONTA', 'INCLUSAO DE DEBITO - CAIXA'],
            ['FINANCEIRO', 'IMPOSTO DE RENDA', 'EMISSAO DE DECLARACAO'],
            ['FINANCEIRO', '', 'ALTERAR DE FORMA DE PAGAMENTO'],
            ['FATURAMENTO', 'FATURAMENTO', 'ORIENTACOES OPERACIONAIS'],
            ['FATURAMENTO', 'FATURAMENTO', 'FATURAMENTO - ERRO FFP OU XML'],
            ['FATURAMENTO', 'FATURAMENTO', 'RECURSO DE GLOSA - ORIENTACOES'],
            ['FATURAMENTO', 'FATURAMENTO', '']
        ],
        AUDITORIA: [
            ['INFORMACAO SOBRE AUTORIZACAO MEDICA', 'COBERTURA ASSISTENCIAL', 'PROGRAMA DE ATENCAO DOMICILIAR'],
            ['AUTORIZACAO MEDICA', 'AUTORIZACAO DE PROCEDIMENTOS', 'NEGATIVA EM GUIAS'],
            ['AUTORIZACAO MEDICA', 'AUTORIZACAO DE PROCEDIMENTOS', 'AUTORIZACAO/ COMPLEMENTO DE TRATAMENTO'],
            ['AUTORIZACAO MEDICA', 'AUTORIZACAO DE PROCEDIMENTOS', 'INSTABILIDADE SISTEMICA FACIL - CONTINGENCIA'],
            ['AUTORIZACAO MEDICA', 'AUTORIZACAO DE PROCEDIMENTOS', 'REVALIDACAO DAS GUIAS AUTORIZADAS'],
            ['AUTORIZACAO MEDICA', 'LANCAMENTO DE GUIAS', ''],
            ['PROGRAMAS DE SAUDE', 'PROGRAMA DE ATENCAO DOMICILIAR - PAD', 'AVALIACAO DE ELEGIBILIDADE'],
            ['PROGRAMAS DE SAUDE', 'PROGRAMA DE ATENCAO DOMICILIAR - PAD', 'READEQUACAO DO PLANO TERAPEUTICO'],
            ['PROGRAMAS DE SAUDE', 'PROGRAMA DE ATENCAO DOMICILIAR - PAD', 'FAVORAVEL'],
            ['PROGRAMAS DE SAUDE', 'PROGRAMA DE ATENCAO DOMICILIAR - PAD', 'READMISSAO PAD']
        ],
        CADASTRO: [
            ['INFORMACAO SOBRE ADESAO A SAUDE', 'ADESAO / ORIENTACOES', 'ADESAO / ORIENTACOES'],
            ['INFORMACAO SOBRE ADESAO A SAUDE', 'PATROCINADORAS', 'CONTATO COM O PATROCINADOR'],
            ['PORTAL - SAUDE', 'ATUALIZACAO CADASTRAL', 'ATUALIZACAO CADASTRAL'],
            ['ADESAO A SAUDE', 'MUDANCA DE ORGAO', ''],
            ['ADESAO A SAUDE', 'INCLUSAO DE DEPENDENTES/AGREGADO', ''],
            ['ADESAO A SAUDE', 'PORTABILIDADE', ''],
            ['ADESAO AO SOCIAL', 'SOLICITAR ADESAO', ''],
            ['INFORMACAO SOBRE ADESAO AO SOCIAL', 'DOCUMENTOS PARA ADESAO', '']
        ],
        CREDENCIAMENTO: [
            ['REDE CREDENCIADA', 'ORIENTACOES DIVERSAS', 'ORIENTACOES DIVERSAS'],
            ['REDE CREDENCIADA', 'TELESAUDE', 'CONEXA']
        ],
        SOCIAL: [
            ['REDE DE VANTAGENS', 'ASSISTENCIA FUNERAL', 'ASSISTENCIA FUNERAL'],
            ['REDE DE VANTAGENS', 'SOCIAL PELO PAIS', 'SOCIAL PELO PAIS'],
            ['DEMAIS INFORMACOES', 'ESPACO VIVA SAUDE', ''],
            ['DEMAIS INFORMACOES SOCIAL', 'OUTROS SERVICOS SOCIAL', '']
        ],
        OUTROS: [
            ['DEMAIS INFORMACOES', 'EXAMES MEDICOS PERIODICOS', 'EXAMES MEDICOS PERIODICOS'],
            ['DEMAIS INFORMACOES', 'APP ASSEFAZ', 'FUNCIONALIDADES'],
            ['INFORMACOES SOBRE REEMBOLSO', '', ''],
            ['DEMAIS INFORMACOES', '', '']
        ]
    };

    const MAPA_COMPLEMENTO = new Map();
    for (const [setor, combinacoes] of Object.entries(COMPLEMENTO_SETORES)) {
        for (const [a, g, o] of combinacoes) MAPA_COMPLEMENTO.set(`${a}|${g}|${o}`, setor);
    }

    const NAO_CLASSIFICADO = 'NÃO CLASSIFICADO';

    function classificarSetor(assunto, grupo, ocorrencia, setorDaPlanilha) {
        for (const regra of REGRAS_SETORES) {
            if (regra.assuntos.has(assunto) && regra.grupos.has(grupo) && regra.subgrupos.has(ocorrencia)) {
                return regra.setor;
            }
        }
        return MAPA_COMPLEMENTO.get(`${assunto}|${grupo}|${ocorrencia}`) ||
            normalizar(setorDaPlanilha) || NAO_CLASSIFICADO;
    }

    /* Nomes para a tela: "REEMBOLSO" → "Reembolso". */
    function nomeBonito(texto) {
        const t = String(texto || '').trim().toLowerCase();
        return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
    }

    const ROTULO_TIPO = {
        'SOLICITACAO': 'Solicitação',
        'INFORMACAO': 'Informação',
        'RECLAMACAO': 'Reclamação',
        'REANALISE': 'Reanálise',
        'SUGESTAO': 'Sugestão',
        'ELOGIO': 'Elogio',
        'SOLICITACAO DE GRAVACAO': 'Gravação'
    };

    const rotuloTipo = (tipoNorm) => ROTULO_TIPO[tipoNorm] || nomeBonito(tipoNorm);

    /* Canal de comunicação (DESC_COMUNICACAO): nomes curtos para os botões. */
    const ROTULO_CANAL = {
        'PORTAL': 'Portal',
        'VOZ': 'Voz',
        'PRESENCIAL': 'Presencial',
        'WHATSAPP': 'WhatsApp',
        'E-MAIL INSTITUCIONAL': 'E-mail',
        'E-MAIL': 'E-mail',
        'CHAT': 'Chat',
        'RECLAME AQUI': 'Reclame Aqui',
        'CALLBACK': 'Callback',
        'OUVIDORIA': 'Ouvidoria'
    };

    const rotuloCanal = (canalNorm) => ROTULO_CANAL[canalNorm] || nomeBonito(canalNorm);

    /* ======================================================
       4. PREPARAÇÃO DOS REGISTROS (uma vez, na importação)
    ====================================================== */

    const texto = (v) => String(v ?? '').trim();

    function formatarCPF(valor) {
        const digitos = texto(valor).replace(/\D/g, '');
        if (!digitos) return '';
        const d = digitos.padStart(11, '0').slice(-11);
        return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
    }

    function prepararRegistros(linhas, colunas, hoje) {
        const pegar = (linha, campo) => (colunas[campo] ? linha[colunas[campo]] : '');
        const registros = [];

        for (const linha of linhas) {
            const abertura = dataDeCelula(pegar(linha, 'abertura'));
            const encerramento = dataDeCelula(pegar(linha, 'encerramento'));
            const statusNorm = normalizar(pegar(linha, 'status'));
            const ocorrencia = texto(pegar(linha, 'ocorrencia'));
            const tipoNorm = normalizar(pegar(linha, 'tipo'));
            const canalNorm = normalizar(pegar(linha, 'canal'));

            /* linha totalmente vazia (rodapé de planilha, por exemplo) */
            if (!abertura && !ocorrencia && !texto(pegar(linha, 'protocolo'))) continue;

            /* Pendente = STATUS_OCORRENCIA "Pendente". Sem essa coluna: sem data de encerramento. */
            const pendente = colunas.status ? statusNorm.includes('PENDENTE') : !encerramento;

            /* RN 623: pendente conta até hoje; encerrado, até o encerramento. */
            const fim = pendente ? hoje : (encerramento || hoje);
            const dias = abertura ? diasUteisEntre(abertura, fim) : 0;
            const prazo = abertura ? prazoRN623(dias) : 'sem';

            const setor = classificarSetor(
                normalizar(pegar(linha, 'assunto')),
                normalizar(pegar(linha, 'grupo')),
                normalizar(ocorrencia),
                pegar(linha, 'setor')
            );

            const protocolo = texto(pegar(linha, 'protocolo'));
            const cpf = formatarCPF(pegar(linha, 'cpf'));
            const nome = texto(pegar(linha, 'nome'));
            const email = texto(pegar(linha, 'email')).toLowerCase();

            registros.push({
                protocolo,
                cpf,
                nome,
                email,
                setor,
                ocorrencia,
                ocorrenciaNorm: normalizar(ocorrencia),
                tipoNorm,
                canalNorm,
                abertura,
                chaveAbertura: chaveDia(abertura),
                encerramento,
                chaveEncerramento: chaveDia(encerramento),
                previsao: dataDeCelula(pegar(linha, 'previsao')),
                pendente,
                dias,
                prazo,
                observacao: texto(pegar(linha, 'observacao')),
                busca: `${protocolo} ${cpf.replace(/\D/g, '')} ${email}`.toLowerCase()
            });
        }
        return registros;
    }

    /* ======================================================
       5. ESTADO
    ====================================================== */

    const estado = {
        base: [],
        nomeArquivo: '',
        hoje: null,
        filtros: { de: null, ate: null, setor: '', ocorrencias: new Set(), canais: new Set(), situacao: '' },
        busca: '',
        ordem: { campo: 'abertura', direcao: -1 },
        pagina: 0,
        linhasPorPagina: 10,
        filtrados: [],
        tabela: []
    };

    const numeroBR = (n) => Number(n || 0).toLocaleString('pt-BR');

    function dataHoje() {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }

    /* ======================================================
       6. FILTROS
    ====================================================== */

    /* Setor, ocorrência e tipo. */
    function passaCategorias(r) {
        const f = estado.filtros;
        if (f.setor && r.setor !== f.setor) return false;
        if (f.ocorrencias.size && !f.ocorrencias.has(r.ocorrenciaNorm)) return false;
        if (f.canais.size && !f.canais.has(r.canalNorm)) return false;
        return true;
    }

    /* Situação (STATUS_OCORRENCIA): '' todos, 'pendente' ou 'encerrado'. */
    function passaSituacao(r) {
        const s = estado.filtros.situacao;
        return !s || (s === 'pendente' ? r.pendente : !r.pendente);
    }

    function passaPeriodo(r) {
        const { de, ate } = estado.filtros;
        if (de && (!r.chaveAbertura || r.chaveAbertura < chaveDia(de))) return false;
        if (ate && (!r.chaveAbertura || r.chaveAbertura > chaveDia(ate))) return false;
        return true;
    }

    /* Os cartões "hoje" ignoram o período (que é de abertura), mas seguem os outros filtros. */
    const passaFiltrosSemPeriodo = (r) => passaCategorias(r) && passaSituacao(r);

    function atualizarTudo() {
        /* quantidades dos botões de situação: todos os filtros, menos a própria situação */
        let todos = 0;
        let pendentes = 0;
        estado.filtrados = [];
        for (const r of estado.base) {
            if (!passaCategorias(r) || !passaPeriodo(r)) continue;
            todos++;
            if (r.pendente) pendentes++;
            if (passaSituacao(r)) estado.filtrados.push(r);
        }
        $('qtdTodos').textContent = numeroBR(todos);
        $('qtdPendentes').textContent = numeroBR(pendentes);
        $('qtdEncerrados').textContent = numeroBR(todos - pendentes);
        document.querySelectorAll('#filtroSituacao button').forEach((b) => {
            b.setAttribute('aria-pressed', String(b.dataset.situacao === estado.filtros.situacao));
        });

        estado.pagina = 0;
        desenharIndicadores();
        desenharSetores();
        atualizarTabela();
        desenharResumoFiltros();
    }

    /* ======================================================
       7. INDICADORES
    ====================================================== */

    function desenharIndicadores() {
        const temDados = estado.base.length > 0;
        const chaveHoje = chaveDia(estado.hoje);

        if (!temDados) {
            ['kpiPendentes', 'kpiAbertosHoje', 'kpiEncerradosHoje'].forEach((id) => { $(id).textContent = '—'; });
            return;
        }

        const pendentes = estado.filtrados.filter((r) => r.pendente);
        const emAtraso = pendentes.filter((r) => r.prazo === 'atraso').length;

        let abertosHoje = 0;
        let encerradosHoje = 0;
        for (const r of estado.base) {
            if (!passaFiltrosSemPeriodo(r)) continue;
            if (r.chaveAbertura === chaveHoje) abertosHoje++;
            if (r.chaveEncerramento === chaveHoje) encerradosHoje++;
        }

        $('kpiPendentes').textContent = numeroBR(pendentes.length);
        $('apoioPendentes').textContent = pendentes.length
            ? `${numeroBR(emAtraso)} em atraso (RN 623)`
            : 'nenhum em aberto';
        $('kpiAbertosHoje').textContent = numeroBR(abertosHoje);
        $('kpiEncerradosHoje').textContent = numeroBR(encerradosHoje);
        $('apoioAbertosHoje').textContent = formatarData(estado.hoje);

        /* Saldo do dia: encerrou menos que abriu = vermelho; igual = amarelo; mais = verde. */
        const saldo = encerradosHoje - abertosHoje;
        const cor = saldo < 0 ? 'atraso' : saldo === 0 ? 'atencao' : 'ok';
        const cartao = $('kpiEncerradosHoje').closest('.kpi');
        cartao.classList.remove('saldo-ok', 'saldo-atencao', 'saldo-atraso');
        cartao.classList.add(`saldo-${cor}`);
        $('apoioEncerradosHoje').textContent = saldo === 0
            ? 'igual aos abertos hoje'
            : `${numeroBR(Math.abs(saldo))} ${saldo > 0 ? 'a mais' : 'a menos'} que os abertos`;
    }

    function desenharSetores() {
        const lista = $('setoresLista');
        colunasSetores = [];
        if (!estado.base.length) {
            lista.innerHTML = '<p class="vazio-pequeno">Importe uma planilha para ver os setores.</p>';
            return;
        }

        /* O gráfico segue todos os filtros, inclusive a situação (todos / pendentes / encerrados). */
        const situacao = estado.filtros.situacao;
        $('tituloSetores').textContent = situacao === 'pendente' ? 'Pendentes por setor'
            : situacao === 'encerrado' ? 'Encerrados por setor' : 'Protocolos por setor';

        const porSetor = new Map();
        for (const r of estado.filtrados) {
            const s = porSetor.get(r.setor) || { ok: 0, atencao: 0, atraso: 0, sem: 0, total: 0 };
            s[r.prazo]++;
            s.total++;
            porSetor.set(r.setor, s);
        }

        if (!porSetor.size) {
            lista.innerHTML = '<p class="vazio-pequeno">Nenhum protocolo com esses filtros.</p>';
            return;
        }

        colunasSetores = [...porSetor.entries()].sort((a, b) =>
            (a[0] === NAO_CLASSIFICADO) - (b[0] === NAO_CLASSIFICADO) || b[1].total - a[1].total);
        desenharColunas();
    }

    /* Colunas empilhadas: em dia embaixo, atenção no meio, atraso em cima.
       Cada parte com número precisa de espaço para o rótulo, então tem pelo menos
       ALTURA_MIN_PARTE px; o que sobra da coluna é dividido na proporção dos valores.
       A altura total da coluna segue o total do setor (o maior ocupa a área toda). */
    const ALTURA_MIN_PARTE = 17;
    let colunasSetores = [];

    function desenharColunas() {
        const lista = $('setoresLista');
        if (!colunasSetores.length) return;

        /* área útil = altura da lista menos total em cima, nome embaixo e espaços.
           A lista tem altura fixa no CSS; o teto de 400 px garante que a coluna nunca
           "empurre" a própria área (senão uma faz a outra crescer sem parar). */
        const areaUtil = Math.max(3 * ALTURA_MIN_PARTE, Math.min(lista.clientHeight, 400) - 62);
        const maior = Math.max(...colunasSetores.map(([, s]) => s.total));

        lista.innerHTML = '';
        for (const [setor, s] of colunasSetores) {
            const partes = [['ok', s.ok], ['atencao', s.atencao], ['atraso', s.atraso]].filter(([, n]) => n > 0);
            const minimo = partes.length * ALTURA_MIN_PARTE;
            const alturaColuna = Math.max(minimo, (s.total / maior) * areaUtil);
            const sobra = alturaColuna - minimo;
            const somaPartes = partes.reduce((t, [, n]) => t + n, 0) || 1;

            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'coluna' + (estado.filtros.setor === setor ? ' ativo' : '');
            item.title = `${nomeBonito(setor)}: ${s.ok} em dia, ${s.atencao} em atenção, ${s.atraso} em atraso` +
                (estado.filtros.setor === setor ? ' · clique para remover o filtro' : ' · clique para filtrar');
            item.innerHTML = `
                <span class="coluna-total">${numeroBR(s.total)}</span>
                <span class="coluna-pilha" aria-hidden="true">
                    ${partes.map(([classe, n]) => `<i class="${classe}" style="height:${(ALTURA_MIN_PARTE + sobra * (n / somaPartes)).toFixed(1)}px">${numeroBR(n)}</i>`).join('')}
                </span>
                <span class="coluna-nome">${escapar(nomeBonito(setor))}</span>`;
            item.addEventListener('click', () => {
                estado.filtros.setor = estado.filtros.setor === setor ? '' : setor;
                $('filtroSetor').value = estado.filtros.setor;
                atualizarTudo();
            });
            lista.appendChild(item);
        }
    }

    /* ======================================================
       8. TABELA
    ====================================================== */

    function escapar(t) {
        return String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    const VALOR_ORDEM = {
        protocolo: (r) => r.protocolo,
        cpf: (r) => r.cpf,
        nome: (r) => r.nome,
        email: (r) => r.email,
        setor: (r) => r.setor,
        ocorrencia: (r) => r.ocorrenciaNorm,
        abertura: (r) => r.chaveAbertura,
        previsao: (r) => chaveDia(r.previsao),
        prazo: (r) => PESO_PRAZO[r.prazo] * 100000 + r.dias
    };

    function atualizarTabela() {
        const termo = estado.busca.trim().toLowerCase();
        /* busca só com números (ex.: CPF com pontos): compara apenas os dígitos */
        const soNumeros = /^[\d.\-\s/]+$/.test(termo);
        const termoDigitos = soNumeros ? termo.replace(/\D/g, '') : '';
        let linhas = estado.filtrados;
        if (termo) {
            linhas = linhas.filter((r) => r.busca.includes(termo) || (termoDigitos.length >= 3 && r.busca.includes(termoDigitos)));
        }


        const { campo, direcao } = estado.ordem;
        const valor = VALOR_ORDEM[campo];
        estado.tabela = [...linhas].sort((a, b) => {
            const va = valor(a);
            const vb = valor(b);
            if (va < vb) return -direcao;
            if (va > vb) return direcao;
            return 0;
        });

        $('contadorTabela').textContent = numeroBR(estado.tabela.length);
        $('exportarExcel').disabled = estado.tabela.length === 0;
        desenharPagina();
    }

    function celula(rotulo, conteudo, classe = '') {
        return `<td data-rotulo="${rotulo}"${classe ? ` class="${classe}"` : ''}>${conteudo}</td>`;
    }

    function desenharPagina() {
        const corpo = $('corpoTabela');
        const total = estado.tabela.length;
        const porPagina = estado.linhasPorPagina;
        const paginas = Math.max(1, Math.ceil(total / porPagina));
        estado.pagina = Math.min(estado.pagina, paginas - 1);
        const inicio = estado.pagina * porPagina;
        const pagina = estado.tabela.slice(inicio, inicio + porPagina);

        corpo.innerHTML = pagina.map((r, i) => `
            <tr>
                ${celula('Protocolo', escapar(r.protocolo) || '<span class="fraco">—</span>', 'mono')}
                ${celula('CPF', escapar(r.cpf) || '<span class="fraco">—</span>', 'mono')}
                ${celula('Beneficiário', escapar(r.nome) || '<span class="fraco">—</span>')}
                ${celula('E-mail', r.email ? `<span title="${escapar(r.email)}">${escapar(r.email)}</span>` : '<span class="fraco">—</span>')}
                ${celula('Setor', `<span class="etiqueta-setor" title="${escapar(nomeBonito(r.setor))}">${escapar(nomeBonito(r.setor))}</span>`)}
                ${celula('Ocorrência', r.ocorrencia ? `<span title="${escapar(r.ocorrencia)}">${escapar(nomeBonito(r.ocorrencia))}</span>` : '<span class="fraco">—</span>')}
                ${celula('Abertura', formatarData(r.abertura))}
                ${celula('Previsão', r.previsao ? formatarData(r.previsao) : '<span class="fraco">—</span>')}
                ${celula('Status', `<span class="status ${r.prazo}" title="${r.dias} dia(s) útil(eis)${r.pendente ? ', pendente' : ', encerrado'}">${ROTULO_PRAZO[r.prazo]}</span>`)}
                ${celula('Observação', r.observacao
                    ? `<button type="button" class="obs" data-indice="${inicio + i}" title="Ver observação completa">${escapar(r.observacao)}</button>`
                    : '<span class="fraco">—</span>')}
            </tr>`).join('');

        const vazio = $('vazio');
        if (!estado.base.length) {
            vazio.hidden = false;
            $('vazioTitulo').textContent = 'Nenhuma planilha carregada';
            $('vazioTexto').innerHTML = 'Clique em <b>Importar planilha</b> ou arraste o arquivo (.xlsx, .xls ou .csv) para esta janela.';
        } else if (!total) {
            vazio.hidden = false;
            $('vazioTitulo').textContent = 'Nenhum protocolo encontrado';
            $('vazioTexto').textContent = 'Nenhum protocolo passa nos filtros e na busca atuais.';
        } else {
            vazio.hidden = true;
        }

        $('infoPagina').textContent = total
            ? `${numeroBR(inicio + 1)}–${numeroBR(Math.min(inicio + porPagina, total))} de ${numeroBR(total)}`
            : '—';
        $('numeroPagina').textContent = total ? `${estado.pagina + 1} de ${numeroBR(paginas)}` : '—';
        $('paginaAnterior').disabled = estado.pagina === 0;
        $('proximaPagina').disabled = estado.pagina >= paginas - 1;

        document.querySelectorAll('.tabela th[data-ordem]').forEach((th) => {
            if (th.dataset.ordem === estado.ordem.campo) {
                th.setAttribute('aria-sort', estado.ordem.direcao > 0 ? 'ascending' : 'descending');
            } else {
                th.removeAttribute('aria-sort');
            }
        });
    }

    /* Quantas linhas cabem na tabela sem rolar (no celular: 10 por página).
       ALTURA_LINHA precisa bater com a altura do td no CSS. */
    const ALTURA_LINHA = 34;
    const ehCelular = () => window.matchMedia('(max-width: 1023px)').matches;

    function calcularLinhasPorPagina() {
        let linhas = 10;
        if (!ehCelular()) {
            const area = $('tabelaArea');
            const cabecalho = area.querySelector('thead');
            const disponivel = area.clientHeight - (cabecalho ? cabecalho.offsetHeight : 36);
            linhas = Math.max(3, Math.floor(disponivel / ALTURA_LINHA));
        }
        if (linhas !== estado.linhasPorPagina) {
            /* mantém o primeiro registro visível ao mudar o tamanho */
            const primeiro = estado.pagina * estado.linhasPorPagina;
            estado.linhasPorPagina = linhas;
            estado.pagina = Math.floor(primeiro / linhas);
            desenharPagina();
        }
    }

    function abrirDetalhe(indice) {
        const r = estado.tabela[indice];
        if (!r) return;
        $('detalheProtocolo').textContent = r.protocolo || '—';
        const dados = [
            ['Setor', nomeBonito(r.setor)],
            ['Ocorrência', r.ocorrencia || '—'],
            ['Tipo', rotuloTipo(r.tipoNorm) || '—'],
            ['Canal', r.canalNorm ? nomeBonito(r.canalNorm) : '—'],
            ['Status (RN 623)', `${ROTULO_PRAZO[r.prazo]} · ${r.dias} dia(s) útil(eis)`],
            ['Abertura', formatarData(r.abertura)],
            ['Previsão', formatarData(r.previsao)],
            ['CPF', r.cpf || '—'],
            ['E-mail', r.email || '—']
        ];
        $('detalheDados').innerHTML = dados.map(([t, v]) => `<div><dt>${t}</dt><dd>${escapar(v)}</dd></div>`).join('');
        $('detalheObs').textContent = r.observacao || '—';
        $('detalhe').showModal();
    }

    /* ======================================================
       9. EXPORTAÇÃO PARA EXCEL
       Exporta todos os protocolos da tabela (filtros + busca), não só a página.
    ====================================================== */

    
      function exportarExcel() {
          if (!window.XLSX || !estado.tabela.length) return;
      
          const cabecalho = [
              'Protocolo',
              'CPF',
              'Nome do Beneficiário',
              'E-mail',
              'Setor',
              'Descrição da ocorrência',
              'Data de abertura',
              'Data de previsão',
              'Status (RN 623)',
              'Observação de abertura'
          ];
      
          const linhas = estado.tabela.map((r) => [
              r.protocolo,
              r.cpf,
              r.nome || '',
              r.email,
              nomeBonito(r.setor),
              r.ocorrencia,
              r.abertura || '',
              r.previsao || '',
              ROTULO_PRAZO[r.prazo],
              r.observacao
          ]);
      
          const planilha = XLSX.utils.aoa_to_sheet(
              [cabecalho, ...linhas],
              { dateNF: 'dd/mm/yyyy' }
          );
      
          planilha['!cols'] = [
              { wch: 24 },
              { wch: 16 },
              { wch: 38 },
              { wch: 30 },
              { wch: 18 },
              { wch: 40 },
              { wch: 14 },
              { wch: 14 },
              { wch: 16 },
              { wch: 80 }
          ];
      
          planilha['!autofilter'] = {
              ref: planilha['!ref']
          };
      
          const livro = XLSX.utils.book_new();
      
          XLSX.utils.book_append_sheet(
              livro,
              planilha,
              'Protocolos'
          );
      
          XLSX.writeFile(
              livro,
              `protocolos-inteligencia-de-rede-${paraInput(estado.hoje)}.xlsx`,
              { compression: true }
          );
      
          avisar(`${numeroBR(linhas.length)} protocolos exportados.`);
      }


    /* ======================================================
       10. CONTROLES DOS FILTROS
    ====================================================== */

    function montarFiltros() {
        /* Setor */
        const setores = [...new Set(estado.base.map((r) => r.setor))]
            .sort((a, b) => (a === NAO_CLASSIFICADO) - (b === NAO_CLASSIFICADO) || a.localeCompare(b, 'pt-BR'));
        $('filtroSetor').innerHTML = '<option value="">Todos</option>' +
            setores.map((s) => `<option value="${escapar(s)}">${escapar(nomeBonito(s))}</option>`).join('');

        /* Canal de comunicação (botões), do maior volume para o menor */
        const contagemCanais = new Map();
        estado.base.forEach((r) => { if (r.canalNorm) contagemCanais.set(r.canalNorm, (contagemCanais.get(r.canalNorm) || 0) + 1); });
        canaisDisponiveis = [...contagemCanais.entries()].sort((a, b) => b[1] - a[1]);
        $('chipsCanal').innerHTML = canaisDisponiveis.map(([c, n]) =>
            `<button type="button" class="chip" data-canal="${escapar(c)}" aria-pressed="false" title="${escapar(nomeBonito(c))} · ${numeroBR(n)}">${escapar(rotuloCanal(c))}</button>`
        ).join('');

        montarListaOcorrencias();
        requestAnimationFrame(ajustarCanais);
    }

    /* Os botões de canal que não cabem na linha dos filtros vão para o "+N".
       Mostra sempre os de maior volume; recalcula ao mudar o tamanho da tela. */
    let canaisDisponiveis = [];
    let canaisOcultos = [];

    function ajustarCanais() {
        const chips = [...$('chipsCanal').children];
        const mais = $('botaoMaisCanais');
        chips.forEach((c) => { c.hidden = false; });
        mais.hidden = true;
        canaisOcultos = [];

        if (chips.length && !ehCelular()) {
            const filtros = $('filtros');
            const grupo = $('grupoCanal');
            const estilo = getComputedStyle(filtros);
            const espaco = parseFloat(estilo.columnGap) || 6;
            const outros = [...filtros.children]
                .filter((e) => e !== grupo && e.offsetParent)
                .reduce((t, e) => t + e.getBoundingClientRect().width + espaco, 0);
            const estiloGrupo = getComputedStyle(grupo);
            const rotulo = grupo.querySelector('.filtro-rotulo').getBoundingClientRect().width +
                (parseFloat(estiloGrupo.columnGap) || 7) + parseFloat(estiloGrupo.paddingLeft || 0);
            const disponivel = filtros.clientWidth - parseFloat(estilo.paddingLeft) - parseFloat(estilo.paddingRight) -
                outros - rotulo - 2;

            const espacoChip = 4;
            const larguras = chips.map((c) => c.getBoundingClientRect().width + espacoChip);
            const total = larguras.reduce((t, l) => t + l, 0);

            if (total > disponivel) {
                mais.hidden = false;
                const reserva = mais.getBoundingClientRect().width + espacoChip + 8;
                let usado = 0;
                chips.forEach((c, i) => {
                    usado += larguras[i];
                    if (usado > disponivel - reserva) {
                        c.hidden = true;
                        canaisOcultos.push(c.dataset.canal);
                    }
                });
            }
        }
        desenharMaisCanais();
    }

    function desenharMaisCanais() {
        const mais = $('botaoMaisCanais');
        const selecionados = canaisOcultos.filter((c) => estado.filtros.canais.has(c)).length;
        mais.textContent = selecionados ? `+${canaisOcultos.length} · ${selecionados}` : `+${canaisOcultos.length}`;
        mais.setAttribute('aria-pressed', String(selecionados > 0));
        mais.title = canaisOcultos.map((c) => nomeBonito(c)).join(', ');

        const contagem = new Map(canaisDisponiveis);
        $('listaMaisCanais').innerHTML = canaisOcultos.map((c) => `
            <label class="opcao">
                <input type="checkbox" value="${escapar(c)}" ${estado.filtros.canais.has(c) ? 'checked' : ''}>
                <span>${escapar(nomeBonito(c))}</span>
                <small>${numeroBR(contagem.get(c) || 0)}</small>
            </label>`).join('');
        if (!canaisOcultos.length) $('popoverCanais').hidden = true;
    }

    let ocorrenciasDisponiveis = [];

    function montarListaOcorrencias() {
        const contagem = new Map();
        for (const r of estado.base) {
            if (!r.ocorrenciaNorm) continue;
            const atual = contagem.get(r.ocorrenciaNorm) || { nome: r.ocorrencia, total: 0 };
            atual.total++;
            contagem.set(r.ocorrenciaNorm, atual);
        }
        ocorrenciasDisponiveis = [...contagem.entries()]
            .map(([chave, v]) => ({ chave, nome: v.nome, total: v.total }))
            .sort((a, b) => b.total - a.total);
        desenharListaOcorrencias();
    }

    function desenharListaOcorrencias() {
        const termo = normalizar($('buscaOcorrencia').value);
        const selecionadas = estado.filtros.ocorrencias;
        const lista = ocorrenciasDisponiveis
            .filter((o) => !termo || o.chave.includes(termo))
            /* as selecionadas aparecem primeiro */
            .sort((a, b) => selecionadas.has(b.chave) - selecionadas.has(a.chave));

        $('listaOcorrencia').innerHTML = lista.length
            ? lista.map((o) => `
                <label class="opcao">
                    <input type="checkbox" value="${escapar(o.chave)}" ${selecionadas.has(o.chave) ? 'checked' : ''}>
                    <span>${escapar(nomeBonito(o.nome))}</span>
                    <small>${numeroBR(o.total)}</small>
                </label>`).join('')
            : '<p class="vazio-pequeno">Nenhuma ocorrência encontrada.</p>';
        $('contaOcorrencia').textContent = `${selecionadas.size} selecionada${selecionadas.size === 1 ? '' : 's'}`;
    }

    function desenharResumoFiltros() {
        const { de, ate, ocorrencias } = estado.filtros;
        $('valorPeriodo').textContent = de || ate
            ? `${de ? formatarDataCurta(de) : 'início'} – ${ate ? formatarDataCurta(ate) : 'hoje'}`
            : 'Todo o período';

        if (!ocorrencias.size) {
            $('valorOcorrencia').textContent = 'Todas';
        } else if (ocorrencias.size === 1) {
            const unica = ocorrenciasDisponiveis.find((o) => ocorrencias.has(o.chave));
            $('valorOcorrencia').textContent = unica ? nomeBonito(unica.nome) : '1 selecionada';
        } else {
            $('valorOcorrencia').textContent = `${ocorrencias.size} selecionadas`;
        }

        document.querySelectorAll('#chipsCanal .chip').forEach((chip) => {
            chip.setAttribute('aria-pressed', String(estado.filtros.canais.has(chip.dataset.canal)));
        });
        $('periodoDe').value = paraInput(de);
        $('periodoAte').value = paraInput(ate);

        /* os textos dos outros filtros mudam de largura: refaz a divisão dos canais */
        if (canaisDisponiveis.length) ajustarCanais();
    }

    /* Caixas suspensas: abre uma de cada vez e fecha ao clicar fora ou com Esc. */
    function ligarPopover(botaoId, popoverId, aoAbrir) {
        const botao = $(botaoId);
        const popover = $(popoverId);
        botao.addEventListener('click', (e) => {
            e.stopPropagation();
            const abrir = popover.hidden;
            fecharPopovers();
            if (abrir) {
                popover.hidden = false;
                botao.setAttribute('aria-expanded', 'true');
                if (aoAbrir) aoAbrir();
            }
        });
        popover.addEventListener('click', (e) => e.stopPropagation());
    }

    function fecharPopovers() {
        document.querySelectorAll('.popover').forEach((p) => { p.hidden = true; });
        document.querySelectorAll('.filtro-botao[aria-expanded], .chip-mais').forEach((b) => b.setAttribute('aria-expanded', 'false'));
    }

    function aplicarAtalho(atalho) {
        const hoje = estado.hoje;
        const menosDias = (n) => new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - n);
        const f = estado.filtros;
        if (atalho === 'hoje') { f.de = hoje; f.ate = hoje; }
        else if (atalho === '7') { f.de = menosDias(6); f.ate = hoje; }
        else if (atalho === '30') { f.de = menosDias(29); f.ate = hoje; }
        else if (atalho === 'mes') { f.de = new Date(hoje.getFullYear(), hoje.getMonth(), 1); f.ate = hoje; }
        else { f.de = null; f.ate = null; }
        atualizarTudo();
    }

    function limparFiltros() {
        estado.filtros = { de: null, ate: null, setor: '', ocorrencias: new Set(), canais: new Set(), situacao: '' };
        estado.busca = '';
        $('buscaTabela').value = '';
        $('filtroSetor').value = '';
        $('buscaOcorrencia').value = '';
        desenharListaOcorrencias();
        atualizarTudo();
    }

    /* ======================================================
       11. IMPORTAÇÃO
    ====================================================== */

    function mostrarCarregando(sim, mensagem) {
        $('carregando').hidden = !sim;
        if (mensagem) $('carregandoTexto').textContent = mensagem;
    }

    let fimAviso = null;
    function avisar(mensagem, erro = false) {
        const aviso = $('avisoFlutuante');
        aviso.textContent = mensagem;
        aviso.classList.toggle('erro', erro);
        aviso.hidden = false;
        clearTimeout(fimAviso);
        fimAviso = setTimeout(() => { aviso.hidden = true; }, erro ? 7000 : 3500);
    }

    function importarArquivo(arquivo) {
        if (!arquivo) return;
        if (!/\.(xlsx|xls|csv)$/i.test(arquivo.name)) {
            avisar('Formato não aceito. Use .xlsx, .xls ou .csv.', true);
            return;
        }
        if (!window.XLSX) {
            avisar('A biblioteca de leitura de Excel não carregou (LIB/xlsx-0.20.3.full.min.js).', true);
            return;
        }

        mostrarCarregando(true, arquivo.name);
        const leitor = new FileReader();
        leitor.onerror = () => { mostrarCarregando(false); avisar('Não foi possível ler o arquivo.', true); };
        leitor.onload = () => {
            /* deixa a tela de "carregando" aparecer antes do trabalho pesado */
            setTimeout(() => {
                try {
                    const livro = XLSX.read(leitor.result, { type: 'array', cellDates: false });
                    const folha = livro.Sheets[livro.SheetNames[0]];
                    const linhas = XLSX.utils.sheet_to_json(folha, { defval: '', raw: true });
                    if (!linhas.length) throw new Error('A planilha está vazia.');

                    const colunas = resolverColunas(Object.keys(linhas[0]));
                    const faltando = CAMPOS_OBRIGATORIOS.filter((c) => !colunas[c]);
                    if (faltando.length) {
                        throw new Error(`Colunas não encontradas: ${faltando.map((c) => CAMPOS[c][0]).join(', ')}.`);
                    }

                    estado.hoje = dataHoje();
                    estado.base = prepararRegistros(linhas, colunas, estado.hoje);
                    estado.nomeArquivo = arquivo.name;
                    estado.filtros = { de: null, ate: null, setor: '', ocorrencias: new Set(), canais: new Set(), situacao: '' };
                    estado.busca = '';
                                $('buscaTabela').value = '';

                    const maisRecente = estado.base.reduce((m, r) => (r.abertura && (!m || r.abertura > m) ? r.abertura : m), null);
                    $('infoBase').innerHTML = `${escapar(arquivo.name)} · <strong>${numeroBR(estado.base.length)}</strong> ocorrências · dados até <strong>${formatarData(maisRecente)}</strong>`;
                    $('chipBase').hidden = false;
                    $('chipBase').title = `Planilha: ${arquivo.name}`;

                    montarFiltros();
                    atualizarTudo();
                    calcularLinhasPorPagina();

                    const semColuna = ['protocolo', 'cpf', 'email', 'status', 'previsao', 'observacao'].filter((c) => !colunas[c]);
                    avisar(semColuna.length
                        ? `Planilha carregada, mas sem as colunas: ${semColuna.map((c) => CAMPOS[c][0]).join(', ')}.`
                        : `${numeroBR(estado.base.length)} ocorrências carregadas.`, semColuna.length > 0);
                } catch (erro) {
                    console.error(erro);
                    avisar(`Erro ao ler a planilha: ${erro.message}`, true);
                } finally {
                    mostrarCarregando(false);
                    $('arquivoExcel').value = '';
                }
            }, 30);
        };
        leitor.readAsArrayBuffer(arquivo);
    }

    /* ======================================================
       12. MENU E TELAS
    ====================================================== */

    const ICONES = {
        painel: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>'
    };

    const telas = [...document.querySelectorAll('.tela')].map((s) => ({
        id: s.dataset.tela,
        titulo: s.dataset.titulo,
        icone: s.dataset.icone,
        secao: s
    }));

    function montarMenu() {
        $('menuNav').innerHTML = telas.map((t) => `
            <a class="menu-item" href="#${t.id}" data-tela="${t.id}" title="${escapar(t.titulo)}">
                ${ICONES[t.icone] || ICONES.painel}
                <span>${escapar(t.titulo)}</span>
            </a>`).join('');
        $('seletorTela').innerHTML = telas.map((t) => `<option value="${t.id}">${escapar(t.titulo)}</option>`).join('');
    }

    function mostrarTela(id) {
        const tela = telas.find((t) => t.id === id) || telas[0];
        telas.forEach((t) => { t.secao.hidden = t !== tela; });
        document.querySelectorAll('.menu-item').forEach((a) => a.classList.toggle('ativo', a.dataset.tela === tela.id));
        $('seletorTela').value = tela.id;
        $('tituloTela').textContent = tela.titulo;
        document.title = `${tela.titulo} · Inteligência de Rede | NEXUS`;
        fecharMenuCelular();
        requestAnimationFrame(calcularLinhasPorPagina);
    }

    function guardar(chave, valor) { try { localStorage.setItem(chave, valor); } catch (e) { /* sem armazenamento */ } }
    function ler(chave) { try { return localStorage.getItem(chave); } catch (e) { return null; } }

    function definirMenuRecolhido(recolher) {
        $('app').classList.toggle('menu-recolhido', recolher);
        $('menuRecolher').setAttribute('aria-expanded', String(!recolher));
        $('menuRecolher').setAttribute('aria-label', recolher ? 'Expandir menu' : 'Recolher menu');
        /* espera a animação da largura do menu para recalcular a tabela */
        setTimeout(() => { calcularLinhasPorPagina(); ajustarCanais(); }, 280);
    }

    function abrirMenuCelular() {
        $('menu').classList.add('aberto');
        $('menuFundo').hidden = false;
        $('abrirMenu').setAttribute('aria-expanded', 'true');
    }

    function fecharMenuCelular() {
        $('menu').classList.remove('aberto');
        $('menuFundo').hidden = true;
        $('abrirMenu').setAttribute('aria-expanded', 'false');
    }

    /* ======================================================
       13. EVENTOS
    ====================================================== */

    function ligarEventos() {
        $('arquivoExcel').addEventListener('change', (e) => importarArquivo(e.target.files[0]));

        /* arrastar e soltar a planilha em qualquer lugar da janela */
        let contadorArraste = 0;
        window.addEventListener('dragenter', (e) => {
            if (![...(e.dataTransfer?.types || [])].includes('Files')) return;
            e.preventDefault();
            contadorArraste++;
            $('soltar').hidden = false;
        });
        window.addEventListener('dragover', (e) => e.preventDefault());
        window.addEventListener('dragleave', () => {
            contadorArraste = Math.max(0, contadorArraste - 1);
            if (!contadorArraste) $('soltar').hidden = true;
        });
        window.addEventListener('drop', (e) => {
            e.preventDefault();
            contadorArraste = 0;
            $('soltar').hidden = true;
            importarArquivo(e.dataTransfer.files[0]);
        });

        /* período */
        ligarPopover('botaoPeriodo', 'popoverPeriodo');
        $('periodoDe').addEventListener('change', (e) => { estado.filtros.de = deInput(e.target.value); atualizarTudo(); });
        $('periodoAte').addEventListener('change', (e) => { estado.filtros.ate = deInput(e.target.value); atualizarTudo(); });
        $('atalhosPeriodo').addEventListener('click', (e) => {
            const b = e.target.closest('[data-atalho]');
            if (!b || !estado.hoje) return;
            aplicarAtalho(b.dataset.atalho);
            fecharPopovers();
        });

        /* setor */
        $('filtroSetor').addEventListener('change', (e) => { estado.filtros.setor = e.target.value; atualizarTudo(); });

        /* ocorrência */
        ligarPopover('botaoOcorrencia', 'popoverOcorrencia', () => $('buscaOcorrencia').focus());
        $('buscaOcorrencia').addEventListener('input', desenharListaOcorrencias);
        $('listaOcorrencia').addEventListener('change', (e) => {
            const caixa = e.target;
            if (caixa.type !== 'checkbox') return;
            if (caixa.checked) estado.filtros.ocorrencias.add(caixa.value);
            else estado.filtros.ocorrencias.delete(caixa.value);
            $('contaOcorrencia').textContent = `${estado.filtros.ocorrencias.size} selecionada${estado.filtros.ocorrencias.size === 1 ? '' : 's'}`;
            atualizarTudo();
        });
        $('limparOcorrencia').addEventListener('click', () => {
            estado.filtros.ocorrencias.clear();
            desenharListaOcorrencias();
            atualizarTudo();
        });

        /* canal de comunicação: botões visíveis e os que estão no "+N" */
        const alternarCanal = (c) => {
            if (estado.filtros.canais.has(c)) estado.filtros.canais.delete(c);
            else estado.filtros.canais.add(c);
            atualizarTudo();
        };
        $('chipsCanal').addEventListener('click', (e) => {
            const chip = e.target.closest('.chip');
            if (chip) alternarCanal(chip.dataset.canal);
        });
        ligarPopover('botaoMaisCanais', 'popoverCanais');
        $('listaMaisCanais').addEventListener('change', (e) => {
            if (e.target.type === 'checkbox') alternarCanal(e.target.value);
        });

        $('limparFiltros').addEventListener('click', limparFiltros);

        document.addEventListener('click', fecharPopovers);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') { fecharPopovers(); fecharMenuCelular(); }
        });

        /* tabela */
        let esperaBusca = null;
        $('buscaTabela').addEventListener('input', (e) => {
            clearTimeout(esperaBusca);
            esperaBusca = setTimeout(() => { estado.busca = e.target.value; estado.pagina = 0; atualizarTabela(); }, 150);
        });
        document.querySelector('.tabela thead').addEventListener('click', (e) => {
            const th = e.target.closest('th[data-ordem]');
            if (!th) return;
            const campo = th.dataset.ordem;
            estado.ordem = {
                campo,
                direcao: estado.ordem.campo === campo ? -estado.ordem.direcao : (campo === 'abertura' || campo === 'prazo' ? -1 : 1)
            };
            estado.pagina = 0;
            atualizarTabela();
        });
        $('corpoTabela').addEventListener('click', (e) => {
            const obs = e.target.closest('.obs');
            if (obs) abrirDetalhe(Number(obs.dataset.indice));
        });
        $('filtroSituacao').addEventListener('click', (e) => {
            const b = e.target.closest('button[data-situacao]');
            if (!b) return;
            estado.filtros.situacao = b.dataset.situacao;
            atualizarTudo();
        });
        $('paginaAnterior').addEventListener('click', () => { estado.pagina--; desenharPagina(); });
        $('proximaPagina').addEventListener('click', () => { estado.pagina++; desenharPagina(); });
        $('exportarExcel').addEventListener('click', exportarExcel);

        $('fecharDetalhe').addEventListener('click', () => $('detalhe').close());
        $('detalhe').addEventListener('click', (e) => { if (e.target === $('detalhe')) $('detalhe').close(); });

        /* menu */
        $('menuRecolher').addEventListener('click', () => {
            const recolher = !$('app').classList.contains('menu-recolhido');
            definirMenuRecolhido(recolher);
            guardar('nexus-menu-recolhido', recolher ? '1' : '0');
        });
        $('abrirMenu').addEventListener('click', abrirMenuCelular);
        $('menuFundo').addEventListener('click', fecharMenuCelular);
        $('seletorTela').addEventListener('change', (e) => { location.hash = e.target.value; });
        window.addEventListener('hashchange', () => mostrarTela(location.hash.slice(1)));

        /* a tabela recalcula quantas linhas cabem sempre que a área muda de tamanho */
        if ('ResizeObserver' in window) {
            new ResizeObserver(() => calcularLinhasPorPagina()).observe($('tabelaArea'));
            /* as colunas dos setores dependem da altura disponível */
            let alturaSetores = 0;
            new ResizeObserver(() => {
                const h = $('setoresLista').clientHeight;
                if (h !== alturaSetores) { alturaSetores = h; desenharColunas(); }
            }).observe($('setoresLista'));
        }
        /* reforço: também ao redimensionar a janela (o ResizeObserver fica pausado
           quando a aba está em segundo plano) */
        let esperaRedimensionar = null;
        window.addEventListener('resize', () => {
            clearTimeout(esperaRedimensionar);
            esperaRedimensionar = setTimeout(() => { calcularLinhasPorPagina(); desenharColunas(); ajustarCanais(); }, 120);
        });
    }

    /* ======================================================
       14. INÍCIO
    ====================================================== */

    function iniciar() {
        estado.hoje = dataHoje();
        $('infoHoje').textContent = formatarData(estado.hoje);

        montarMenu();
        const preferencia = ler('nexus-menu-recolhido');
        definirMenuRecolhido(preferencia === null ? window.innerWidth < 1600 : preferencia === '1');

        ligarEventos();
        mostrarTela(location.hash.slice(1));
        atualizarTudo();
        calcularLinhasPorPagina();
        /* libera as animações depois do primeiro desenho */
        setTimeout(() => $('app').classList.remove('sem-transicao'), 150);
    }

    iniciar();
})();
