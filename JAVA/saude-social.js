
/* ASSEFAZ — Distribuição Geográfica V9 | BAIRRO, CIDADE, ESTADO */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const norm = v => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase().replace(/\s+/g,' ');
const fmt = n => Number(n || 0).toLocaleString('pt-BR');
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const METRO = new Set('RIO DE JANEIRO|NITEROI|SAO GONCALO|DUQUE DE CAXIAS|NOVA IGUACU|SAO JOAO DE MERITI|BELFORD ROXO|NILOPOLIS|MESQUITA|QUEIMADOS|JAPERI|SEROPEDICA|ITAGUAI|MAGE|GUAPIMIRIM|ITABORAI|TANGUA|MARICA|CACHOEIRAS DE MACACU|RIO BONITO|PARACAMBI|PETROPOLIS'.split('|'));
const GEO_URL = 'https://raw.githubusercontent.com/tbrugz/geodata-br/master/geojson/geojs-33-mun.json';
const A = {data:null,geo:null,maps:{},boundaries:{},heats:{},bubbles:{},labels:{},points:{},mode:{metro:'calor',estado:'calor'},modal:null,cache:new Map(),queue:Promise.resolve(),request:0};
const put=(id,v)=>{if($(id))$(id).textContent=v;};
function status(msg,ok=false){put('statusBase',msg);const dot=$('statusDot');if(dot){dot.classList.toggle('ativo',ok);dot.classList.toggle('erro',!ok&&msg.startsWith('Erro'));}}
function script(url,test){if(test())return Promise.resolve();return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=url;s.onload=()=>test()?resolve():reject(Error('Falha na biblioteca'));s.onerror=()=>reject(Error('Não foi possível carregar '+url));document.head.appendChild(s);});}
async function libraries(){
 if(!document.querySelector('link[href*="leaflet.css"]')){const l=document.createElement('link');l.rel='stylesheet';l.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';document.head.appendChild(l);}
 await script('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',()=>!!window.L);
 await script('https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js',()=>!!window.L?.heatLayer);
 await script('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',()=>!!window.XLSX);
}
function readExcel(book){for(const sheet of book.SheetNames){const rows=XLSX.utils.sheet_to_json(book.Sheets[sheet],{header:1,defval:'',raw:false,blankrows:false});for(let i=0;i<Math.min(30,rows.length);i++){const h=rows[i].map(norm),b=h.indexOf('BAIRRO'),c=h.findIndex(x=>x==='CIDADE'||x==='MUNICIPIO'),u=h.findIndex(x=>x==='ESTADO'||x==='UF');if(b<0||c<0||u<0)continue;return rows.slice(i+1).filter(r=>r.some(x=>String(x??'').trim())).map(r=>({bairro:norm(r[b]),cidade:norm(r[c]),uf:norm(r[u])}));}}throw Error('Não encontrei as colunas BAIRRO, CIDADE e ESTADO.');}
function aggregate(rows){const cities=new Map(),bairros=new Map();let rj=0,metro=0;for(const r of rows){if(!['RJ','RIO DE JANEIRO'].includes(r.uf))continue;rj++;if(r.cidade)cities.set(r.cidade,(cities.get(r.cidade)||0)+1);if(METRO.has(r.cidade))metro++;if(r.cidade&&r.bairro){const k=r.cidade+'|'+r.bairro;bairros.set(k,(bairros.get(k)||0)+1);}}return {total:rows.length,rj,metro,cities,bairros};}
function indicators(d){put('totalVidas',fmt(d.total));put('vidasRJ',fmt(d.rj));put('vidasMetropolitana',fmt(d.metro));put('totalMunicipios',fmt(d.cities.size));put('totalMapaMetropolitano',fmt(d.metro));put('totalMapaEstado',fmt(d.rj));put('totalBairrosMetro',fmt([...d.bairros.keys()].filter(k=>METRO.has(k.split('|')[0])).length));put('municipiosMapaEstado',fmt(d.cities.size));}
function cityName(f){const p=f.properties||{};for(const k of ['name','nome','NM_MUN','NM_MUNICIP','municipio','MUNICIPIO','NOME'])if(p[k])return norm(p[k]);return '';}
function popup(name,n,metro){return `<div class="v9-tip"><strong>${esc(name)}</strong><span>${fmt(n)} vidas</span>${metro&&['RIO DE JANEIRO','NITEROI'].includes(name)?'<small>Clique para explorar os bairros</small>':''}</div>`;}
function initMaps(){if(A.maps.metro)return;for(const [k,id] of [['metro','mapaMetropolitano'],['estado','mapaEstado']]){
 const map=L.map(id,{preferCanvas:true,zoomControl:true,attributionControl:false,zoomSnap:.25}).setView(k==='metro'?[-22.85,-43.3]:[-22.65,-42.8],k==='metro'?9:8);
 map.getContainer().style.background='radial-gradient(ellipse at center,#102444,#08152b)';
 map.createPane('v9heat');map.getPane('v9heat').style.zIndex='350';map.getPane('v9heat').style.pointerEvents='none';
 map.createPane('v9borders');map.getPane('v9borders').style.zIndex='410';
 map.createPane('v9labels');map.getPane('v9labels').style.zIndex='650';map.getPane('v9labels').style.pointerEvents='none';
 A.maps[k]=map;map.on('moveend zoomend resize',()=>drawLabels(k));
 }}
function clear(k){for(const dict of [A.boundaries,A.heats,A.bubbles,A.labels])if(dict[k]){A.maps[k].removeLayer(dict[k]);dict[k]=null;}}
function heatIntensity(n,max){if(n<=0)return 0;return Math.max(.12,Math.pow(n/max,.42));}
function heatGradient(){return {0:'#1946c8',.15:'#1677ed',.30:'#00c9f5',.47:'#25e68e',.60:'#d9f53a',.72:'#ffe132',.84:'#ff8b20',.94:'#f04425',1:'#f20d22'};}
function draw(k,fit=false){const map=A.maps[k],d=A.data;if(!map||!d||!A.geo)return;clear(k);
 const metro=k==='metro',features=A.geo.features.filter(f=>!metro||METRO.has(cityName(f)));
 const max=Math.max(1,...features.map(f=>d.cities.get(cityName(f))||0));
 const points=[];
 A.boundaries[k]=L.geoJSON({type:'FeatureCollection',features},{pane:'v9borders',style:f=>{const n=d.cities.get(cityName(f))||0;return {color:n?'#44647c':'#283d57',weight:n?.95:.6,fillColor:'#10213d',fillOpacity:.035,interactive:true};},onEachFeature:(f,layer)=>{
  const name=cityName(f),n=d.cities.get(name)||0;
  layer.bindTooltip(popup(name,n,metro),{sticky:true,direction:'top',opacity:.98,className:'v9-tooltip'});
  layer.on('click',e=>{if(metro&&['RIO DE JANEIRO','NITEROI'].includes(name))openBairros(name);else L.popup({maxWidth:230}).setLatLng(e.latlng).setContent(popup(name,n,false)).openOn(map);});
  if(metro&&['RIO DE JANEIRO','NITEROI'].includes(name))layer.on('mouseover',()=>layer.setStyle({weight:2.5,color:'#39d8f5'}));
  layer.on('mouseout',()=>A.boundaries[k]?.resetStyle(layer));
  if(n){const center=layer.getBounds().getCenter();points.push({name,n,center});}
 }}).addTo(map);
 A.points[k]=points;
 if(A.mode[k]!=='bolhas'&&points.length){
  A.heats[k]=L.heatLayer(points.map(p=>[p.center.lat,p.center.lng,heatIntensity(p.n,max)]),{
   pane:'v9heat',radius:metro?42:34,blur:metro?19:17,max:.68,maxZoom:12,minOpacity:.40,gradient:heatGradient()
  }).addTo(map);
 }
 if(A.mode[k]!=='calor'){
  A.bubbles[k]=L.layerGroup().addTo(map);
  for(const p of points)L.circleMarker(p.center,{pane:'v9borders',radius:Math.max(5,Math.min(23,4+18*Math.sqrt(p.n/max))),color:'#fff',weight:1,fillColor:p.n===max?'#ff243a':'#00c9f5',fillOpacity:.8}).bindTooltip(popup(p.name,p.n,metro),{className:'v9-tooltip'}).on('click',e=>{L.DomEvent.stopPropagation(e);if(metro&&['RIO DE JANEIRO','NITEROI'].includes(p.name))openBairros(p.name);else L.popup().setLatLng(e.latlng).setContent(popup(p.name,p.n,false)).openOn(map);}).addTo(A.bubbles[k]);
 }
 if(fit){const b=A.boundaries[k].getBounds();if(b.isValid())map.fitBounds(b,{padding:[20,20],animate:false});}
 $(metro?'placeholderMetro':'placeholderEstado')?.classList.add('oculto');
 requestAnimationFrame(()=>{map.invalidateSize();drawLabels(k);});
}
function drawLabels(k){const map=A.maps[k];if(!map)return;if(A.labels[k]){map.removeLayer(A.labels[k]);A.labels[k]=null;}
 if(k==='estado'||!A.points[k])return;
 const chosen=A.points[k].filter(p=>['RIO DE JANEIRO','NITEROI'].includes(p.name));if(!chosen.length)return;
 const size=map.getSize(),g=L.layerGroup().addTo(map);A.labels[k]=g;
 for(const p of chosen){const rio=p.name==='RIO DE JANEIRO',w=142,h=44,x=rio?Math.min(size.x-75,100):Math.max(75,size.x-100),y=40;
  const center=L.point(x,y),edge=L.point(rio?x+w/2:x-w/2,y);
  const color=rio?'#20ddf5':'#ff6478';
  L.polyline([p.center,map.containerPointToLatLng(edge)],{pane:'v9labels',color,weight:1.4,opacity:.9,dashArray:'4,4',interactive:false}).addTo(g);
  L.circleMarker(p.center,{pane:'v9labels',radius:3,fillColor:color,fillOpacity:1,color:'#fff',weight:1,interactive:false}).addTo(g);
  const html=`<div class="v9-label" style="--accent:${color}"><span>${esc(p.name)}</span><strong>${fmt(p.n)} vidas</strong></div>`;
  L.marker(map.containerPointToLatLng(center),{pane:'v9labels',interactive:false,keyboard:false,icon:L.divIcon({className:'v9-label-icon',html,iconSize:[w,h],iconAnchor:[w/2,h/2]})}).addTo(g);
 }
}
function closeModal(){if(!A.modal)return;A.modal.closed=true;A.modal.map?.remove();A.modal.element.remove();A.modal=null;}
/* Janela de bairros (Rio de Janeiro e Niterói).
   As posições vêm da tabela local BAIRROS_RJ (bairros-rj.js, malha oficial do IBGE)
   e as variações de escrita da planilha são resolvidas pelo bairros-localizar.js.
   Antes cada bairro era buscado na internet (Nominatim), um por vez, com 1,15 s
   de espera entre as buscas: o Rio levava ~4 min. Agora a janela abre na hora,
   sem internet para as posições, e nenhum nome de bairro sai do navegador. */
function openBairros(city){closeModal();if(!A.data)return;
 const LB=window.LocalizarBairro;
 /* junta as variações do mesmo bairro ("VL ISABEL" + "VILA ISABEL") pelo nome oficial */
 const grupos=new Map();
 for(const [key,n] of A.data.bairros){if(!key.startsWith(city+'|'))continue;
  const original=key.split('|')[1],oficial=LB?LB.nomeOficial(city,original):null,nome=oficial||original;
  const g=grupos.get(nome)||{bairro:nome,n:0,pos:oficial?LB.posicao(city,original):null};g.n+=n;grupos.set(nome,g);}
 const list=[...grupos.values()].sort((a,b)=>b.n-a.n);
 const noMapa=list.filter(p=>p.pos),semPos=list.length-noMapa.length;
 const total=list.reduce((s,p)=>s+p.n,0),vidasNoMapa=noMapa.reduce((s,p)=>s+p.n,0),element=document.createElement('div');element.className='v9-overlay';
 element.innerHTML=`<div class="v9-dialog" role="dialog" aria-modal="true"><header><div><strong>${esc(city)} — CONCENTRAÇÃO POR BAIRRO</strong><small>${fmt(total)} vidas com bairro informado · ${fmt(list.length)} bairros</small></div><button class="v9-close" type="button">Fechar ×</button></header><p>Mapa aproximado: um ponto por bairro, pela malha oficial de bairros do IBGE (Censo 2022). Não representa endereços individuais.</p><div class="v9-grid"><div id="v9-detail-map"></div><aside><strong>BAIRROS COM MAIS VIDAS</strong><div class="v9-progress"></div><div class="v9-rank">${list.map(p=>`<div${p.pos?'':' class="v9-sem-pos" title="Bairro não reconhecido: as vidas contam na lista, mas não aparecem no mapa"'}><span>${esc(p.bairro)}${p.pos?'':'<small>sem localização no mapa</small>'}</span><b>${fmt(p.n)}</b></div>`).join('')}</div></aside></div></div>`;
 document.body.appendChild(element);const modal={element,map:null,closed:false};A.modal=modal;
 element.querySelector('.v9-close').onclick=closeModal;element.onclick=e=>{if(e.target===element)closeModal();};
 const progresso=element.querySelector('.v9-progress');
 const center=city==='NITEROI'?[-22.90,-43.10]:[-22.93,-43.35];
 const map=L.map(element.querySelector('#v9-detail-map'),{zoomControl:true,attributionControl:false,preferCanvas:true}).setView(center,11);modal.map=map;
 /* Fundo no mesmo estilo dos mapas da página: escuro, com o contorno dos municípios
    (o mesmo GeoJSON já carregado na importação). O mapa de ruas do OpenStreetMap foi
    tirado em 05/11/2026: o servidor dele bloqueia ("403 Access blocked") páginas
    abertas direto do arquivo, que não se identificam. */
 map.getContainer().style.background='radial-gradient(ellipse at center,#102444,#08152b)';
 if(A.geo)L.geoJSON({type:'FeatureCollection',features:A.geo.features.filter(f=>METRO.has(cityName(f)))},{interactive:false,style:f=>{const esta=cityName(f)===city;return {color:esta?'#39d8f5':'#2b4363',weight:esta?1.6:.8,fillColor:esta?'#12305a':'#10213d',fillOpacity:esta?.35:.12};}}).addTo(map);
 if(!list.length){progresso.textContent='Nenhum bairro informado para este município.';setTimeout(()=>map.invalidateSize(),100);return;}
 /* tudo de uma vez: calor, pontos e enquadramento */
 const max=noMapa.length?noMapa[0].n:1;
 if(noMapa.length)modal.heat=L.heatLayer(noMapa.map(p=>[...p.pos,heatIntensity(p.n,max)]),{radius:42,blur:18,max:.68,minOpacity:.40,gradient:heatGradient()}).addTo(map);
 for(const p of noMapa)L.circleMarker(p.pos,{radius:4,color:'#fff',weight:1,fillColor:'#ff3045',fillOpacity:1}).bindTooltip(popup(p.bairro,p.n,false)).addTo(map);
 progresso.textContent=`${fmt(noMapa.length)} de ${fmt(list.length)} bairros no mapa (${fmt(vidasNoMapa)} de ${fmt(total)} vidas).`+(semPos?` ${fmt(semPos)} sem localização ficam só na lista.`:'');
 setTimeout(()=>{map.invalidateSize();if(noMapa.length>1)map.fitBounds(noMapa.map(p=>p.pos),{padding:[35,35],maxZoom:12});},100);
}
function setMode(k,mode){A.mode[k]=mode;const suffix=k==='metro'?'Metro':'Estado';for(const m of ['Calor','Bolhas','Ambos']){const b=$('btn'+m+suffix);if(b){const active=m.toLowerCase()===mode;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));}}draw(k);}
async function importExcel(e){const file=e.target.files?.[0];if(!file)return;const request=++A.request;closeModal();status('Lendo Excel...');try{
 await libraries();const book=XLSX.read(await file.arrayBuffer(),{type:'array'}),rows=readExcel(book);if(!rows.length)throw Error('Planilha sem registros');if(request!==A.request)return;
 A.data=aggregate(rows);indicators(A.data);put('nomeArquivo',file.name);put('ultimaAtualizacao',new Date().toLocaleString('pt-BR'));status('Carregando mapas...');
 initMaps();if(!A.geo){const response=await fetch(GEO_URL);if(!response.ok)throw Error('Não foi possível carregar os municípios');A.geo=await response.json();}
 if(request!==A.request)return;draw('metro',true);draw('estado',true);status('Planilha e mapas atualizados • V9',true);
 }catch(err){console.error(err);status('Erro: '+err.message);}finally{e.target.value='';}}
function styles(){if($('v9-styles'))return;const s=document.createElement('style');s.id='v9-styles';s.textContent=`
.map-panel-footer,.assefaz-legend{display:none!important}
.leaflet-pane.leaflet-v9heat-pane,.leaflet-pane.leaflet-v9labels-pane{pointer-events:none!important}
.leaflet-v9heat-pane canvas,.leaflet-v9labels-pane *{pointer-events:none!important}
.v9-tooltip{background:#101c34!important;border:1px solid #466783!important;color:#fff!important;border-radius:7px!important;box-shadow:0 5px 15px #0009!important}
.v9-tip{display:flex;flex-direction:column;gap:5px;font:12px Arial,sans-serif;color:#fff}.v9-tip strong{font-size:13px}.v9-tip span{color:#33e2fa;font-weight:700;font-size:16px}.v9-tip small{color:#b7c8dd}
.v9-label-icon{background:none!important;border:0!important;pointer-events:none!important}
.v9-label{width:142px;height:44px;border:1px solid var(--accent);border-radius:7px;background:rgba(8,16,35,.97);display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font:700 10px Arial,sans-serif;box-sizing:border-box;white-space:nowrap;box-shadow:0 3px 12px #0008}
.v9-label strong{font-size:14px;color:var(--accent);margin-top:3px}
.v9-overlay{position:fixed;inset:0;z-index:99999;background:#020714e8;display:flex;align-items:center;justify-content:center;padding:15px;box-sizing:border-box}
.v9-dialog{width:min(1150px,98vw);height:min(780px,95vh);background:#101a31;border:1px solid #345170;border-radius:12px;color:#fff;display:flex;flex-direction:column;overflow:hidden;font:13px Arial,sans-serif}
.v9-dialog header{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:16px;border-bottom:1px solid #34435c}
.v9-dialog header strong{display:block;font-size:17px}.v9-dialog header small{display:block;color:#a9c2dc;margin-top:5px}
.v9-dialog header button{border:1px solid #426484;border-radius:7px;padding:9px 13px;background:#1c3653;color:#fff;cursor:pointer}
.v9-dialog>p{color:#b8cce1;padding:10px 16px;margin:0}
.v9-grid{display:grid;grid-template-columns:minmax(0,1fr) 270px;gap:10px;min-height:0;flex:1;padding:10px}
#v9-detail-map{min-height:300px;border-radius:8px;overflow:hidden}
.v9-grid aside{min-height:0;overflow:auto;padding:12px;border-radius:8px;background:#152540}
.v9-progress{font-size:11px;color:#9cc4e1;margin:10px 0}.v9-rank .v9-sem-pos span{color:#8fa3c0}.v9-rank small{display:block;font-size:10px;color:#ffc56d;margin-top:2px}.v9-rank>div{display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid #30405b;padding:8px 0}.v9-rank b{color:#35ddf5}
@media(max-width:700px){.v9-grid{grid-template-columns:1fr;grid-template-rows:minmax(250px,1fr) 180px}}
`;document.head.appendChild(s);}
function init(){styles();document.querySelectorAll('.map-panel-footer').forEach(e=>e.remove());
 const input=$('arquivoExcel');if(!input){console.error('Não encontrei #arquivoExcel');return;}input.addEventListener('change',importExcel);
 for(const k of ['metro','estado']){const suffix=k==='metro'?'Metro':'Estado';for(const m of ['Calor','Bolhas','Ambos'])$('btn'+m+suffix)?.addEventListener('click',()=>setMode(k,m.toLowerCase()));$('btnReset'+suffix)?.addEventListener('click',()=>draw(k,true));}
 status('Aguardando importação');}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();