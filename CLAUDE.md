# CLAUDE.md — Projeto NEXUS (Inteligência de Dados)

> Arquivo de instruções e contexto para o Claude Code. Ele é lido automaticamente ao abrir esta pasta.
> Versão 10 · 05/11/2026. Itens marcados com ⚠️ estão **pendentes** e precisam de definição.

## 1. Objetivo
Site chamado **NEXUS (Inteligência de Dados)**, uma **peça de portfólio própria** do autor. **Não tem ligação com nenhuma empresa**: o site não se apresenta como sendo de uma empresa (nada de ASSEFAZ na marca, títulos ou textos sobre o projeto). Mas o código **sempre lê a planilha original como ela vem**: nomes de colunas e valores (ex.: "PROGRAMA DE IMUNIZACAO ASSEFAZ" nas regras de setor) não devem ser trocados. Tem uma tela de login e uma página por setor de uma operadora de saúde fictícia. Cada página tem indicadores já programados, que se preenchem quando o usuário importa uma planilha Excel ou CSV na própria página.

## 2. Arquitetura (regras fixas)
- **Sem banco de dados** (nada de SQL, MySQL etc.) e **sem servidor**.
- **HTML, CSS e JavaScript puros**, sem framework e sem build. O site deve abrir direto no navegador.
- **Os dados ficam só no navegador.** A planilha é processada localmente e some quando a página é fechada. Nada é enviado nem salvo. Isso importa porque há dados pessoais de beneficiários (nome, CPF, e-mail).
- **Bibliotecas offline:** SheetJS (leitura e exportação de Excel) e Chart.js (gráficos) devem ficar dentro do projeto, sem depender de CDN. Hoje ainda carregam do jsDelivr, e isso precisa ser corrigido.
- **Responsivo:** deve funcionar bem no celular.
- **Código, nomes e comentários em português.**
- Como é uma peça de portfólio, nenhum dado real de beneficiários deve ir para o repositório público do GitHub, nem mesmo planilhas de exemplo reais.

## 3. Estrutura do repositório
Repositório: `CaduAnalista/Projeto_dashb`

```
index.html            → redireciona para o login
HTML/   login.html, cad-cap.html, inteligencia.html, saude-social.html
CSS/    login.css, cad-cap.css, inteligencia.css, saude-social.css
JAVA/   login.js, cad-cap.js, inteligencia.js, saude-social.js
        nexus.js       → personagem animado (camadas, olhar, piscadas, expressões)
        fundo-rede.js  → fundo animado do login (rede de pontos; vira "dobra espacial" no portal)
        portal-fumaca.js → fumaça da transição de portal (canvas em meia resolução)
        portal-chegada.js → fim da transição de portal, incluído no <head> das páginas de destino
        som-portal.js  → som da transição de portal, gerado na hora (Web Audio API, sem arquivo de áudio)
ASSETS/ imagens
        optmus-*.png / .webp   → mascote antiga (a remover)
        nexus-completo.png     → NEXUS com olhos (referência oficial)
        nexus-olhos-vazios.png → NEXUS com olhos vazios (fonte das camadas)
        nexus-corpo.png        → camada do corpo (1105 × 1064: cortada onde o esmaecimento termina; miolo da cabeça encolhido 40 px, fica escondido)
        nexus-cabeca.png       → camada da cabeça (recorte x 316, y 0, 464 × 533)
        nexus-icone-512.png / nexus-icone-64.png → ícone da cabeça (logo e favicon)
LIB/    xlsx-0.20.3.full.min.js + xlsx-LICENSE.txt → SheetJS oficial, versão fixa, dentro do projeto (offline)
EXEMPLOS/ crm-ficticio-inteligencia-de-rede.xlsx → 14.000 linhas FICTÍCIAS no formato do CRM (para testar e para o portfólio;
        só as categorias vêm da planilha real, sem nada com o nome da empresa)
ARQUIVO/inteligencia-v1/ → cópia da página Inteligência de Rede antes da reformulação (03/11/2026); pode ser apagada quando não servir mais
nexus-personagem.js    → protótipo antigo da versão SVG rejeitada (já substituído por JAVA/nexus.js; pode ser apagado)
.claude/launch.json    → servidor local só para testes no painel de navegador do Claude (o site não depende dele)
```

## 4. Login
- Nível de segurança: **protótipo interno**. A validação é só visual, no navegador, e isso é aceito.
- O usuário informa **nome**, **painel** e **e-mail**. A lista de autorizados fica em `USUARIOS_AUTORIZADOS` no `login.js` (nome, e-mail e painéis permitidos).
- Painéis no seletor (e em `PAGINAS_POR_PAINEL`): Inteligência de Rede → `inteligencia.html`, Relacionamento → `cad-cap.html`, **Saúde e Social → `saude-social.html`** (adicionado pelo autor em 05/11/2026).
- Hoje há só o usuário de demonstração do portfólio: nome `Visitante`, e-mail `visitante@nexus.dev`, com os três painéis. O botão "Usar acesso de demonstração" preenche os campos.
- O acesso só é liberado se nome, e-mail e painel baterem com a lista. Depois disso, o usuário é redirecionado para a página do setor.
- As páginas ainda abrem quando o endereço é digitado direto, sem passar pelo login. Isso foi aceito por ora.
- Layout (reformulado em 03/11/2026): NEXUS à esquerda com balão de fala, aros holográficos e núcleo do peito pulsando; cartão de login à direita; fundo com rede de pontos e piso em grade. No celular, o balão fica ao lado da cabeça ampliada e o formulário vem embaixo.
- Reações: olha para o campo em foco e comenta; "Prazer, {nome}!" ao preencher o nome; "feliz" ao clicar nele.
- **Login recusado:** modo alerta por **2 s** (classe `alerta` no `<html>`). A paleta inteira troca para vermelho com transição (as cores são registradas com `@property`), a rede do fundo acompanha, o NEXUS fica em tons de vermelho (filtro SVG `#filtroAlerta`, no `login.html`), a cabeça balança e o cartão treme. Depois tudo volta ao normal.
- **Login aceito:** expressão "pronto" (olhos abertos, olhando para a tela) e, em seguida, a **transição de portal — "mudança de realidade"** (**2,8 s**, `DURACAO_PORTAL` no `login.js`; refeita a pedido do autor em 05/11/2026 para ficar mais fluida e esfumaçada, e alongada de 2,2 s para 2,8 s para o som caber inteiro):
  - 0 → 2,4 s: a cena se desfaz em desfoque, clareia e cresce um pouco (`@keyframes desfazer`).
  - 0 → 2,8 s: uma nebulosa de fumaça ciano/azul/violeta nasce no centro, gira em espiral e toma a tela (`portal-fumaca.js`, fios de fumaça esticados na direção do giro, pouco branco para não estourar). O fundo entra em dobra espacial, agora acelerando aos poucos e com rastros mais longos (`fundo-rede.js`).
  - 1,8 → 2,7 s: uma **névoa clara** (quase branca no centro, ciano nas bordas) cobre tudo e a página abre.
  - Na página de destino, o `portal-chegada.js` mostra a mesma névoa e a dissolve em ~1,3 s, enquanto o desfoque da página some (a nova realidade "entra em foco"). Aviso via `sessionStorage`. O anel de energia e o clarão antigos foram removidos.
  - Com `prefers-reduced-motion`, só escurece e troca de página.
  - A névoa da chegada começa a sumir no primeiro quadro depois do `DOMContentLoaded`, ou após 120 ms se o navegador atrasar os quadros (assim ela nunca fica presa).
  - ⚠️ A névoa da chegada só começa a sumir no `DOMContentLoaded`. Na Saúde e Social, que carrega bibliotecas de CDN no fim do `<body>`, ela pode durar mais com internet lenta.
- **Som do portal** (`som-portal.js`, refeito em 05/11/2026 para soar espacial e suave, sem estalos): tudo passa por um **reverb gerado no código** e é espalhado no estéreo. É **um só som, fluido, que sobe e desce sem pausa e termina todo no login** (decisão do autor, 05/11/2026). Um acorde de fundo (lá, mi, si, mi) cresce até 1,4 s com o filtro abrindo e depois fechando; o "ar" (ruído filtrado) passa da esquerda para a direita e volta ao centro; um grave macio cresce por baixo entre 0,8 e 1,4 s; cinco brilhos agudos entram entre 1,0 e 2,1 s. **O volume chega ao máximo em 1,4 s e desce numa curva só até o silêncio em 2,75 s** (`setValueCurveAtTime` no ganho geral), junto com a névoa cobrindo a tela; a página troca em 2,8 s.
  - ⚠️ **Não tentar continuar o som na página de destino.** O navegador corta todo áudio ao trocar de página e a página nova só abre depois de uma pausa; uma versão que continuava o som lá foi testada e rejeitada pelo autor ("dá uma parada e depois volta"). A página de destino revela em silêncio.
  - ⚠️ Em `AudioParam`, não marcar um valor no mesmo instante em que uma `setValueCurveAtTime` termina: o navegador dá erro. Um erro desses travou o login uma vez; por isso o `tocar()` fica dentro de `try` no `login.js` (o som nunca pode impedir a entrada). O áudio é liberado (`SomPortal.preparar()`) dentro do clique/Enter, porque o navegador só toca som depois de um gesto do usuário. Não toca com `prefers-reduced-motion`.
- ✅ **Login aprovado pelo autor como final (03/11/2026).** Não mudar visual nem comportamento sem pedir.
- ⏭️ Em 05/11/2026 o autor pediu **novas melhorias no login** (a definir por ele). Só mexer no que ele pedir.

### Desempenho no celular (revisado em 03/11/2026, sem mudar o visual)
- `nexus.js`: guarda as posições na tela (só remede ao rolar, redimensionar, trocar o alvo ou a cada 0,5 s), só escreve no SVG quando o valor muda, para de desenhar quando o personagem sai da tela (IntersectionObserver) e põe a variável `--pulso` só no núcleo.
- `fundo-rede.js`: lê as cores CSS só por ~0,7 s depois que a classe do `<html>` muda, compara distâncias ao quadrado, desenha todos os pontos de uma vez e não recria a rede quando a barra do navegador do celular aparece/some.
- `login.css`: o piso em grade anda com `transform` (na placa de vídeo) em vez de `background-position`. No celular, sem `backdrop-filter` (o balão ficou 94% opaco para manter o visual).
- Imagens recomprimidas sem perda (pixels idênticos): corpo 1,9 MB → 0,84 MB (também cortado na altura visível), cabeça 470 KB → 335 KB.

## 5. Identidade visual
- Nome: **NEXUS**, com o subtítulo **Inteligência de Dados**. Substitui "Optmus" e "ANALISTA" em todo o site.
- **Estilo futurista**, com tema escuro. Hoje o site usa preto com dourado (`#C9A568`), e o dourado sai.

### Paleta oficial "Ciano elétrico" (escolhida em 03/11/2026)
| Papel | Cor | Variável CSS | Uso |
|-------|-----|--------------|-----|
| Fundo da página | `#0A0E1A` | `--nexus-fundo` | Fundo geral |
| Superfície / cartões | `#121A2E` | `--nexus-superficie` | Cartões, painéis e tabelas |
| Borda | `#1F2C4A` | `--nexus-borda` | Linhas finas e contornos |
| Primária | `#00E5FF` | `--nexus-primaria` | Botões principais, destaques e item ativo |
| Secundária | `#3D7BFF` | `--nexus-secundaria` | Links, séries de gráfico e apoio |
| Acento | `#8F6BFF` | `--nexus-acento` | Detalhes e terceira série de gráfico |
| Texto principal | `#E6F1FF` | `--nexus-texto` | Títulos e texto |
| Texto secundário | `#8FA3C0` | `--nexus-texto-2` | Legendas e apoio |

```css
:root {
  --nexus-fundo: #0A0E1A;
  --nexus-superficie: #121A2E;
  --nexus-borda: #1F2C4A;
  --nexus-primaria: #00E5FF;
  --nexus-secundaria: #3D7BFF;
  --nexus-acento: #8F6BFF;
  --nexus-texto: #E6F1FF;
  --nexus-texto-2: #8FA3C0;
}
```

Regras de uso:
- O texto sobre a cor primária (`#00E5FF`) usa o fundo escuro `#0A0E1A`.
- As cores ficam sempre em **variáveis CSS**, para que a paleta possa ser trocada em um só lugar.
- ⚠️ As cores de status (em dia / atenção / atraso) ainda estão a definir. Elas devem manter o sentido verde/amarelo/vermelho e ser legíveis sobre o fundo escuro. O login usa por ora `--nexus-erro: #FF5C7A` e `--nexus-sucesso: #2EE6A6`, marcadas como provisórias no `login.css`. A Inteligência de Rede usa, também provisórias, `--nexus-ok: #2EE6A6` (em dia), `--nexus-atencao: #FFC857` (atenção) e `--nexus-atraso: #FF5C7A` (atraso), no `inteligencia.css`.

## 6. Mascote NEXUS
### Conceito (aprovado em 03/11/2026)
- Andróide/robô humanoide **masculino** chamado **NEXUS**. É a cara do projeto.
- Personalidade: **inteligente e curioso**, com um sorriso amigável.
- Estilo: render 3D cartoon brilhante, no mesmo nível de acabamento da antiga Optmus.
- Visual: armadura branco-pérola brilhante; partes internas azul-marinho (`#0A0E1A` a `#1F2C4A`); detalhes luminosos em ciano (`#00E5FF`) com toques de azul (`#3D7BFF`) e violeta (`#8F6BFF`); **cabelo curto, penteado para trás, azul-marinho com uma mecha luminosa ciano**; sobrancelhas marcadas; placa ciano na testa; módulos tipo fone de ouvido nas orelhas, com anel ciano; núcleo circular luminoso no peito; olhos grandes com íris ciano.
- Uma primeira versão desenhada em SVG plano foi **rejeitada** por ficar feia. Não voltar para esse caminho. O personagem deve usar as imagens 3D abaixo.

### Imagens (em `ASSETS/`)
| Arquivo | Tamanho | Conteúdo |
|---------|---------|----------|
| `nexus-completo.png` | 1105 × 1424, PNG com transparência | NEXUS da cabeça até a cintura, com olhos ciano. Referência oficial. |
| `nexus-olhos-vazios.png` | 1105 × 1424, PNG com transparência | Mesma pose, com os olhos totalmente brancos, sem íris. Base para desenhar íris animadas por cima. |

Observações sobre as imagens:
- As duas já estão **sem fundo** (transparentes) e com o **mesmo tamanho** (1105 × 1424). O fundo foi removido pelo autor em 03/11/2026.
- As duas foram geradas por IA de imagem, a partir de prompts. Elas têm o mesmo enquadramento, mas **não são idênticas pixel a pixel**: há pequenas diferenças espalhadas, porque a IA redesenhou a imagem inteira. Para animar, use a versão de olhos vazios como base inteira, e não para recortar só os olhos e colar sobre a outra.

### Uso no site
- **Tela de login:** o NEXUS no lugar da Optmus. A **cabeça e os olhos seguem o cursor de forma natural e realista**: os olhos se movem rápido e a cabeça devagar, com suavização.
- **Logo / ícone pequeno:** recorte da cabeça, quadrado, com fundo transparente (512 × 512), para favicon e cabeçalho.
- **Expressões diferentes:** pelo menos curioso (padrão), feliz, pensando e erro (por exemplo, para login recusado).

### Plano técnico da animação
- Montar o personagem em camadas, como a Optmus fazia: corpo + cabeça (recortada da imagem) + íris desenhadas em SVG ou CSS sobre os olhos vazios, limitadas pelo formato do olho (clip-path).
- Laço com `requestAnimationFrame` e interpolação suave (lerp): olhos rápidos (fator ~0,26) e cabeça lenta (fator ~0,065). A cabeça gira poucos graus e se desloca alguns pixels, sem exagero.
- Após cerca de 3 s sem mexer o mouse, o olhar passeia sozinho ("idle"). Piscadas aleatórias de tempos em tempos.
- Respeitar `prefers-reduced-motion` (desligar o movimento).
- No celular (sem cursor), o olhar pode seguir o toque ou ficar no modo "idle".
- API em JavaScript: `Nexus.expressao('feliz')`, `Nexus.reagir('erro')`, `Nexus.atual`.
- ✅ Implementado em `JAVA/nexus.js` (03/11/2026), a partir do protótipo `nexus-personagem.js`.

### Como as camadas foram montadas (03/11/2026)
- As duas camadas saem de `nexus-olhos-vazios.png`. A cabeça é cortada por uma linha logo abaixo do queixo, sobre o pescoço escuro, com borda suave de 8 px.
- No corpo, o miolo da cabeça foi mantido, mas encolhido 40 px (erosão do alfa), e logo acima da linha de corte o pescoço foi "esticado" 45 px para cima (assim não aparece um segundo queixo quando a cabeça sobe). Quando a cabeça se mexe, nunca aparece o contorno antigo por trás. **Por isso o movimento da cabeça não pode passar de ~35 px da imagem** (os limites estão comentados no `nexus.js`).
- Movimento da cabeça (03/11/2026): segue o olhar com uma **mola** (acelera, desacelera e passa um pouco do ponto), com giro 3D (`rotateY` até ~9°, `rotateX` até ~6°), leve tombo e deslocamento, e um balanço contínuo bem leve.
- ⚠️ Não colocar `mask-image` (nem `filter`, fora do modo alerta) no `.nexus-palco` ou em outro ancestral da cabeça: com o giro 3D, o Chrome deixa de desenhar o SVG das íris. O esmaecimento de baixo fica só no `.nexus-corpo`.
- Ponto de giro da cabeça: (575, 520). Íris neutras: olho esquerdo (511, 306), direito (655, 317), raio 31. O formato de cada olho está em `clipPath` no `login.html`, em coordenadas da imagem.
- Expressões só mexem em olhos, pálpebras, pose da cabeça e cor do núcleo do peito (boca e sobrancelhas fazem parte da imagem).

### Prompts usados para gerar as imagens
Prompt base (em inglês; anexar a imagem da Optmus como referência de estilo):
> Use the attached image only as a style reference: 3D glossy cartoon robot mascot, pearl-white armor panels, thin glowing trim, big expressive eyes, friendly smile, headphone-style ear modules. Create a NEW, original MALE humanoid android named NEXUS. Young adult, confident, intelligent and curious expression, slight friendly smile, big cyan irises with white catchlights, defined eyebrows. Squarer jaw and broader shoulders. Pearl-white glossy armor with deep navy (#0A0E1A to #1F2C4A) inner parts and electric cyan (#00E5FF) glowing trim, small #3D7BFF and #8F6BFF accents. Headphone-style ear modules with a cyan glow ring. Small circular glowing core emblem on the chest, no text. Front-facing bust (head to waist), transparent or flat white background, no text, no logos, no watermark.

Complemento (versão escolhida, cabelo curto):
> Short, neat, swept-back glossy navy hair with a thin cyan highlight line.

Prompt de edição para os olhos vazios:
> Edit this image: remove the irises, pupils and catchlights from both eyes, leaving clean, smooth, solid white eyeballs. Keep everything else exactly the same.

## 7. Setores (páginas)
| # | Setor | Situação |
|---|-------|----------|
| 1 | **Visão geral** | Reúne os indicadores de **todos os outros setores**. **Não é prioridade agora**, será feito mais tarde. |
| 2 | **Inteligência de Rede** | Existe (`inteligencia.html`). Regras na seção 8. |
| 3 | **Relacionamento** (antes "Captação/Cadastro") | Existe (`cad-cap.html`). Precisa ser renomeado. |
| 4 | **Faturamento** | **Não é prioridade agora**, será feito mais tarde. Indicadores e colunas serão definidos na hora. |
| 5 | **Saúde e Social** | Existe (`saude-social.html`), criada pelo autor em 05/11/2026. Mapas de distribuição geográfica dos beneficiários. Regras na seção 8. Ainda fora do padrão NEXUS (ver pendências). |

Novos setores seguem o mesmo padrão: botão de importar planilha, filtros e indicadores calculados no navegador.

## 8. Regras de negócio dos indicadores

### Inteligência de Rede — estrutura (reformulada em 03/11/2026)
- Menu lateral responsivo: logo NEXUS, nome do painel, **seletor suspenso "Ir para a tela"** e a lista de telas. No desktop alterna entre aberto (248 px) e trilho de ícones (76 px); começa recolhido abaixo de 1600 px e guarda a escolha. Abaixo de 1024 px vira gaveta (☰).
- **Cada tela cabe inteira na janela, sem rolar a página**, com altura útil a partir de 560 px. ⚠️ Atenção: num notebook 1366 × 768, com o navegador aberto, a altura útil real é de ~640 px; por isso há uma versão compacta abaixo de 720 px de altura. Testado em 1366 × 640, 1366 × 600, 1280 × 720, 1920 × 950 e 1920 × 1080. A tabela calcula quantas linhas cabem (34 px por linha) e pagina o resto. No celular a página rola e a tabela vira cartões.
- ⚠️ A faixa de indicadores tem **sempre altura fixa** no desktop (168 / 206 / 250 px conforme a altura da janela). As colunas dos setores calculam a altura a partir dela; sem altura fixa, coluna e área cresciam uma empurrando a outra (bug corrigido em 03/11/2026).
- Novas telas: basta criar outra `<section class="tela" data-tela="..." data-titulo="..." data-icone="...">` no HTML; menu e seletor são montados sozinhos. ⚠️ As outras telas serão definidas pelo autor.
- **Tela 1 — Visão operacional** (decisões do autor, 03/11/2026):
  - Conta-se por **ocorrência** (cada linha da planilha).
  - **Pendente** = `STATUS_OCORRENCIA` "Pendente".
  - **Abertos hoje / Encerrados hoje** = `DATA_ABERTURA_OCORRENCIA` / `DATA_ENCERRAMENTO_OCORRENCIA` iguais à **data do computador**. Esses dois cartões ignoram o filtro de período, mas seguem os demais.
  - **Cor do "Encerrados hoje"** (pedido do autor): encerrados **menor** que abertos do dia = vermelho; **igual** = amarelo; **maior** = verde. O texto de apoio diz quantos a mais/a menos.
  - **Situação** (Todos · Pendentes · Encerrados, pela `STATUS_OCORRENCIA`): fica no topo da página e é um **filtro global**, como os outros (pedido do autor, 03/11/2026). Vale para cartões, gráfico, tabela e exportação. Cada botão mostra a quantidade considerando os demais filtros. Padrão: Todos.
  - **Protocolos por setor**: **colunas empilhadas** (em dia embaixo, atenção no meio, atraso em cima) pela **RN 623**. Seguem todos os filtros, inclusive a Situação; o título muda para "Pendentes por setor" / "Encerrados por setor". Pendentes contam os dias úteis até hoje; encerrados, até o encerramento. Cada parte tem rótulo de dados, o total fica em cima e o nome embaixo. Para o rótulo sempre caber, cada parte com valor tem no mínimo 17 px; o resto da altura segue a proporção. Clicar num setor filtra por ele. A legenda no topo do cartão foi aprovada como está.
  - **Filtros**: período pela `DATA_ABERTURA_OCORRENCIA` (de/até e atalhos), setor, Descrição_ocorrência (lista com busca e várias seleções) e **Canal** (botões, coluna `DESC_COMUNICACAO`; substituiu o filtro de Descrição_tipo_ocorrencia a pedido do autor em 03/11/2026 — o tipo continua aparecendo no detalhe do protocolo).
    - Canais em ordem de volume, com nomes curtos ("E-MAIL INSTITUCIONAL" → "E-mail"). No desktop ficam numa linha; os que não cabem vão para o botão **"+N"**, que abre uma lista (ex.: 1366 px mostra 7 e "+2"; a partir de 1440 px cabem os 9). No celular rolam para o lado.
    - ⚠️ A planilha tem também a coluna `COMUNICACAO` (só códigos). O reconhecimento de colunas tenta os nomes de `CAMPOS` **na ordem de preferência**, então `DESC_COMUNICACAO` é a escolhida.
  - **Tabela** (na própria tela 1, todos os protocolos filtrados): Protocolo (`PROTOCOLO_ANS`), CPF, E-mail, Setor, Descrição da ocorrência, Data de abertura, Data de previsão (`DATA_PREVISAO_SLA`), Status RN 623 (encerrados contam até o encerramento) e Observação de abertura (clique abre o texto inteiro). Busca por protocolo, CPF ou e-mail. A exportação **não tem filtro próprio**: **Exportar Excel** leva exatamente os protocolos da tabela (filtros da tela + busca), com dados pessoais (decisão do autor). O nome da planilha e a data mais recente aparecem ao lado do título "Protocolos".
  - O rótulo do grupo de botões dos filtros (hoje **"Canal"**) fica sempre visível (pedido do autor).
  - ⚠️ Antes de entregar mudanças nesta tela, rodar a avaliação em vários tamanhos (1354 × 636, 1366 × 768, 1280 × 720, 1440 × 800, 1920 × 950/1080 e celular), com números de 4 dígitos nos cartões: nada pode rolar, transbordar, se sobrepor nem ficar cortado.
- Setores: além de `REGRAS_SETORES`, há `COMPLEMENTO_SETORES` (combinações exatas aprovadas pelo autor em 03/11/2026). Na planilha real de 13.683 linhas sobram 19 sem setor; elas aparecem como "Não classificado" até o autor dizer onde entram.

### Inteligência de Rede (chamados do CRM)
- **RN 566:** já vem pronta na planilha (coluna de status). Tudo que é "em dia" ou "atraso" nessa regra segue a planilha. O site só lê.
- **RN 623:** calculada pelo site, em **dias úteis** entre a abertura e o encerramento. Se o chamado está aberto, conta até hoje.
  - **Em atraso:** mais de 5 dias úteis.
  - **Em atenção:** 4 a 5 dias úteis.
  - **Em dia:** menos de 4 dias úteis.
  - **Dia útil = segunda a sexta.** Descontam-se **apenas os finais de semana** (sábado e domingo).
  - **Feriados não entram na regra:** um feriado que cai de segunda a sexta conta como dia útil normal. Não há lista de feriados (`prazoRN623` e `diasUteisEntre` em `inteligencia.js`).
- ⚠️ Os indicadores abaixo (IR mensal, RN 566, tempo médio, reclamações, evolução etc.) **existiam na versão antiga** e hoje estão só em `ARQUIVO/inteligencia-v1/`. Eles voltam quando o autor definir as próximas telas.
- **IR mensal (índice de resolução no prazo):** entre os chamados **abertos no mês atual e já encerrados**, é o percentual resolvido no prazo **segundo a RN 566** (a da planilha). Regra confirmada pelo autor. Fórmula: resolvidos no prazo ÷ encerrados do mês × 100.
  - No código (`prepararRegistro`, campo `resolvidoNoPrazo`), o valor é verdadeiro quando o chamado está encerrado **e** o texto de status da RN 566 contém "em dia", "no prazo", "cumprido" ou "resolvido no prazo". Se a planilha usar outra redação, o chamado não será contado como no prazo.
- **Tempo médio de encerramento:** média em dias úteis, com a mesma regra (segunda a sexta).
- Outros indicadores atuais: total, abertos hoje, encerrados hoje, em aberto, atrasos RN 566 e RN 623, SLA por setor, evolução mensal, abertura × encerramento, por assunto/setor e reclamações (total, média mensal, por plano/assunto/setor, evolução). Também há uma tabela de consulta com exportação para Excel.

### Relacionamento (captação e cadastro)
- Indicadores atuais: total de leads, sem plano, 1º/2º/3º contato, interessados e quem aceitou preencher a adesão.
- **Temperatura do lead** (frio/morno/quente) vem da própria planilha.
- Quebras por órgão e por colaborador, filtros e base de leads.

### Saúde e Social — distribuição geográfica (como está em 05/11/2026)
- Página com cabeçalho, faixa de indicadores e **dois mapas** (Leaflet + leaflet.heat), cada um com os modos **Calor**, **Bolhas** e **Ambos** e um botão de restaurar o enquadramento.
- **Planilha:** procura, nas 30 primeiras linhas de cada aba, um cabeçalho com `BAIRRO`, `CIDADE` (ou `MUNICIPIO`) e `ESTADO` (ou `UF`). Cada linha é **uma vida**. Aceita `.xlsx`, `.xls` e `.xlsb` (não aceita `.csv`).
- **Indicadores:** Total de vidas (todas as linhas), Vidas no RJ (UF `RJ` ou `RIO DE JANEIRO`), Região Metropolitana, Municípios com beneficiários, nome do arquivo e data/hora da importação.
- **Região Metropolitana** = lista fixa `METRO` no `saude-social.js` (22 municípios, incluindo Petrópolis).
- **Mapa 01 — Rio de Janeiro e Região Metropolitana:** só os municípios da lista `METRO`; Rio de Janeiro e Niterói ganham rótulos fixos com o total de vidas. Clicar neles abre uma janela com a **concentração por bairro** (lista ordenada e mapa de calor aproximado).
- **Janela de bairros — fica como o autor fez (decisão do autor, 05/11/2026).** Cada bairro é buscado no **Nominatim**, um por vez, com 1,15 s de espera (com a planilha real: ~4 min no Rio, 175 bairros; ~1 min em Niterói, 37). O autor aceita a lentidão.
  - ⚠️ **Não mexer nesta janela sem pedido.** Em 05/11/2026 foi testada uma versão instantânea (posições locais da malha de bairros do IBGE 2022 + correção de nomes abreviados), e também um fundo escuro no lugar do mapa de ruas; o autor **rejeitou as duas** e pediu a versão original de volta (`saude-social.js` restaurado como estava). Os arquivos `bairros-rj.js` e `bairros-localizar.js` foram apagados.
  - Fundo: mapa de ruas do OpenStreetMap. ⚠️ Ele devolve "403 Access blocked" quando a página é aberta **direto do arquivo** (`file://`); publicado (GitHub Pages) ou por servidor local, funciona.
- **Mapa 02 — Estado do Rio de Janeiro:** todos os municípios do RJ.
  - **Janela de bairros do estado (pedido do autor, 05/11/2026):** no mapa 02, **só o município do Rio de Janeiro** abre a janela (dica "Clique para explorar os bairros do estado"; os outros municípios continuam com o balão do total). A janela é **igual à do mapa 01** (mesma função `janelaBairros`), com o título "ESTADO DO RIO DE JANEIRO — CONCENTRAÇÃO POR BAIRRO" e os bairros de **todas as cidades da planilha**, cada um como "BAIRRO — CIDADE" (há nomes repetidos, como CENTRO).
  - Usa a mesma busca no Nominatim, um por vez: com a planilha real são 508 bairros em 54 cidades, **~10 min** (aceito pelo autor). Para cidades fora de Rio/Niterói, a busca vai com o nome da cidade e só aceita pontos dentro do estado do RJ. O mapa 01 não mudou.
- O rodapé de cada mapa (maior concentração e percentual) existe no HTML, mas o JS o remove ao iniciar.
- ⚠️ **Depende de internet**, ao contrário do resto do site: os contornos dos municípios vêm do GitHub (`tbrugz/geodata-br`), o mapa de bairros usa os mapas do OpenStreetMap, as bibliotecas vêm de CDN e a localização de cada bairro é buscada no **Nominatim**. Nessa busca, **os nomes dos bairros saem do navegador** (sem nome, CPF nem contagem), o que contraria a regra "nada é enviado" da seção 2; o autor preferiu manter assim.

## 9. Importação de planilhas
- Formatos aceitos: `.xlsx`, `.xls` e `.csv`.
- As colunas são reconhecidas pelo **nome do cabeçalho**, ignorando acentos, maiúsculas e variações. Cada setor tem uma lista de nomes aceitos para cada campo.
- Novos setores devem seguir esse padrão, para que a planilha possa ter pequenas variações de nome sem quebrar.

## 10. Pendências (em ordem sugerida)
1. ✅ **Mascote NEXUS** (03/11/2026): camadas, olhos e cabeça seguindo o cursor, piscadas, expressões e ícone 512 × 512 prontos, e já usados no login.
2. ✅ **Login reformulado** (03/11/2026) com a paleta Ciano elétrico, marca NEXUS, usuário de demonstração, modo alerta vermelho no erro e transição de portal no acesso.
   ✅ **Inteligência de Rede — tela 1** reformulada e **aprovada pelo autor** (03/11/2026). Ajustes nela, se houver, ficam para depois.
   ⏭️ **Inteligência de Rede — tela 2**, logo abaixo da tela 1 no menu; o autor vai passar os indicadores. Também pendentes: as 19 combinações sem setor.
   Falta reformular **Relacionamento**.
   ⏭️ **Agora (05/11/2026), antes de criar novas páginas:** melhorias no **login** e na página **Saúde e Social**, que o autor vai descrever. Seguir o mesmo ritmo das outras telas: ele descreve, perguntamos o que tiver dúvida, fazemos, testamos e ele aprova.
   - ✅ Login, melhoria 1: transição de portal esfumaçada (2,8 s) e som espacial contínuo, que termina no login (seção 4). **Aprovada pelo autor em 05/11/2026.** Não mudar sem pedir.
   Pendências já vistas no código da Saúde e Social (confirmar com o autor antes de mexer):
   - Marca **ASSEFAZ** no título, no cabeçalho e no rodapé (contraria a seção 1); trocar pela marca NEXUS. O sobretítulo diz "Inteligência de Rede", mas o painel é Saúde e Social.
   - Paleta própria (`--bg`, `--cyan` etc.) em vez das variáveis `--nexus-*`; sem logo/favicon do NEXUS.
   - Bibliotecas por CDN: Leaflet 1.9.4, leaflet.heat 0.2.0, Lucide 0.468.0 e SheetJS **0.18.5** (o projeto usa o 0.20.3 de `LIB/`). O JS também tenta carregá-las de novo sozinho.
   - ✅ O `<script>` apontava para `../java/saude-social.js` (minúsculo), o que quebraria no GitHub Pages. Corrigido para `../JAVA/` em 05/11/2026. Sempre usar as pastas em maiúsculas (`HTML/`, `CSS/`, `JAVA/`, `ASSETS/`, `LIB/`).
   - ❌ Saúde e Social, tentativa 1 (janela de bairros mais rápida): **rejeitada pelo autor** em 05/11/2026 e desfeita. A janela voltou à versão original (seção 8).
   - 🔄 Saúde e Social, melhoria 2: janela de bairros de todo o estado ao clicar no Rio no mapa 02 (seção 8). **Feita em 05/11/2026, aguardando aprovação do autor.**
   - Ainda depende de internet: contornos dos municípios (GitHub), mapa de ruas e Nominatim na janela de bairros, e bibliotecas (CDN).
   - Não aceita `.csv` (a seção 9 pede `.xlsx`, `.xls` e `.csv`).
   - Falta planilha de exemplo **fictícia** em `EXEMPLOS/`.
3. Definir as cores de status (em dia / atenção / atraso). Hoje estão provisórias (seção 5).
4. Trocar as bibliotecas de CDN por arquivos locais: ✅ Inteligência de Rede já usa o SheetJS 0.20.3 de `LIB/` (e não usa mais Chart.js). Falta o `cad-cap.html`.
5. Renomear "Captação/Cadastro" para "Relacionamento" nas páginas `cad-cap.*` (o login já usa o nome novo) e trocar Optmus/ANALISTA por NEXUS nelas. Depois, remover as imagens `optmus-*` de `ASSETS/` e o `nexus-personagem.js` da raiz.
6. Criar planilhas de exemplo **fictícias** para demonstrar o portfólio. ✅ Inteligência de Rede (`EXEMPLOS/`). Falta a do Relacionamento.
7. Mais tarde: indicadores da **Visão geral** e do **Faturamento**.

## 11. Como trabalhar neste projeto
- Antes de mudar uma regra de negócio, confira a seção 8. Em caso de dúvida, pergunte ao autor em vez de supor.
- Não adicione frameworks, build, servidor nem banco de dados.
- Teste abrindo o HTML direto no navegador.
- Ao terminar uma pendência, atualize a seção 10 deste arquivo.
