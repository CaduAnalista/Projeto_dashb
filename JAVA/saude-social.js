
/* Saúde e Social — Distribuição Geográfica
   Mapa 01 (rede): prestadores da planilha de rede, com mapa de calor e marcadores.
   Mapa 02 (estado): beneficiários da planilha BAIRRO, CIDADE, ESTADO. */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const norm = v => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g,'').trim().toUpperCase().replace(/\s+/g,' ');
const fmt = n => Number(n || 0).toLocaleString('pt-BR');
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const METRO = new Set('RIO DE JANEIRO|NITEROI|SAO GONCALO|DUQUE DE CAXIAS|NOVA IGUACU|SAO JOAO DE MERITI|BELFORD ROXO|NILOPOLIS|MESQUITA|QUEIMADOS|JAPERI|SEROPEDICA|ITAGUAI|MAGE|GUAPIMIRIM|ITABORAI|TANGUA|MARICA|CACHOEIRAS DE MACACU|RIO BONITO|PARACAMBI|PETROPOLIS'.split('|'));
const GEO_URL = 'https://raw.githubusercontent.com/tbrugz/geodata-br/master/geojson/geojs-33-mun.json';
const A = {data:null,geo:null,centers:null,maps:{},boundaries:{},heats:{},heatsB:{},bubbles:{},mode:{rede:'ambos',estado:'calor'},camadas:{rede:true,benef:true},controles:{},modal:null,cache:new Map(),queue:Promise.resolve(),request:0};
const put=(id,v)=>{if($(id))$(id).textContent=v;};
function status(msg,ok=false){put('statusBase',msg);const dot=$('statusDot');if(dot){dot.classList.toggle('ativo',ok);dot.classList.toggle('erro',!ok&&msg.startsWith('Erro'));}}
function script(url,test){if(test())return Promise.resolve();return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=url;s.onload=()=>test()?resolve():reject(Error('Falha na biblioteca'));s.onerror=()=>reject(Error('Não foi possível carregar '+url));document.head.appendChild(s);});}
async function libraries(){
 if(!document.querySelector('link[href*="leaflet.css"]')){const l=document.createElement('link');l.rel='stylesheet';l.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';document.head.appendChild(l);}
 await script('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',()=>!!window.L);
 await script('https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js',()=>!!window.L?.heatLayer);
 await script('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',()=>!!window.XLSX);
}
const ehRJ = uf => ['RJ','RIO DE JANEIRO'].includes(uf);
function heatIntensity(n,max){if(n<=0)return 0;return Math.max(.12,Math.pow(n/max,.42));}
function heatGradient(){return {0:'#1946c8',.15:'#1677ed',.30:'#00c9f5',.47:'#25e68e',.60:'#d9f53a',.72:'#ffe132',.84:'#ff8b20',.94:'#f04425',1:'#f20d22'};}
/* Comparação no mapa 01: cada camada tem só a sua família de cor, para não se confundirem.
   Beneficiários = quentes (amarelo → laranja → vermelho); rede = frias (azul → ciano → branco). */
const GRAD_BENEF={0:'#ffe08a',.35:'#ffb020',.65:'#ff6a1a',.85:'#ff3b2f',1:'#e8003d'};
const GRAD_REDE={0:'#1238b8',.35:'#1f6bff',.65:'#14b8ff',.85:'#00e5ff',1:'#e6fdff'};
function cityName(f){const p=f.properties||{};for(const k of ['name','nome','NM_MUN','NM_MUNICIP','municipio','MUNICIPIO','NOME'])if(p[k])return norm(p[k]);return '';}

/* ---------- Mapas (comuns aos dois) ---------- */
function initMaps(){if(A.maps.rede)return;for(const [k,id] of [['rede','mapaRede'],['estado','mapaEstado']]){
 const map=L.map(id,{preferCanvas:true,zoomControl:true,attributionControl:false,zoomSnap:.25}).setView([-22.65,-42.8],8);
 map.getContainer().style.background='radial-gradient(ellipse at center,#102444,#08152b)';
 map.createPane('v9heat');map.getPane('v9heat').style.zIndex='350';map.getPane('v9heat').style.pointerEvents='none';
 map.createPane('v9borders');map.getPane('v9borders').style.zIndex='410';
 A.maps[k]=map;
 if(k==='rede'){
  map.createPane('v9heatB');map.getPane('v9heatB').style.zIndex='345';map.getPane('v9heatB').style.pointerEvents='none';
  map.on('zoomend',drawProviders);
  A.controles.legenda=controle('bottomleft','v9-comp-legenda');
  A.controles.expandir=controle('topright','v9-expandir');
 }
 }}
/* Caixinha fixa sobre o mapa (legenda e ranking "onde expandir") */
function controle(posicao,classe){const c=L.control({position:posicao});c.onAdd=()=>{const d=L.DomUtil.create('div',classe);L.DomEvent.disableClickPropagation(d);L.DomEvent.disableScrollPropagation(d);d.hidden=true;return d;};c.addTo(A.maps.rede);return c.getContainer();}
async function ensureMaps(){initMaps();if(!A.geo){const res=await fetch(GEO_URL);if(!res.ok)throw Error('Não foi possível carregar os municípios');const geo=await res.json();if(!Array.isArray(geo.features))throw Error('Malha municipal inválida');A.geo=geo;}
 if(!A.centers){A.centers=new Map();for(const f of A.geo.features)A.centers.set(cityName(f),L.geoJSON(f).getBounds().getCenter());}}
function clear(k){for(const dict of [A.boundaries,A.heats,A.heatsB,A.bubbles])if(dict[k]){A.maps[k].removeLayer(dict[k]);dict[k]=null;}}
function draw(k,fit=false){if(k==='rede')drawRede(fit);else drawEstado(fit);}
function setMode(k,mode){A.mode[k]=mode;const suffix=k==='rede'?'Rede':'Estado';for(const m of ['Calor','Bolhas','Marcadores','Ambos']){const b=$('btn'+m+suffix);if(b){const active=m.toLowerCase()===mode;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));}}draw(k);}

/* ---------- Mapa 02: beneficiários ---------- */
function readExcel(book){for(const sheet of book.SheetNames){const rows=XLSX.utils.sheet_to_json(book.Sheets[sheet],{header:1,defval:'',raw:false,blankrows:false});for(let i=0;i<Math.min(30,rows.length);i++){const h=rows[i].map(norm),b=h.indexOf('BAIRRO'),c=h.findIndex(x=>x==='CIDADE'||x==='MUNICIPIO'),u=h.findIndex(x=>x==='ESTADO'||x==='UF');if(b<0||c<0||u<0)continue;return rows.slice(i+1).filter(r=>r.some(x=>String(x??'').trim())).map(r=>({bairro:norm(r[b]),cidade:norm(r[c]),uf:norm(r[u])}));}}throw Error('Não encontrei as colunas BAIRRO, CIDADE e ESTADO.');}
function aggregate(rows){const cities=new Map(),bairros=new Map();let rj=0,metro=0;for(const r of rows){if(!ehRJ(r.uf))continue;rj++;if(r.cidade)cities.set(r.cidade,(cities.get(r.cidade)||0)+1);if(METRO.has(r.cidade))metro++;if(r.cidade&&r.bairro){const k=r.cidade+'|'+r.bairro;bairros.set(k,(bairros.get(k)||0)+1);}}return {total:rows.length,rj,metro,cities,bairros};}
function indicators(d){put('totalVidas',fmt(d.total));put('vidasRJ',fmt(d.rj));put('vidasMetropolitana',fmt(d.metro));put('totalMunicipios',fmt(d.cities.size));put('totalMapaEstado',fmt(d.rj));put('municipiosMapaEstado',fmt(d.cities.size));}
function popup(name,n,estado=false){return `<div class="v9-tip"><strong>${esc(name)}</strong><span>${fmt(n)} vidas</span>${estado&&name==='RIO DE JANEIRO'?'<small>Clique para explorar os bairros do estado</small>':''}</div>`;}
/* Só o município do Rio abre a janela, e ela traz os bairros de todas as cidades da planilha */
const abreEstado=name=>name==='RIO DE JANEIRO';
function drawEstado(fit=false){const k='estado',map=A.maps[k],d=A.data;if(!map||!d||!A.geo)return;clear(k);
 const features=A.geo.features;
 const max=Math.max(1,...features.map(f=>d.cities.get(cityName(f))||0));
 const points=[];
 A.boundaries[k]=L.geoJSON(A.geo,{pane:'v9borders',style:f=>{const n=d.cities.get(cityName(f))||0;return {color:n?'#44647c':'#283d57',weight:n?.95:.6,fillColor:'#10213d',fillOpacity:.035,interactive:true};},onEachFeature:(f,layer)=>{
  const name=cityName(f),n=d.cities.get(name)||0;
  layer.bindTooltip(popup(name,n,true),{sticky:true,direction:'top',opacity:.98,className:'v9-tooltip'});
  layer.on('click',e=>{if(abreEstado(name))openBairrosEstado();else L.popup({maxWidth:230}).setLatLng(e.latlng).setContent(popup(name,n)).openOn(map);});
  if(abreEstado(name))layer.on('mouseover',()=>layer.setStyle({weight:2.5,color:'#39d8f5'}));
  layer.on('mouseout',()=>A.boundaries[k]?.resetStyle(layer));
  if(n)points.push({name,n,center:layer.getBounds().getCenter()});
 }}).addTo(map);
 if(A.mode[k]!=='bolhas'&&points.length){
  A.heats[k]=L.heatLayer(points.map(p=>[p.center.lat,p.center.lng,heatIntensity(p.n,max)]),{pane:'v9heat',radius:34,blur:17,max:.68,maxZoom:12,minOpacity:.40,gradient:heatGradient()}).addTo(map);
 }
 if(A.mode[k]!=='calor'){
  A.bubbles[k]=L.layerGroup().addTo(map);
  for(const p of points)L.circleMarker(p.center,{pane:'v9borders',radius:Math.max(5,Math.min(23,4+18*Math.sqrt(p.n/max))),color:'#fff',weight:1,fillColor:p.n===max?'#ff243a':'#00c9f5',fillOpacity:.8}).bindTooltip(popup(p.name,p.n,true),{className:'v9-tooltip'}).on('click',e=>{L.DomEvent.stopPropagation(e);if(abreEstado(p.name))openBairrosEstado();else L.popup().setLatLng(e.latlng).setContent(popup(p.name,p.n)).openOn(map);}).addTo(A.bubbles[k]);
 }
 if(fit){const b=A.boundaries[k].getBounds();if(b.isValid())map.fitBounds(b,{padding:[20,20],animate:false});}
 $('placeholderEstado')?.classList.add('oculto');
 requestAnimationFrame(()=>map.invalidateSize());
}
function closeModal(){if(!A.modal)return;A.modal.closed=true;A.modal.map?.remove();A.modal.element.remove();A.modal=null;}
function geocode(bairro,city){const key=city+'|'+bairro;if(A.cache.has(key))return Promise.resolve(A.cache.get(key));
 const task=A.queue.then(async()=>{await new Promise(r=>setTimeout(r,1150));try{
  const cidade=city==='NITEROI'?'Niterói':city==='RIO DE JANEIRO'?'Rio de Janeiro':city;
  const q=encodeURIComponent(bairro+', '+cidade+', RJ, Brasil');
  const res=await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q='+q,{headers:{'Accept-Language':'pt-BR'}});
  if(!res.ok)return null;const result=await res.json();if(!result.length)return null;
  const lat=Number(result[0].lat),lng=Number(result[0].lon);
  if(city==='RIO DE JANEIRO'&&(lat< -23.15||lat> -22.65||lng< -43.85||lng> -43.05))return null;
  if(city==='NITEROI'&&(lat< -23.15||lat> -22.75||lng< -43.20||lng> -42.75))return null;
  /* demais cidades: só aceita resultado dentro do estado do RJ */
  if(city!=='RIO DE JANEIRO'&&city!=='NITEROI'&&(lat< -23.40||lat> -20.70||lng< -45.00||lng> -40.90))return null;
  const pos=[lat,lng];A.cache.set(key,pos);return pos;
 }catch{return null;}});A.queue=task.catch(()=>null);return task;
}
/* Bairros de todas as cidades da planilha, com a cidade junto ao nome ("CENTRO — NITEROI"), porque há nomes repetidos */
function openBairrosEstado(){if(!A.data)return;
 const list=[...A.data.bairros].map(([key,n])=>{const [city,bairro]=key.split('|');return {bairro,city,label:bairro+' — '+city,n};});
 janelaBairros('ESTADO DO RIO DE JANEIRO',list,[-22.45,-42.85],8);
}
function janelaBairros(titulo,list,center,zoom){closeModal();
 list.sort((a,b)=>b.n-a.n);
 const total=list.reduce((s,p)=>s+p.n,0),element=document.createElement('div');element.className='v9-overlay';
 element.innerHTML=`<div class="v9-dialog" role="dialog" aria-modal="true"><header><div><strong>${esc(titulo)} — CONCENTRAÇÃO POR BAIRRO</strong><small>${fmt(total)} vidas com bairro informado · ${fmt(list.length)} bairros</small></div><button class="v9-close" type="button">Fechar ×</button></header><p>Mapa aproximado por bairro, utilizando referências públicas. Não representa endereços individuais.</p><div class="v9-grid"><div id="v9-detail-map"></div><aside><strong>BAIRROS COM MAIS VIDAS</strong><div class="v9-progress">Preparando localização...</div><div class="v9-rank">${list.map(p=>`<div><span>${esc(p.label)}</span><b>${fmt(p.n)}</b></div>`).join('')}</div></aside></div></div>`;
 document.body.appendChild(element);const modal={element,map:null,closed:false};A.modal=modal;
 element.querySelector('.v9-close').onclick=closeModal;element.onclick=e=>{if(e.target===element)closeModal();};
 const map=L.map(element.querySelector('#v9-detail-map'),{zoomControl:true}).setView(center,zoom);modal.map=map;
 L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© OpenStreetMap contributors'}).addTo(map);
 setTimeout(()=>map.invalidateSize(),100);
 if(!list.length){element.querySelector('.v9-progress').textContent='Nenhum bairro informado para este município.';return;}
 const heatPoints=[],bounds=[];let found=0;
 (async()=>{for(let i=0;i<list.length;i++){if(modal.closed)return;const p=list[i],pos=await geocode(p.bairro,p.city);if(modal.closed)return;
  if(pos){found++;bounds.push(pos);heatPoints.push([...pos,heatIntensity(p.n,list[0].n)]);
   L.circleMarker(pos,{radius:4,color:'#fff',weight:1,fillColor:'#ff3045',fillOpacity:1}).bindTooltip(popup(p.label,p.n)).addTo(map);
   if(modal.heat)map.removeLayer(modal.heat);
   modal.heat=L.heatLayer(heatPoints,{radius:42,blur:18,max:.68,minOpacity:.40,gradient:heatGradient()}).addTo(map);
  }
  element.querySelector('.v9-progress').textContent=`Localizados ${found} de ${i+1} bairros consultados (${list.length} no total)`;
  if(i===Math.min(list.length-1,14)&&bounds.length>1)map.fitBounds(bounds,{padding:[35,35],maxZoom:12});
 }
 if(bounds.length>1)map.fitBounds(bounds,{padding:[35,35],maxZoom:12});
 element.querySelector('.v9-progress').textContent=`${found} de ${list.length} bairros localizados. Todos os valores permanecem na lista.`;
 })();
}
async function importExcel(e){const file=e.target.files?.[0];if(!file)return;const request=++A.request;closeModal();status('Lendo beneficiários...');try{
 await libraries();const book=XLSX.read(await file.arrayBuffer(),{type:'array'}),rows=readExcel(book);if(!rows.length)throw Error('Planilha sem registros');if(request!==A.request)return;
 A.data=aggregate(rows);indicators(A.data);put('nomeArquivo',file.name);put('ultimaAtualizacao',new Date().toLocaleString('pt-BR'));status('Carregando mapa dos beneficiários...');
 await ensureMaps();if(request!==A.request)return;drawEstado(true);put('vidasMapaRede',fmt(A.data.rj));drawRede(!R.loaded);status(R.loaded?'Beneficiários no mapa 02 e comparados com a rede no mapa 01':'Beneficiários carregados (mapas 01 e 02)',true);
 }catch(err){console.error(err);status('Erro: '+err.message);}finally{e.target.value='';}}

/* ---------- Mapa 01: rede credenciada ---------- */
const R = {rows:[],filtered:[],loaded:false,layer:null,request:0};
const clean = v => ['NAN','NULL','UNDEFINED','#N/A','N/A','#N/D'].includes(norm(v)) ? '' : String(v ?? '').trim();
const field = v => norm(v).replace(/[^A-Z0-9]/g,'');
const valueId = v => typeof v === 'number' ? String(Math.trunc(v)) : clean(v).replace(/\D/g,'');
/* Procura, nas 30 primeiras linhas de cada aba, um cabeçalho com todas as colunas exigidas (aceita nomes alternativos) */
function sheetRows(book,required){
 for(const sheet of book.SheetNames){
  const rows=XLSX.utils.sheet_to_json(book.Sheets[sheet],{header:1,defval:'',raw:true,blankrows:false});
  for(let i=0;i<Math.min(30,rows.length);i++){
   const headers=rows[i].map(field);
   if(required.every(names=>names.some(n=>headers.includes(field(n)))))
    return rows.slice(i+1).filter(r=>r.some(v=>clean(v))).map(r=>Object.fromEntries(headers.map((h,j)=>[h,r[j]??''])));
  }
 }
 throw Error('Não encontrei as colunas da rede (município e nome do prestador).');
}
const get=(row,...names)=>{for(const n of names){const v=row[field(n)];if(clean(v))return v;}return '';};
/* Para cabeçalhos longos ou cortados, como "ATENDIMENTO DE URGENCIA E EMERGENCI" */
const getPrefix=(row,prefix)=>{for(const [h,v] of Object.entries(row))if(h.startsWith(prefix)&&clean(v))return v;return '';};
/* Especialidades combinadas ("CLINICA MEDICA E ORTOPEDIA") viram itens separados no filtro */
const ESPECIALIDADES=['CLINICA MEDICA','ORTOPEDIA','PEDIATRIA','GINECOLOGIA','OBSTETRICIA','CARDIOLOGIA','OFTALMOLOGIA','OTORRINOLARINGOLOGIA','PSIQUIATRIA','ONCOLOGIA','UROLOGIA','MATERNIDADE','NEUROLOGIA','CIRURGIA GERAL'];
function especialidades(texto){
 let t=norm(clean(texto));if(!t)return [];
 t=t.replace(/\bCLINICA ?MEDI?C?A\b/g,'CLINICA MEDICA').replace(/\bOTORRINO\b/g,'OTORRINOLARINGOLOGIA');
 const out=new Set();
 for(const parte of t.split(/\s*[,;/]\s*|\s+E\s+/).map(s=>s.trim()).filter(Boolean)){
  const achadas=ESPECIALIDADES.filter(e=>parte.includes(e));
  if(achadas.length>1||(achadas.length===1&&parte!==achadas[0]&&parte.replace(achadas[0],'').trim().split(' ').length>1))achadas.forEach(e=>out.add(e));
  else out.add(parte);
 }
 return [...out];
}
function categoriaDe(texto){return texto.includes('HOSPITA')?'Hospitais':texto.includes('LABORATOR')?'Laboratórios':texto.includes('CLINIC')?'Clínicas':'Outros';}
function readRede(book){
 return sheetRows(book,[['NmeMunicipio','Municipio','Cidade'],['NmeFantasia','RazaoSocial','Prestador','NomePrestador']]).map(r=>{
  const nome=clean(get(r,'NmeFantasia','Prestador','NomePrestador','RazaoSocial'))||'Prestador sem nome';
  const cidade=norm(get(r,'NmeMunicipio','Municipio','Cidade'));
  const uf=norm(get(r,'UF','UFPrestador','Estado'))||'RJ'; // planilha de hospitais não tem UF: é toda do RJ
  const bairro=clean(get(r,'Bairro')),endereco=clean(get(r,'Endereco')),numero=clean(get(r,'NroEndereco','Numero'));
  const regiao=clean(get(r,'RegiaoDeSaude','Regiao'));
  const u=norm(get(r,'Urgencia')||getPrefix(r,'ATENDIMENTODEURGENCIA')||getPrefix(r,'URGENCIA'));
  const urgencia=['S','SIM','1','1=SIM'].includes(u)?'SIM':['N','NAO','0','2=NAO'].includes(u)?'NAO':'NAO INFORMADO';
  let classe=norm(clean(get(r,'ClasseCadastro','TipoDePrestador','TpoPrestador','TipoPrestador')));
  if(classe==='HOSPITAIS')classe='HOSPITAL';
  classe=classe||'NAO INFORMADA';
  const categoria=categoriaDe([classe,norm(get(r,'TpoPrestador')),norm(get(r,'TpoEstabelecimento'))].join(' '));
  const documento=valueId(get(r,'CNPJ/CPF','CNPJ_CPF','CNPJ'));
  // Uma unidade = documento (ou nome), município e endereço/bairro. Especialidade não cria nova unidade.
  const key=[documento||norm(nome),cidade,norm(endereco),norm(numero),norm(bairro)].join('|');
  return {key,nome,cidade,uf,bairro,endereco,numero,regiao,urgencia,classe,categoria,especialidades:especialidades(get(r,'EspecialidadeServico','Especialidade','EspecialidadeServicos'))};
 }).filter(r=>ehRJ(r.uf)&&(r.nome!=='Prestador sem nome'||r.cidade));
}
function uniqueUnits(rows){
 const units=new Map();
 for(const r of rows){
  if(!units.has(r.key))units.set(r.key,{...r,urgencias:new Set(),classes:new Set(),categorias:new Set(),esps:new Set()});
  const u=units.get(r.key);u.urgencias.add(r.urgencia);u.classes.add(r.classe);u.categorias.add(r.categoria);r.especialidades.forEach(e=>u.esps.add(e));
 }
 return [...units.values()].map(u=>({...u,categoria:['Hospitais','Laboratórios','Clínicas','Outros'].find(c=>u.categorias.has(c))}));
}
function matchedRows(ignorarCidade=false){
 const classe=$('filtroClasse').value,esp=$('filtroEspecialidade').value,cidade=ignorarCidade?'':$('filtroMunicipio').value,urg=$('filtroUrgencia').value;
 return R.rows.filter(r=>(!urg||r.urgencia===urg)&&(!classe||r.classe===classe)&&(!esp||r.especialidades.includes(esp))&&(!cidade||r.cidade===cidade));
}
function fillFilters(){
 const options=(id,values,all)=>{const select=$(id),old=select.value;select.replaceChildren();const o=document.createElement('option');o.value='';o.textContent=all;select.append(o);for(const v of values){const op=document.createElement('option');op.value=v;op.textContent=v;select.append(op);}select.value=values.includes(old)?old:'';};
 options('filtroClasse',[...new Set(R.rows.map(r=>r.classe))].sort(),'Todos');
 options('filtroEspecialidade',[...new Set(R.rows.flatMap(r=>r.especialidades))].sort(),'Todas');
 options('filtroMunicipio',[...new Set(R.rows.map(r=>r.cidade).filter(Boolean))].sort(),'Todos');
}
function renderRede(fit=false){
 if(!R.loaded)return;
 const units=uniqueUnits(matchedRows());R.filtered=units;
 put('totalPrestadores',fmt(units.length));
 put('totalHospitais',fmt(units.filter(u=>u.categoria==='Hospitais').length));
 put('totalMapaRede',fmt(units.length));
 put('municipiosMapaRede',fmt(new Set(units.map(u=>u.cidade)).size));
 drawRede(fit);
}
function tipRede(name,list,vidas){
 const porCat=['Hospitais','Clínicas','Laboratórios','Outros'].map(c=>[c,list.filter(u=>u.categoria===c).length]).filter(([,n])=>n);
 const urg=list.filter(u=>u.urgencias.has('SIM')).length;
 let html=`<div class="v9-tip"><strong>${esc(name)}</strong>`;
 if(R.loaded)html+=`<span class="tip-rede">${fmt(list.length)} ${list.length===1?'unidade':'unidades'} da rede</span>${list.length?`<small>${porCat.map(([c,n])=>`${esc(c)}: ${fmt(n)}`).join(' · ')}${urg?` · Urgência: ${fmt(urg)}`:''}</small>`:''}`;
 if(A.data)html+=`<span class="tip-benef">${fmt(vidas)} vidas</span>`;
 if(R.loaded&&A.data&&vidas)html+=`<small class="tip-razao">${list.length?`${fmt(Math.round(vidas/list.length))} vidas por unidade`:'Vidas sem nenhuma unidade da rede no município'}</small>`;
 if(abreEstado(name))html+=`<small>${R.loaded?'Clique para ver a rede do estado no mapa':'Clique para explorar os bairros do estado'}</small>`;
 return html+'</div>';
}
/* Ranking "onde expandir": municípios com mais vidas por unidade da rede (filtros da rede valem, menos o de município).
   Pontuação = vidas ÷ (unidades + 1): sem rede pesa mais, mas uma cidade com 3 vidas não passa na frente de uma com milhares. */
function atualizarExpansao(){
 const box=A.controles.expandir;if(!box)return;
 if(!R.loaded||!A.data){box.hidden=true;return;}
 const unidades=new Map();for(const u of uniqueUnits(matchedRows(true)))unidades.set(u.cidade,(unidades.get(u.cidade)||0)+1);
 const lista=[...A.data.cities].map(([cidade,vidas])=>({cidade,vidas,n:unidades.get(cidade)||0})).filter(c=>A.centers.has(c.cidade)).sort((a,b)=>b.vidas/(b.n+1)-a.vidas/(a.n+1)).slice(0,10);
 const aberto=!box.classList.contains('fechado');
 box.innerHTML=`<button type="button" class="v9-exp-titulo" aria-expanded="${aberto}">Onde expandir a rede <span>${aberto?'▾':'▸'}</span></button><div class="v9-exp-corpo"><small>Mais vidas por unidade (filtros da rede aplicados)</small><ol>${lista.map(c=>`<li><button type="button" data-cidade="${esc(c.cidade)}"><span>${esc(c.cidade)}</span><b>${fmt(c.vidas)} vidas</b><em class="${c.n?'':'sem'}">${c.n?`${fmt(c.n)} ${c.n===1?'unid.':'unids.'} · ${fmt(Math.round(c.vidas/c.n))}/unid.`:'sem rede'}</em></button></li>`).join('')}</ol></div>`;
 box.hidden=false;box.style.setProperty('--altura-exp',Math.round(A.maps.rede.getSize().y*.55)+'px');
 box.querySelector('.v9-exp-titulo').onclick=()=>{box.classList.toggle('fechado');atualizarExpansao();};
 box.querySelectorAll('button[data-cidade]').forEach(b=>b.onclick=()=>{const f=A.geo.features.find(x=>cityName(x)===b.dataset.cidade);if(f)A.maps.rede.fitBounds(L.geoJSON(f).getBounds(),{padding:[40,40],maxZoom:11});});
}
function atualizarLegenda(verRede,verBenef){
 const box=A.controles.legenda;if(!box)return;
 if(!(verRede&&verBenef)){box.hidden=true;return;}
 box.innerHTML=`<strong>Comparação</strong><div><i style="background:linear-gradient(90deg,#ffe08a,#ffb020,#ff6a1a,#e8003d)"></i>Beneficiários (vidas)</div><div><i style="background:linear-gradient(90deg,#1238b8,#1f6bff,#00e5ff,#e6fdff)"></i>Rede credenciada</div><small>Laranja sem ciano por perto = vidas longe da rede</small>`;
 box.hidden=false;
}
const CORES_REDE={'Hospitais':'#168bff','Clínicas':'#33c95a','Laboratórios':'#ad64ed','Outros':'#ffae38'};
const SIMBOLOS_REDE={'Hospitais':'H','Clínicas':'C','Laboratórios':'L','Outros':'O'};
const urgTexto=u=>[...u.urgencias].map(v=>v==='NAO'?'NÃO':v==='NAO INFORMADO'?'não informada':v).join(' / ');
/* Janela da rede (clique no Rio no mapa 01): unidades dos filtros atuais sobre o mapa de ruas,
   posicionadas pelo bairro (mesma busca no Nominatim da janela de bairros); sem bairro, centro do município */
function openRedeEstado(){if(!R.loaded)return;closeModal();
 const units=[...R.filtered].sort((a,b)=>(a.cidade==='RIO DE JANEIRO'?-1:b.cidade==='RIO DE JANEIRO'?1:0)||a.cidade.localeCompare(b.cidade,'pt-BR')||a.nome.localeCompare(b.nome,'pt-BR'));
 const cidades=new Set(units.map(u=>u.cidade)).size,element=document.createElement('div');element.className='v9-overlay';
 element.innerHTML=`<div class="v9-dialog" role="dialog" aria-modal="true"><header><div><strong>ESTADO DO RIO DE JANEIRO — REDE CREDENCIADA</strong><small>${fmt(units.length)} ${units.length===1?'unidade':'unidades'} nos filtros do mapa 01 · ${fmt(cidades)} municípios</small></div><button class="v9-close" type="button">Fechar ×</button></header><p>Posição aproximada pelo bairro de cada prestador, utilizando referências públicas. Sem bairro informado, a unidade fica no centro do município.</p><div class="v9-grid"><div id="v9-detail-map"></div><aside><strong>UNIDADES DA REDE</strong><div class="v9-progress">Preparando localização...</div><div class="v9-rede-lista">${units.map((u,i)=>`<button type="button" data-i="${i}"><i style="--pin:${CORES_REDE[u.categoria]}">${SIMBOLOS_REDE[u.categoria]}</i><span>${esc(u.nome)}<small>${esc([u.bairro,u.cidade].filter(Boolean).join(' — '))}${u.urgencias.has('SIM')?' · Urgência':''}</small></span></button>`).join('')}</div></aside></div></div>`;
 document.body.appendChild(element);const modal={element,map:null,closed:false};A.modal=modal;
 element.querySelector('.v9-close').onclick=closeModal;element.onclick=e=>{if(e.target===element)closeModal();};
 const map=L.map(element.querySelector('#v9-detail-map'),{zoomControl:true}).setView([-22.45,-42.85],8);modal.map=map;
 L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© OpenStreetMap contributors'}).addTo(map);
 setTimeout(()=>map.invalidateSize(),100);
 const progress=element.querySelector('.v9-progress');
 if(!units.length){progress.textContent='Nenhuma unidade nos filtros atuais.';return;}
 const markers=[];
 element.querySelector('.v9-rede-lista').addEventListener('click',e=>{const b=e.target.closest('button[data-i]');if(!b)return;const m=markers[b.dataset.i];if(!m){progress.textContent='Esta unidade ainda está sendo localizada…';return;}map.setView(m.getLatLng(),Math.max(map.getZoom(),14));m.openPopup();});
 // Um ponto por bairro + município; unidades do mesmo bairro ficam em volta dele
 const lugares=new Map();units.forEach((u,i)=>{const key=u.cidade+'|'+norm(u.bairro);if(!lugares.has(key))lugares.set(key,{cidade:u.cidade,bairro:norm(u.bairro),itens:[]});lugares.get(key).itens.push(i);});
 // Igual à janela de bairros do mapa 02: mapa de calor por bairro (mais unidades = mais quente) e um ponto por unidade
 const maxItens=Math.max(1,...[...lugares.values()].map(l=>l.itens.length));
 const bounds=[],heatPoints=[];let feitos=0,porBairro=0;
 (async()=>{for(const lugar of lugares.values()){if(modal.closed)return;
  let pos=lugar.bairro?await geocode(lugar.bairro,lugar.cidade):null;if(modal.closed)return;
  if(pos)porBairro++;else{const c=A.centers.get(lugar.cidade);pos=c?[c.lat,c.lng]:null;}
  feitos++;
  if(pos){
   heatPoints.push([pos[0],pos[1],heatIntensity(lugar.itens.length,maxItens)]);
   if(modal.heat)map.removeLayer(modal.heat);
   modal.heat=L.heatLayer(heatPoints,{radius:42,blur:18,max:.68,minOpacity:.40,gradient:heatGradient()}).addTo(map);
   lugar.itens.forEach((i,j)=>{const u=units[i],ang=j*2.4,raio=j?0.0012*Math.sqrt(j):0,lat=pos[0]+raio*Math.sin(ang),lng=pos[1]+raio*Math.cos(ang);bounds.push([lat,lng]);
   markers[i]=L.circleMarker([lat,lng],{radius:4,color:'#fff',weight:1,fillColor:'#ff3045',fillOpacity:1})
    .bindTooltip(esc(u.nome),{direction:'top'})
    .bindPopup(`<div class="rede-popup"><strong>${esc(u.nome)}</strong><p>${esc([u.bairro,u.cidade].filter(Boolean).join(' — '))}${u.endereco?'<br>'+esc([u.endereco,u.numero].filter(Boolean).join(', ')):''}</p><small>${esc([...u.classes].join(' / '))} · Urgência: ${esc(urgTexto(u))}${u.esps.size?'<br>'+esc([...u.esps].join(', ')):''}</small></div>`,{maxWidth:320})
    .addTo(map);});}
  progress.textContent=`Localizados ${feitos} de ${lugares.size} bairros (${porBairro} pelo bairro)`;
  if(feitos===Math.min(lugares.size,10)&&bounds.length>1)map.fitBounds(bounds,{padding:[35,35],maxZoom:12});
 }
 if(bounds.length>1)map.fitBounds(bounds,{padding:[35,35],maxZoom:12});else if(bounds.length)map.setView(bounds[0],13);
 progress.textContent=`${lugares.size} locais processados: ${porBairro} pelo bairro, ${lugares.size-porBairro} pelo centro do município. Clique numa unidade para ir até ela.`;
 })();
}
/* Mapa 01: rede (calor frio + marcadores) e, se importados, beneficiários (calor quente) por baixo.
   Só uma camada visível = gradiente original; as duas juntas = cada uma com a sua cor. */
function drawRede(fit=false){const k='rede',map=A.maps[k],d=A.data;if(!map||!A.geo||(!R.loaded&&!d))return;clear(k);
 const verRede=R.loaded&&A.camadas.rede,verBenef=!!d&&A.camadas.benef,comparar=verRede&&verBenef;
 const porCidade=new Map();if(R.loaded)for(const u of R.filtered){if(!porCidade.has(u.cidade))porCidade.set(u.cidade,[]);porCidade.get(u.cidade).push(u);}
 const vidasDe=name=>d?.cities.get(name)||0;
 const max=Math.max(1,...[...porCidade.values()].map(l=>l.length)),maxV=Math.max(1,...(d?[...d.cities.values()]:[1]));
 const points=[],pointsV=[];
 A.boundaries[k]=L.geoJSON(A.geo,{pane:'v9borders',style:f=>{const name=cityName(f),n=(porCidade.get(name)||[]).length,v=vidasDe(name),ativo=(verRede&&n)||(verBenef&&v);return {color:ativo?'#44647c':'#283d57',weight:ativo?.95:.6,fillColor:'#10213d',fillOpacity:.035,interactive:true};},onEachFeature:(f,layer)=>{
  const name=cityName(f),list=porCidade.get(name)||[],v=vidasDe(name);
  layer.bindTooltip(tipRede(name,list,v),{sticky:true,direction:'top',opacity:.98,className:'v9-tooltip'});
  if(abreEstado(name)){
   layer.on('click',()=>R.loaded?openRedeEstado():openBairrosEstado());
   layer.on('mouseover',()=>layer.setStyle({weight:2.5,color:'#39d8f5'}));
   layer.on('mouseout',()=>A.boundaries[k]?.resetStyle(layer));
  }
  const center=A.centers.get(name)||layer.getBounds().getCenter();
  if(list.length)points.push({n:list.length,center});
  if(v)pointsV.push({n:v,center});
 }}).addTo(map);
 // Beneficiários: mancha larga e suave por baixo (pane 345)
 if(verBenef&&pointsV.length){
  A.heatsB[k]=L.heatLayer(pointsV.map(p=>[p.center.lat,p.center.lng,heatIntensity(p.n,maxV)]),comparar?{pane:'v9heatB',radius:38,blur:22,max:.6,maxZoom:12,minOpacity:.55,gradient:GRAD_BENEF}:{pane:'v9heatB',radius:34,blur:17,max:.68,maxZoom:12,minOpacity:.40,gradient:heatGradient()}).addTo(map);
 }
 // Rede: ponto mais concentrado por cima (pane 350)
 if(verRede&&A.mode[k]!=='marcadores'&&points.length){
  A.heats[k]=L.heatLayer(points.map(p=>[p.center.lat,p.center.lng,heatIntensity(p.n,max)]),comparar?{pane:'v9heat',radius:17,blur:10,max:.6,maxZoom:12,minOpacity:.6,gradient:GRAD_REDE}:{pane:'v9heat',radius:34,blur:17,max:.68,maxZoom:12,minOpacity:.40,gradient:heatGradient()}).addTo(map);
 }
 atualizarLegenda(verRede,verBenef);atualizarExpansao();
 const semMunicipio=R.loaded?R.filtered.filter(u=>!A.centers.has(u.cidade)):[];
 put('avisoRede',semMunicipio.length?`${fmt(semMunicipio.length)} sem município reconhecido no mapa: ${[...new Set(semMunicipio.map(u=>u.cidade||'(vazio)'))].join(', ')}`:'');
 if(fit){
  const cidade=$('filtroMunicipio').value,feat=cidade&&A.geo.features.find(f=>cityName(f)===cidade);
  const b=feat?L.geoJSON(feat).getBounds():A.boundaries[k].getBounds();
  if(b.isValid())map.fitBounds(b,{padding:[20,20],maxZoom:11,animate:false});
 }
 $('placeholderRede')?.classList.add('oculto');
 drawProviders();
 requestAnimationFrame(()=>map.invalidateSize());
}
/* Marcadores: agrupados por proximidade e categoria; todas as unidades aparecem no balão */
function drawProviders(){
 const map=A.maps.rede;if(!map)return;
 if(R.layer){map.removeLayer(R.layer);R.layer=null;}
 if(!R.loaded||!A.geo||A.mode.rede==='calor'||!A.camadas.rede){put('modoRede','');return;}
 R.layer=L.layerGroup().addTo(map);
 const zoom=map.getZoom(),cell=zoom<=8?180:zoom<=9?110:64;
 const buckets=new Map();
 for(const u of R.filtered){const anchor=A.centers.get(u.cidade);if(!anchor)continue;const p=map.project(anchor,zoom);const key=[u.categoria,Math.floor(p.x/cell),Math.floor(p.y/cell)].join('|');
  if(!buckets.has(key))buckets.set(key,{cat:u.categoria,anchor,units:[],cities:new Set()});
  const g=buckets.get(key);g.units.push(u);g.cities.add(u.cidade);}
 put('modoRede',zoom<=8?'Marcadores agrupados • amplie para detalhar':'Marcadores por proximidade');
 const colors={'Hospitais':'#168bff','Clínicas':'#33c95a','Laboratórios':'#ad64ed','Outros':'#ffae38'};
 const symbols={'Hospitais':'H','Clínicas':'C','Laboratórios':'L','Outros':'O'};
 const offsets=[[0,-28],[-26,-28],[26,-28],[-52,-28],[52,-28],[0,-57],[-26,-57],[26,-57],[-52,-57],[52,-57],[0,-86],[-26,-86],[26,-86]];
 const used=[];
 for(const {cat,anchor,units,cities} of buckets.values()){
  const origin=map.latLngToContainerPoint(anchor);let off=offsets[0];
  for(const o of offsets){off=o;if(used.every(p=>Math.hypot(p.x-origin.x-o[0],p.y-origin.y-o[1])>25))break;}
  used.push({x:origin.x+off[0],y:origin.y+off[1]});
  const raised=map.containerPointToLatLng(L.point(origin.x+off[0],origin.y+off[1]));
  L.polyline([anchor,raised],{color:'#b9cde0',weight:1,opacity:.6,interactive:false}).addTo(R.layer);
  const local=cities.size===1?[...cities][0]:`${fmt(cities.size)} municípios próximos`;
  units.sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
  const itens=units.slice(0,100).map(u=>`<li><strong>${esc(u.nome)}</strong><br>${esc(u.cidade)}${u.bairro?' — '+esc(u.bairro):''}${u.endereco?' — '+esc([u.endereco,u.numero].filter(Boolean).join(', ')):''}<br><small>${esc([...u.classes].join(' / '))} · Urgência: ${esc([...u.urgencias].map(v=>v==='NAO'?'NÃO':v==='NAO INFORMADO'?'não informada':v).join(' / '))}${u.esps.size?'<br>'+esc([...u.esps].join(', ')):''}</small></li>`).join('');
  const html=`<div class="rede-pin-small" style="--pin:${colors[cat]}"><b>${symbols[cat]}</b></div>`;
  L.marker(raised,{icon:L.divIcon({className:'rede-marker-small',html,iconSize:[20,25],iconAnchor:[10,25]}),zIndexOffset:400,keyboard:true,title:`${cat}: ${units.length} em ${local}`})
   .bindTooltip(`${esc(cat)} • ${esc(local)}<br>${fmt(units.length)} ${units.length===1?'unidade':'unidades'} • clique para ver`,{direction:'top',offset:[0,-23]})
   .bindPopup(`<div class="rede-popup"><strong>${esc(cat)} — ${esc(local)}</strong><p>${fmt(units.length)} ${units.length===1?'unidade':'unidades'}. Posição aproximada (centro do município).</p><ul>${itens}</ul>${units.length>100?'<p>Exibindo as primeiras 100. Use os filtros para refinar.</p>':''}</div>`,{maxWidth:370,autoPan:true})
   .addTo(R.layer);
 }
}
async function importRede(e){const file=e.target.files?.[0];if(!file)return;const request=++R.request;status('Lendo rede...');try{
 await libraries();const book=XLSX.read(await file.arrayBuffer(),{type:'array'}),rows=readRede(book);if(!rows.length)throw Error('Planilha da rede sem prestadores do RJ');if(request!==R.request)return;
 R.rows=rows;R.loaded=true;fillFilters();put('arquivoRedeNome',file.name);status('Carregando mapa da rede...');
 await ensureMaps();if(request!==R.request)return;renderRede(true);status('Rede carregada no mapa 01',true);
 }catch(err){console.error(err);status('Erro: '+err.message);}finally{e.target.value='';}}

/* ---------- Estilos injetados e início ---------- */
function styles(){if($('v9-styles'))return;const s=document.createElement('style');s.id='v9-styles';s.textContent=`
.map-panel-footer,.assefaz-legend{display:none!important}
.leaflet-pane.leaflet-v9heat-pane{pointer-events:none!important}
.leaflet-v9heat-pane canvas{pointer-events:none!important}
.v9-tooltip{background:#101c34!important;border:1px solid #466783!important;color:#fff!important;border-radius:7px!important;box-shadow:0 5px 15px #0009!important}
.v9-tip{display:flex;flex-direction:column;gap:5px;font:12px Arial,sans-serif;color:#fff}.v9-tip strong{font-size:13px}.v9-tip span{color:#33e2fa;font-weight:700;font-size:16px}.v9-tip small{color:#b7c8dd}
.v9-overlay{position:fixed;inset:0;z-index:99999;background:#020714e8;display:flex;align-items:center;justify-content:center;padding:15px;box-sizing:border-box}
.v9-dialog{width:min(1150px,98vw);height:min(780px,95vh);background:#101a31;border:1px solid #345170;border-radius:12px;color:#fff;display:flex;flex-direction:column;overflow:hidden;font:13px Arial,sans-serif}
.v9-dialog header{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:16px;border-bottom:1px solid #34435c}
.v9-dialog header strong{display:block;font-size:17px}.v9-dialog header small{display:block;color:#a9c2dc;margin-top:5px}
.v9-dialog header button{border:1px solid #426484;border-radius:7px;padding:9px 13px;background:#1c3653;color:#fff;cursor:pointer}
.v9-dialog>p{color:#b8cce1;padding:10px 16px;margin:0}
.v9-grid{display:grid;grid-template-columns:minmax(0,1fr) 270px;gap:10px;min-height:0;flex:1;padding:10px}
#v9-detail-map{min-height:300px;border-radius:8px;overflow:hidden}
.v9-grid aside{min-height:0;overflow:auto;padding:12px;border-radius:8px;background:#152540}
.v9-progress{font-size:11px;color:#9cc4e1;margin:10px 0}.v9-rank>div{display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid #30405b;padding:8px 0}.v9-rank b{color:#35ddf5}
.v9-rede-lista button{display:flex;gap:9px;align-items:flex-start;width:100%;text-align:left;background:none;border:0;border-bottom:1px solid #30405b;color:#fff;padding:8px 2px;cursor:pointer;font:12px Arial,sans-serif}
.v9-rede-lista button:hover{background:#1b3050}.v9-rede-lista button:focus-visible{outline:2px solid #35ddf5;outline-offset:-2px}
.v9-rede-lista i{flex:0 0 18px;height:18px;border-radius:50%;background:var(--pin);display:grid;place-items:center;font:700 10px Arial,sans-serif;font-style:normal}
.v9-rede-lista small{display:block;color:#a9c2dc;margin-top:3px;font-size:11px}
.v9-tip .tip-rede{color:#33e2fa}.v9-tip .tip-benef{color:#ff9a3c}.v9-tip .tip-razao{color:#fff;font-weight:700}
.map-camada{display:inline-flex;align-items:center;gap:6px;min-height:28px;padding:5px 11px;border:0;border-radius:6px;background:transparent;color:#7f93ad;font:600 11px Arial,sans-serif;cursor:pointer;opacity:.55}
.map-camada i{width:10px;height:10px;border-radius:50%;background:var(--cor);box-shadow:0 0 6px var(--cor)}
.map-camada.active{opacity:1;color:#fff;background:#1b3050}.map-camada:hover{background:#1b3050}
.v9-comp-legenda,.v9-expandir{background:#101c34ee;border:1px solid #345170;border-radius:8px;color:#fff;font:11px Arial,sans-serif;box-shadow:0 5px 15px #0008}
.v9-comp-legenda{padding:9px 11px;display:flex;flex-direction:column;gap:6px;max-width:220px}
.v9-comp-legenda div{display:flex;align-items:center;gap:8px}.v9-comp-legenda i{flex:0 0 46px;height:9px;border-radius:5px}.v9-comp-legenda small{color:#a9c2dc}
.v9-expandir{width:215px;max-height:var(--altura-exp,300px);overflow:auto}
.v9-exp-titulo{display:flex;justify-content:space-between;width:100%;background:none;border:0;color:#fff;font:700 12px Arial,sans-serif;padding:9px 11px;cursor:pointer}
.v9-expandir.fechado .v9-exp-corpo{display:none}
.v9-exp-corpo{padding:0 11px 9px}.v9-exp-corpo>small{color:#a9c2dc}
.v9-exp-corpo ol{margin:6px 0 0;padding:0 0 0 18px}.v9-exp-corpo li{border-bottom:1px solid #30405b}
.v9-exp-corpo li button{display:grid;grid-template-columns:1fr auto;gap:2px 8px;width:100%;background:none;border:0;color:#fff;text-align:left;padding:6px 0;cursor:pointer;font:11px Arial,sans-serif}
.v9-exp-corpo li button:hover span{color:#33e2fa}.v9-exp-corpo b{color:#ff9a3c}.v9-exp-corpo em{grid-column:1/-1;font-style:normal;color:#8fd8ea}.v9-exp-corpo em.sem{color:#ff5c7a;font-weight:700}
@media(max-width:700px){.v9-expandir{width:200px}.v9-comp-legenda{max-width:180px}}
@media(max-width:700px){.v9-grid{grid-template-columns:1fr;grid-template-rows:minmax(250px,1fr) 180px}}
`;document.head.appendChild(s);}
function init(){styles();document.querySelectorAll('.map-panel-footer').forEach(e=>e.remove());
 $('arquivoExcel')?.addEventListener('change',importExcel);
 $('arquivoRede')?.addEventListener('change',importRede);
 for(const k of ['rede','estado']){const suffix=k==='rede'?'Rede':'Estado';for(const m of ['Calor','Bolhas','Marcadores','Ambos'])$('btn'+m+suffix)?.addEventListener('click',()=>setMode(k,m.toLowerCase()));$('btnReset'+suffix)?.addEventListener('click',()=>draw(k,true));}
 for(const id of ['filtroUrgencia','filtroClasse','filtroEspecialidade'])$(id)?.addEventListener('change',()=>renderRede());
 $('filtroMunicipio')?.addEventListener('change',()=>renderRede(true));
 for(const [id,camada] of [['camadaRede','rede'],['camadaBenef','benef']])$(id)?.addEventListener('click',e=>{A.camadas[camada]=!A.camadas[camada];e.currentTarget.classList.toggle('active',A.camadas[camada]);e.currentTarget.setAttribute('aria-pressed',String(A.camadas[camada]));drawRede();});
 $('limparFiltros')?.addEventListener('click',()=>{for(const id of ['filtroUrgencia','filtroClasse','filtroEspecialidade','filtroMunicipio'])$(id).value='';renderRede(true);});
 window.addEventListener('resize',()=>{for(const m of Object.values(A.maps))m?.invalidateSize({pan:false});});
 status('Aguardando importação');}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
