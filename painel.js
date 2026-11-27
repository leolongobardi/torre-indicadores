'use strict';

function startDashboard(){
const data=window.torreData;
const main=document.getElementById('main');
const n0=new Intl.NumberFormat('pt-BR');
const n1=new Intl.NumberFormat('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1});
const f=(v,d=1)=>v==null||!Number.isFinite(v)?'—':(d?n1:n0).format(v);
const min=v=>v==null?'—':f(v)+' min';
const hstr=v=>v==null?'—':f(Math.floor(Math.round(v)/60),0)+'h '+String(Math.round(v)%60).padStart(2,'0')+'min';
const text=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const iso=d=>d.slice(8)+'/'+d.slice(5,7);
const hour=n=>String(n%24).padStart(2,'0')+'h';
const station=['Puma','Monte Alegre'];
const stage=['Trajeto vazio','Carregamento','Movimento carregado','Descarga'];
const stageNames=['1 · Trajeto vazio','2 · Carregamento','3 · Movimento carregado','4 · Descarga'];
const parts=['Fila de carga','Fila crítica de carga','Carregamento','Amarração de carga'];
const green='#12805d', ochre='#b96b32', navy='#264e66';
const stageColors=['#6caf94','#167b55','#44778a','#bb743a'];
const xCycle={date:0,id:1,modal:2,meso:3,bloco:4,grua:5,dist:8,mask:9,steps:10};
const cycleMin=data.cycle.trips[0]?.[0]??'',cycleMax=data.cycle.trips.at(-1)?.[0]??'';
const activeFuel=data.fuel.day.at(-1)?.[0].slice(0,7)??'';
const dayRange=(a,b)=>Array.from(new Set(a.map(r=>r[0]))).filter(d=>d.startsWith(b)).sort();
const fuelDates=dayRange(data.fuel.day,activeFuel);
const cycleDates=dayRange(data.cycle.trips,'');
const fuelMonths=[...new Set(data.fuel.day.map(r=>r[0].slice(0,7)))];
const fuelYears=[...new Set(fuelMonths.map(d=>d.slice(0,4)))];
const monthLong=d=>new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(d+'-02T00:00:00Z'));
const monthShort=d=>new Intl.DateTimeFormat('pt-BR',{month:'short',timeZone:'UTC'}).format(new Date(d+'-02T00:00:00Z')).replace('.','');
const sum=(a,k)=>a.reduce((acc,r)=>acc+(r[k]??0),0);
const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
const percentile=(a,p)=>{
 if(!a.length)return null;
 const v=[...a].sort((x,y)=>x-y),i=(v.length-1)*p,q=Math.floor(i);
 return v[q]+(v[Math.ceil(i)]-v[q])*(i-q);
};
const series=(rows,k)=>rows.map(r=>r[k]).filter(v=>v!=null);
const validTrip=r=>r[9]===15&&r.slice(10,14).every(v=>v!=null);
const total=r=>r[10]+r[11]+r[12]+r[13];
const completeMinutes=rows=>rows.filter(validTrip).map(total);
const group=(rows,key)=>{
 const result=new Map();
 for(const r of rows){const k=key(r);if(!result.has(k))result.set(k,[]);result.get(k).push(r);}
 return result;
};
const timeHM=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(Math.floor(n%60)).padStart(2,'0');
const state={fuelTab:location.hash==='#postos/importacao'?'importacao':'visao',cycleTab:location.hash==='#ciclo/importacao'?'importacao':'visao',station:'all',basis:'all',scScope:'all',rank:'modal',loadRank:'meso',dropRank:'modal',quality:'all',page:1,
 outliers:'excluir',campoDia:cycleMax,postoDia:'',query:'',sort:'avg',up:false,modal:'',meso:'',bloco:'',grua:'',inicio:cycleMin,fim:cycleMax};
let charts=[],lastCaseRows=[];
const controller=new AbortController();
window.stopTorreDashboard=()=>controller.abort();
const opt={signal:controller.signal};
const nav=()=>location.hash.startsWith('#cadastro')?'cadastro':location.hash.startsWith('#ciclo')?'ciclo':'postos';
const tabs=(values,current)=>`<div class="tabs" aria-label="Seções">${values.map(([k,l])=>`<button data-tab="${k}" aria-pressed="${current===k}">${l}</button>`).join('')}</div>`;
const select=(key,label,v,opts)=>`<label>${label}<select data-change="${key}">${opts.map(([k,l])=>`<option value="${text(k)}"${String(k)===String(v)?' selected':''}>${text(l)}</option>`).join('')}</select></label>`;
const kpis=rows=>`<div class="kpis">${rows.map(([label,v,note=''])=>`<div class="kpi"><span>${label}</span><strong>${v}</strong>${note?`<small>${note}</small>`:''}</div>`).join('')}</div>`;
const panel=(title,sub,body,tools='')=>`<section class="panel"><div class="phead"><div><h2>${title}</h2>${sub?`<p>${sub}</p>`:''}</div>${tools}</div>${body}</section>`;
const table=(headers,rows,cls='')=>`<div class="tablewrap"><table class="${cls}"><thead><tr>${headers.map(label=>`<th scope="col">${label}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(row=>`<tr>${row.map(v=>`<td>${v}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${headers.length}" class="empty">Nenhum registro neste recorte</td></tr>`}</tbody></table></div>`;
const legend=items=>`<div class="legend">${items.map(([c,l])=>`<span><i style="background:${c}"></i>${l}</span>`).join('')}</div>`;
const heading=(title,sub,period)=>`<header class="top"><div><h1>${title}</h1><p class="sub">${sub}</p></div></header>`;
const note=s=>`<p class="note">${s}</p>`;
const footer=(s,content)=>`<footer class="sources"><details><summary>Fonte e critérios</summary>${content}</details><p>${s}</p></footer>`;
const pageRows=(rows,count=20)=>{
 const pages=Math.max(1,Math.ceil(rows.length/count)),curr=Math.min(state.page,pages);
 return [rows.slice((curr-1)*count,curr*count),`<div class="pagination"><button data-page="${curr-1}" ${curr<=1?'disabled':''}>Anterior</button><span>${f(curr,0)} de ${f(pages,0)} · ${f(rows.length,0)} registros</span><button data-page="${curr+1}" ${curr>=pages?'disabled':''}>Próxima</button></div>`];
};
function stacked(rows,colors,daily=false,cap=null){
 const peakVolume=Math.max(1,...rows.map(r=>r[4]||0));
 const max=cap||Math.max(1,...rows.map(r=>r[1].reduce((a,v)=>a+(v||0),0)));
 return `<div class="plot-scroll"><div class="column-chart ${daily?'daily':''}">${rows.map(([label,vals,details='',annual=false,volume=null])=>{
  const total=vals.reduce((a,v)=>a+(v||0),0);
  return `<div class="column-item ${annual?'annual':''}" title="${text(details)}">${volume==null?'':'<small class="vol-num" style="background:linear-gradient(to top,#dcebf3 '+(volume/peakVolume*100)+'%,transparent 0)">'+f(volume,0)+'</small>'}<div class="column-shaft"><b>${vals.every(v=>v==null)?'—':f(total)}</b><div class="bar-stack">${vals.map((v,j)=>`<i style="height:${Math.max(0,(v||0)/max*153)}px;background:${colors[j]}"></i>`).join('')}</div></div><span>${label}</span></div>`;
 }).join('')}</div></div>`;
}
function chart(label,draw,short=false){
 const index=charts.push(draw)-1;
 return `<canvas class="chart ${short?'short':''}" data-chart="${index}" role="img" aria-label="${label}">${label}</canvas>`;
}
function plot(el,max,labels,paint){
 const rect=el.getBoundingClientRect(), w=rect.width,h=rect.height;
 if(!w||!h)return;
 const ratio=Math.min(window.devicePixelRatio||1,2);
 el.width=Math.round(w*ratio);el.height=Math.round(h*ratio);
 const c=el.getContext('2d');c.scale(ratio,ratio);
 const left=43,right=w-12,top=12,base=h-31,span=right-left;
 const X=x=>left+x*span,Y=y=>base-y/(max||1)*(base-top);
 c.font='12px system-ui';c.textBaseline='middle';
 for(let i=0;i<=4;i++){
  const v=(max||1)*i/4,y=Y(v);
  c.strokeStyle='#e1e9e3';c.beginPath();c.moveTo(left,y);c.lineTo(right,y);c.stroke();
  c.fillStyle='#4e6658';c.textAlign='right';c.fillText(f(v,v%1?1:0),left-6,y);
 }
 c.textAlign='center';c.fillStyle='#4e6658';
 for(const [x,l] of labels)c.fillText(l,X(x),base+17);
 c.save();c.beginPath();c.rect(left-1,top-2,span+2,base-top+3);c.clip();paint(c,X,Y,span);c.restore();
}
function redraw(){for(const el of main.querySelectorAll('[data-chart]'))charts[Number(el.dataset.chart)](el);}
function bars(labels,values,color,max=null,showLabels=false){
 const count=labels.length;
 return chart('Gráfico de barras '+labels.join(', '),el=>plot(el,max||Math.max(1,...values)*1.15,labels.map((l,j)=>[(j+.5)/count,l]),(c,X,Y,span)=>{
  c.fillStyle=color;const w=span/count*.55;
  values.forEach((v,j)=>{const x=X((j+.5)/count);c.fillRect(x-w/2,Y(v),w,Y(0)-Y(v));if(showLabels && v!=null)c.fillText(f(v),x,Y(v)-8);});
 }));
}
function scatter(points,color,max){
 const span=new Date(Date.UTC(+activeFuel.slice(0,4),+activeFuel.slice(5),0)).getUTCDate();
 const labels=[1,5,10,15,20,25,span].map(d=>[(d-1)/span,String(d)]);
 const med=[...group(points,r=>Math.floor(r[0])).entries()].sort(([a],[b])=>a-b).map(([d,rows])=>[(d-.5)/span,percentile(rows.map(r=>r[1]),.5)]);
 return chart('Dispersão por dia do mês, com mediana diária',el=>plot(el,max,labels,(c,X,Y)=>{
  c.globalAlpha=.24;c.fillStyle=color;
  for(const [d,v] of points){c.beginPath();c.arc(X((d-1)/span),Y(v),1.33,0,Math.PI*2);c.fill();}
  c.globalAlpha=1;c.strokeStyle=navy;c.lineWidth=2;c.beginPath();
  med.forEach(([d,v],i)=>i?c.lineTo(X(d),Y(v)):c.moveTo(X(d),Y(v)));c.stroke();
 }));
}

const movements=data.fuel.movements.filter(r=>r[0].startsWith(activeFuel));
const pump=data.fuel.pump.filter(r=>r[0].startsWith(activeFuel));
const fuelNames=[...station,'Total'];
const fuelStationOpts=[['all','Todos os postos'],...station.map((s,i)=>[i,s])];
const fuelSub=[['visao','Visão geral'],['chegadas','Chegadas'],['parametros','Parâmetros'],['dispersao','Dispersão'],['simulacao','Simulação dos tempos'],['diario','Posto analítico'],['importacao','Importação'],['casos','Fila sem abastecimento']];
const activeStation=r=>state.station==='all'||r[1]===Number(state.station);
function fuelStats(rows){
 const fueled=rows.filter(r=>r[8]>0),clean=fueled.filter(r=>r[9]),mins=clean.map(r=>r[5]+r[6]);
 return {fueled:fueled.length,withQueue:fueled.filter(r=>r[7]).length,noQueue:fueled.filter(r=>!r[7]).length,onlyQueue:rows.length-fueled.length,
  n:clean.length,unique:new Set(fueled.map(r=>r[2])).size,q:mean(series(clean,5)),p:mean(series(clean,6)),total:mean(mins),p90:percentile(mins,.9),med:percentile(mins,.5),elapsed:sum(rows,5)+sum(rows,6)};
}
function stageFuel(rows,filtered=state.basis==='fueled'){
 const index=filtered?6:2;
 return [sum(rows,index+1)?sum(rows,index)/sum(rows,index+1):null,sum(rows,5)?sum(rows,4)/sum(rows,5):null];
}
function fuelHistory(){
 const chosen=data.fuel.day.filter(activeStation);
 const aggregate=(key,label,annual=false)=>{
  const vals=stageFuel(chosen.filter(r=>r[0].startsWith(key)));
  return [label,vals,`Fila: ${min(vals[0])} | Posto: ${min(vals[1])}`,annual];
 };
 const annual=fuelYears.map(y=>aggregate(y,y,true)),monthly=fuelMonths.map(m=>aggregate(m,monthShort(m)+'/'+m.slice(2,4)));
 const daily=fuelDates.map(d=>aggregate(d,d.slice(8)));
 const colors=state.basis==='fueled'?['#efbd72','#804566']:['#99ccba',navy];
 const cap=Math.max(1,...daily.concat(annual,monthly).map(r=>r[1].reduce((a,v)=>a+(v||0),0)))*1.13;
 const p=select('basis','Base do gráfico',state.basis,[['all','Todas as etapas registradas'],['fueled','Com abastecimento vinculado']]);
 const historic=panel('Permanência em cerca','Médias em minutos por etapa. O rótulo acima da barra é a soma das médias.',
  legend([[colors[0],'Fila'],[colors[1],'Posto']])+stacked(annual.concat(monthly),colors,false,cap)+
  note(`Acumulado de ${fuelYears.join(', ')} sobre os meses disponíveis (${monthShort(fuelMonths[0])} a ${monthShort(fuelMonths.at(-1))}). A média usa todas as linhas elegíveis de cada etapa no período.`),p);
 return historic+panel(`Detalhe diário · ${monthLong(activeFuel)}`,'Mesma escala e critério do gráfico mensal.',stacked(daily,colors,true,cap));
}
function fuelOverview(rows){
 const a=fuelStats(rows);
 const cells=kpis([
  ['Abastecimentos',f(a.fueled,0),monthLong(activeFuel)],
  ['Abastecimentos com fila',f(a.withQueue,0)],['Abastecimentos sem fila registrada',f(a.noQueue,0)],
  ['Fila sem abastecimento',f(a.onlyQueue,0)],['Fila média',min(a.q)],['Abastecimento médio',min(a.p)],['Tempo total médio',min(a.total),'Fila + posto por movimento']
 ]);
 const groups=[...station.map((_,i)=>movements.filter(r=>r[1]===i)),movements].map(fuelStats);
 const stats=[
  ['Abastecimentos','fueled',0],['Com fila','withQueue',0],['Sem fila registrada','noQueue',0],['Fila sem abastecimento','onlyQueue',0],
  ['Prefixos distintos','unique',0],['Fila média (min)','q',1],['Abastecimento médio (min)','p',1],['Tempo total médio (min)','total',1],
  ['Mediana do total (min)','med',1],['P90 do total (min)','p90',1],['Total acumulado de fila + abastecimento (h)','elapsed',1]
 ];
 const compare=table(['Indicador',...fuelNames],stats.map(([l,k,d])=>[l,...groups.map(g=>f(k==='elapsed'?g[k]/60:g[k],d))]));
 const daily=fuelDates.map(d=>{
  const r=fuelStats(rows.filter(x=>x[0]===d));
  return [iso(d),f(r.fueled,0),f(r.unique,0),f(r.withQueue,0),f(r.noQueue,0),f(r.onlyQueue,0),min(r.q),min(r.p),min(r.total),min(r.p90)];
 });
 return cells+fuelHistory()+panel(`Abastecimentos · ${monthLong(activeFuel)}`,'Os tempos observados por movimento usam uma fila e um posto registrados em ordem.',compare)+
 panel('Indicadores por dia','Volume e tempos do posto selecionado.',table(['Data','Abast.','Prefixos','Com fila','Sem fila','Só fila','Fila','Posto','Total','P90'],daily));
}
function heatColor(v,max){
 if(!v)return ['#f4f7f4','#536960'];
 const p=v/max,i=Math.floor(p*3),t=p*3-i;
 const colors=[[242,247,242],[142,216,181],[239,179,112],[154,66,52]];
 const a=colors[i], b=colors[Math.min(i+1,3)];
 return [`rgb(${a.map((c,k)=>Math.round(c+(b[k]-c)*t)).join(',')})`,p>.82?'#fff':'#1a3027'];
}
function arrivalMatrix(rows){
 const arrived=group(rows.filter(r=>r[8]>0),r=>r[0]);
 return fuelDates.map(d=>{
  const day=arrived.get(d)||[], counts=Array(24).fill(0);
  for(const r of day)counts[Math.floor(r[4]/60)]++;
  return [d,counts,fuelStats(day).total];
 });
}
let capacityData=null,capacityError='',capacityLoading=false;
const weekdays=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
function loadCapacity(){
 if(capacityLoading||capacityData||capacityError)return;
 capacityLoading=true;
 fetch('/api/data/capacidade',{cache:'no-store'}).then(async r=>{
  if(!r.ok)throw Error('Não foi possível carregar a capacidade.');
  capacityData=await r.json();
 }).catch(e=>capacityError=e.message).finally(()=>{capacityLoading=false;if(['chegadas','parametros','diario'].includes(state.fuelTab))render();});
}
function capacityEditor(){
 loadCapacity();
 if(!capacityData)return panel('Capacidade por hora',capacityError||'Carregando parâmetros…','');
 return station.map((name,i)=>panel(name,'Capacidade em veículos por hora.',
 table(['Hora',...weekdays],capacityData.grid[i].map((row,h)=>[hour(h),...row.map((n,d)=>
  `<input data-cap="${i},${h},${d}" type="number" min="0" max="9999" step="1" required value="${n}" style="width:5em" aria-label="${name}, ${weekdays[d]}, ${hour(h)}">`)])))).join('')+
 '<button data-save-cap="1">Salvar parâmetros</button> <span id="cap-status" role="status"></span>';
}
async function saveCapacity(button){
 const grid=structuredClone(capacityData.grid);
 for(const input of main.querySelectorAll('[data-cap]')){
  if(!input.reportValidity())return;
  const [s,h,d]=input.dataset.cap.split(',').map(Number);
  grid[s][h][d]=input.valueAsNumber;
 }
 const status=document.getElementById('cap-status');
 button.disabled=true;
 try{
  const r=await fetch('/api/data/capacidade',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({grid,revision:capacityData.revision})});
  const result=await r.json();
  if(!r.ok)throw Error(result.error);
  capacityData={grid,revision:result.revision};status.textContent='Parâmetros salvos.';
 }catch(e){status.textContent=e.message;}finally{button.disabled=false;}
}
function capacityHeat(name,i,rows,hdr){
 loadCapacity();
 if(!capacityData)return panel(name+' · chegadas versus capacidade',capacityError||'Carregando parâmetros…','');
 const signed=n=>n>0?'+'+n:String(n);
 const tr=rows.map(([date,counts,cycle])=>{
  const day=new Date(date+'T00:00:00Z').getUTCDay();
  let total=0;
  const cells=counts.map((n,h)=>{
   const limit=capacityData.grid[i][h][day],delta=n-limit;
   total+=delta;
   const shade=Math.min(Math.abs(delta)/20,1);
   const color=delta>0?'hsl(4 68% '+(94-59*shade)+'%)':delta<0?'hsl(152 34% '+(96-22*shade)+'%)':'#f4f5f3';
   return `<td style="background:${color};color:${delta>10?'white':'#182820'}" title="${iso(date)} · ${weekdays[day]} · ${hour(h)} · ${n} chegadas · capacidade ${limit}">${signed(delta)}</td>`;
  }).join('');
  return `<tr><td>${iso(date)}</td><td>${min(cycle)}</td>${cells}<td>${signed(total)}</td></tr>`;
 }).join('');
 return panel(name+' · chegadas versus capacidade','Chegadas menos capacidade. Vermelho indica excesso, zero indica equilíbrio e verde indica vagas disponíveis. A última coluna soma os deltas do dia.',
 `<div class="tablewrap"><table class="heat"><thead><tr>${hdr.map(h=>'<th scope="col">'+h+'</th>').join('')}</tr></thead><tbody>${tr}</tbody></table></div>`);
}
function fuelArrivals(){
 const matrices=station.map((s,i)=>arrivalMatrix(movements.filter(r=>r[1]===i)));
 const max=Math.max(1,...matrices.flatMap(a=>a.flatMap(r=>r[1])));
 return station.map((s,i)=>{
  if(state.station!=='all'&&Number(state.station)!==i)return '';
  const rows=matrices[i];
  const hdr=['Data','Ciclo médio',...Array.from({length:24},(_,j)=>hour(j)),'Dia'];
  const html=`<div class="tablewrap"><table class="heat"><thead><tr>${hdr.map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.map(([d,counts,t])=>{
   const cells=counts.map((v,h)=>{const [bg,fg]=heatColor(v,max);return `<td style="background:${bg};color:${fg}" title="${iso(d)} às ${hour(h)}: ${v} chegadas">${v||'·'}</td>`;}).join('');
   return `<tr><td>${iso(d)}</td><td>${min(t)}</td>${cells}<td>${f(counts.reduce((a,b)=>a+b,0),0)}</td></tr>`;
  }).join('')}</tbody></table></div>`;
  return panel(s+' · chegadas por data e hora','Cada célula é a contagem de chegadas. A coluna após a data mostra a média diária de fila + posto.',html+`<div class="heat-note"><span>0</span><span class="gradient"></span><span>${max} chegadas/h</span></div>`)+capacityHeat(s,i,rows,hdr);
 }).join('');
}
function fuelScatter(){
 const totalLimit=Math.ceil(Math.max(1,...movements.filter(r=>r[9]).map(r=>r[5]+r[6]))/10)*10;
 const pumpLimit=Math.ceil(Math.max(1,...pump.map(r=>r[3]))/10)*10;
 return station.map((s,i)=>{
  if(state.station!=='all'&&Number(state.station)!==i)return '';
  const x=movements.filter(r=>r[1]===i&&r[9]).map(r=>[+r[0].slice(8)+r[4]/1440,r[5]+r[6]]), y=pump.filter(r=>r[1]===i).map(r=>[+r[0].slice(8)+r[2]/1440,r[3]]);
  return panel(s+' · dispersão por dia','Cada ponto é um registro em minutos. A linha indica a mediana diária.',
   `<div class="row2"><div><h3>Total · fila + posto</h3>${scatter(x,i?ochre:green,totalLimit)}<p class="note">${f(x.length,0)} movimentos com as duas etapas vinculadas.</p></div><div><h3>Só abastecimento · posto</h3>${scatter(y,i?ochre:green,pumpLimit)}<p class="note">${f(y.length,0)} registros de abastecimento.</p></div></div>`);
 }).join('');
}
function scenario(nums,p){
 const n=Math.round(nums.length*p/100);
 if(!n)return [mean(nums),null];
 const cap=[...nums].sort((a,b)=>a-b)[nums.length-n-1];
 return [mean(nums.map(v=>Math.min(v,cap))),cap];
}
function fuelScenarios(rows){
 const limits=[0,10,20,30,40,50];
 const values=[rows.filter(r=>r[9]).map(r=>r[5]+r[6]),pump.filter(activeStation).map(r=>r[3])];
 const all=limits.map(p=>{
  const a=values.map(v=>scenario(v,p));
  return [p?p+'% piores':'Atual',...a.flatMap(([v,c])=>[min(v),min(c)])];
 });
 return panel('Impacto dos tempos mais altos','Reduz os registros mais demorados até o maior tempo dos demais, com o mesmo volume de atendimentos.',
  `<div class="row2"><div><h3>Total · fila + posto</h3>${bars(limits.map(p=>p+'%'),limits.map(p=>scenario(values[0],p)[0]),green)}</div><div><h3>Só abastecimento · posto</h3>${bars(limits.map(p=>p+'%'),limits.map(p=>scenario(values[1],p)[0]),navy)}</div></div>`+
  table(['Cenário','Fila + posto · média','Limite do total','Só posto · média','Limite do posto'],all));
}
function caseSearch(hint){
 return `<label class="select-label">Buscar<input data-search type="search" value="${text(state.query)}" placeholder="${hint}"></label>`;
}
function fuelCases(rows){
 const items=rows.filter(r=>!r[8]&&[r[2],r[3],r[10],station[r[1]]].join(' ').toLowerCase().includes(state.query.toLowerCase()));
 lastCaseRows=items.map(r=>[r[0],timeHM(r[4]),station[r[1]],r[3],r[2],f(r[5]),r[10]]);
 const [current,control]=pageRows(lastCaseRows,20);
 const labels=['Data','Entrada','Posto','Transportadora','Prefixo','Fila (min)','IDs da origem'];
 return panel('Fila sem abastecimento vinculado',`${f(rows.filter(r=>!r[8]).length,0)} movimentos no posto selecionado. O motivo depende da conferência operacional.`,
  `<div class="tools">${caseSearch('Prefixo, transportadora ou ID')}<button data-export="fuel">Exportar CSV</button></div>`+table(labels,current.map(a=>a.map(text)))+control);
}
const emptyDashboard=(label,sub)=>panel(label,sub,'<button data-tab="importacao">Importar bases</button>');
function fuel(){
 if(state.fuelTab==='diario')return heading('Posto analítico','Resumo diário para envio por e-mail','')+tabs(fuelSub,state.fuelTab)+fuelDay();
 if(state.fuelTab==="parametros")return heading("Postos de combustível","Capacidade operacional","Parâmetros")+tabs(fuelSub,"parametros")+capacityEditor();
 if(state.fuelTab==='importacao')return heading('Postos de combustível','Gerencie as planilhas do painel','Importação')+tabs(fuelSub,'importacao')+Gerencia.html('fuel');
 if(!activeFuel)return heading('Postos de combustível','Permanência em cerca, volumes e chegadas','Sem dados')+tabs(fuelSub,state.fuelTab)+emptyDashboard('Nenhuma base de postos','Importe uma planilha para abrir os indicadores.');
 const filtered=movements.filter(activeStation);
 const renderers={visao:()=>fuelOverview(filtered),chegadas:fuelArrivals,dispersao:fuelScatter,simulacao:()=>fuelScenarios(filtered),casos:()=>fuelCases(filtered)};
 return heading('Postos de combustível','Permanência em cerca, volumes e chegadas · Puma e Monte Alegre',monthLong(activeFuel))+
  `<div class="filters">${select('station','Posto',state.station,fuelStationOpts)}</div>`+tabs(fuelSub,state.fuelTab)+renderers[state.fuelTab]()+footer(
  'Fontes disponíveis na aba Importação de Postos.',
  '<p>O histórico de permanência usa a média da coluna L por etapa. O modo com abastecimento exclui chaves que registraram apenas fila. Os demais indicadores usam o mês mais recente coberto pelas bases.</p><p>O vínculo usa posto, transportadora, prefixo, Entrada IONICS (G) e Saída IONICS (I). A chegada usa a primeira entrada de fila anterior ao posto ou a primeira entrada no posto quando falta fila. Chaves de só fila ficam fora das chegadas.</p>');
}

const tripRows=data.cycle.trips;
const groups={modal:'Modal',meso:'Mesorregião',bloco:'Bloco',grua:'Grua'};
const tabsCycle=[['visao','Visão geral'],['carga','Carregamento'],['campoDia','Carregamento analítico'],['campoSim','Simulação de tempos'],['descarga','Descarga'],['descDia','Descarga analítica'],['meta','Parâmetros'],['viagens','Conferência de viagens'],['importacao','Importação']];
const options=(rows,index,all)=>[['',all],...[...new Set(rows.map(r=>r[index]))].sort((a,b)=>a.localeCompare(b,'pt-BR')).map(x=>[x,x])];
function tripFilter(){
 return tripRows.filter(r=> (state.cycleTab==='descDia'?r[23]?.slice(0,10)===state.campoDia:state.cycleTab==='campoDia'?r[18]?.slice(0,10)===state.campoDia:r[0]>=state.inicio&&r[0]<=state.fim)
  &&['modal','meso','bloco','grua'].every(k=>!state[k]||r[xCycle[k]]===state[k])).map(r=>{const fld=r[state.outliers==='excluir'?20:19];if(!fld)return r;const copy=r.slice();copy[11]=fld[0];copy.splice(14,4,...fld.slice(1));return copy;});
}
function tripStats(rows){
 const ready=rows.filter(validTrip);
 const mins=ready.map(total), stages=stage.map((_,j)=>mean(series(ready,j+10)));
 return {all:rows.length,n:ready.length,m:mean(mins),p50:percentile(mins,.5),p90:percentile(mins,.9),
  absent:rows.filter(r=>r[9]!==15).length, invalid:rows.filter(r=>r[9]===15&&!validTrip(r)).length,
  distance:mean(series(ready,8)),stages};
}
function cycleOverview(rows){
 const x=tripStats(rows);
 const summary=kpis([['Tempo total médio',hstr(x.m),'Viagens com etapas 1 a 4'],['Viagens com ID',f(x.all,0)],['Ciclos completos',f(x.n+x.invalid,0),x.invalid?f(x.invalid,0)+' com tempo inválido':f(x.n,0)+' com tempo válido'],['Ciclos incompletos',f(x.absent,0)],['P90 do ciclo',hstr(x.p90)],['Distância média',x.distance==null?'—':f(x.distance)+' km','Soma dos trechos da coluna I']]);
 const ready=rows.filter(validTrip);
 const stepHtml=`<div class="stage-grid">${stageNames.map((l,i)=>{
  const a=x.stages[i],p=percentile(series(ready,i+10),.9);
  return `<div class="stage"><span>${l}</span><b>${min(a)}</b><small>P90 ${min(p)}${a!=null&&x.m?` · ${f(a/x.m*100)}% do total`:''}</small></div>`;
 }).join('')}</div>`;
 const by=group(rows,r=>r[0]);
 const days=cycleDates.filter(d=>d>=state.inicio&&d<=state.fim);
 const daily=days.map(d=>[d,tripStats(by.get(d)||[])]);
 const chartRows=daily.map(([d,r])=>[d.slice(8),r.stages,`${iso(d)} · ${f(r.n,0)} ciclos · ${hstr(r.m)}`]);
 const lines=daily.map(([d,r])=>[iso(d),f(r.all,0),f(r.n,0),f(r.absent,0),...r.stages.map(v=>f(v)),f(r.m),f(r.p90)]);
 const chartPanel=panel('Composição do ciclo por dia','Médias das quatro etapas para viagens com ciclo completo e tempo válido.',
  
  table(['Data','Viagens','Completos válidos','Incompletos','Vazio min','Carga min','Carregado min','Descarga min','Total min','P90 min'],lines));
 const rankRows=cycleRankData(rows,'modal').filter(r=>r.m!=null).slice(0,6);
 return summary+fieldHistory(rows,"cycle")+panel('Tempo logístico por etapa','Todos os valores abaixo usam a mesma amostra de ciclos completos.',stepHtml)+chartPanel+
 panel('Modais com maior tempo médio','Médias por etapa dos ciclos completos.',cycleBars(rankRows))+operatorCycle(rows)+cycleRanking(rows);
}
let fleet=null,fleetError='';
const normalizeFleet=id=>String(id??'').trim().toUpperCase().replace(/[\s-]/g,'');
function cycleBars(ranking){
 const max=Math.max(1,...ranking.map(r=>r.m));
 return legend(stage.map((label,i)=>[stageColors[i],label]))+ranking.map(r=>
  `<div class="rank-row"><span>${text(r.label)}</span><span style="display:flex;height:16px">${r.stages.map((v,i)=>`<i title="${stage[i]} · ${min(v)}" style="width:${100*v/max}%;background:${stageColors[i]}"></i>`).join('')}</span><b>${min(r.m)}</b></div>`).join('');
}
function operatorCycle(rows){
 const operators=new Map((fleet?.grid||[]).map(([id,name])=>[normalizeFleet(id),name]));
 const ranking=[...group(rows.filter(validTrip),r=>operators.get(normalizeFleet(r[7]))??'Sem vínculo no cadastro')]
  .map(([label,list])=>({label,...tripStats(list)})).sort((a,b)=>b.m-a.m);
 return panel('Tempo de ciclo por operador','Médias de ciclos completos. A barra mostra as quatro etapas.',cycleBars(ranking));
}
function trucks(){
 return heading('Caminhões','Cadastro de operadores por prefixo','')+panel('Importar Cadastro MAXTRACK','Colunas usadas: Id da Frota e Operador. Cada importação substitui o cadastro anterior.',
  `<input type="file" accept=".xlsx,.xlsm" data-truck-file aria-label="Importar cadastro" ${fleet?'':'disabled'}><p role="status" id="fleet-status">${text(fleetError||(fleet?f(fleet.grid.length,0)+' prefixos cadastrados.':'Carregando cadastro…'))}</p>`+
  table(['Id da Frota','Operador'],(fleet?.grid||[]).map(r=>r.map(text))));
}
async function importTrucks(input){
 const file=input.files[0],status=document.getElementById('fleet-status');
 if(!file)return;
 input.disabled=true;
 try{
  const records=await Fonte.spreadsheet('trucks',file),unique=new Map();
  for(const row of records){const key=normalizeFleet(row[0]);if(key)unique.set(key,row);}
  const grid=[...unique.values()].sort((a,b)=>a[0].localeCompare(b[0]));
  const r=await fetch('/api/data/caminhoes',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:fleet.revision,grid})});
  const result=await r.json();if(!r.ok)throw Error(result.error);
  fleet={revision:result.revision,grid};render();
 }catch(e){status.textContent=e.message;input.disabled=false;input.value='';}
}
function cycleRankData(rows,k){
 return [...group(rows,r=>r[xCycle[k]])].map(([label,rs])=>({label,...tripStats(rs)})).sort((a,b)=>(b.m??-1)-(a.m??-1)||b.n-a.n);
}
function rankBars(rows,key){
 const max=Math.max(1,...rows.map(r=>r[key]??0));
 return rows.length?`<div class="ranking">${rows.map(r=>`<div class="rank-row"><span>${text(r.label)}</span><span class="rank-bar"><i style="width:${(r[key]??0)/max*100}%"></i></span><b>${min(r[key])}</b></div>`).join('')}</div>`:'<p class="empty">Nenhuma duração válida no recorte.</p>';
}
const compareSort=(a,b,key)=>{
 const order=state.up?1:-1;
 if(a[key]==null)return b[key]==null?0:1;
 if(b[key]==null)return -1;
 if(typeof a[key]==='string')return order*a[key].localeCompare(b[key],'pt-BR');
 return order*(a[key]-b[key]);
};
const sortBy=(key,label)=>`<button class="sort" data-sort="${key}" aria-label="Ordenar por ${label}">${label}${state.sort===key?(state.up?' ↑':' ↓'):''}</button>`;
const searchFilter=(rows,key)=>rows.filter(r=>String(r[key]).toLowerCase().includes(state.query.toLowerCase()));
function cycleRanking(rows){
 const mode=state.rank;
 const all=cycleRankData(rows,mode), items=searchFilter(all,'label').sort((a,b)=>compareSort(a,b,state.sort));
 const [view,pages]=pageRows(items,16);
 const highs=all.filter(r=>r.m!=null).slice(0,8);
 const labels=[sortBy('label',groups[mode]),sortBy('all','Viagens'),sortBy('n','Ciclos válidos'),'Cobertura',sortBy('m','Média min'),sortBy('p50','Mediana min'),sortBy('p90','P90 min'),'Vazio min','Carga min','Carregado min','Descarga min','Distância km'];
 const result=view.map(r=>[text(r.label),f(r.all,0),f(r.n,0),f(r.n/r.all*100)+'%',f(r.m),f(r.p50),f(r.p90),...r.stages.map(x=>f(x)),f(r.distance)]);
 return panel(groups[mode]+' · maiores médias de ciclo','A duração usa ciclos com as quatro etapas e tempo válido. O volume indica a amostra de cada grupo.',
  rankBars(highs,'m'))+panel('Comparativo de ciclos','Ordene pelas colunas para comparar desempenho, cobertura e volume.',
  `<div class="tools">${select('rank','Agrupar por',mode,Object.entries(groups).filter(([k])=>k!=='grua'))}${caseSearch('Buscar grupo')}</div>`+table(labels,result)+pages);
}
function stepSummary(rows,k){
 const eligible=series(rows,k);
 return {n:eligible.length,m:mean(eligible),p50:percentile(eligible,.5),p90:percentile(eligible,.9)};
}
function stageRanking(rows,key,k,withSubs){
 const mode=state[key];
 const sets=[...group(rows,r=>r[xCycle[mode]])].map(([label,rs])=>({
  label,...stepSummary(rs,k),extra:withSubs?[14,15,16,17].map(q=>mean(series(rs,q))):[]
 }));
 const filtered=searchFilter(sets,'label').sort((a,b)=>compareSort(a,b,state.sort));
 const [page,pages]=pageRows(filtered,16);
 const headers=[sortBy('label',groups[mode]),sortBy('n','Viagens'),sortBy('m','Média min'),sortBy('p50','Mediana min'),sortBy('p90','P90 min'),...(withSubs?['Fila min','Fila crítica min','Carga min','Amarração min']:[])];
 return panel('Desempenho por '+groups[mode].toLowerCase(),withSubs?'As médias das subetapas consideram viagens em que o respectivo status foi registrado.':'Viagens com duração válida para a etapa 4.',
  `<div class="tools">${select(key,'Agrupar por',mode,Object.entries(groups))}${caseSearch('Buscar grupo')}</div>`+
  table(headers,page.map(r=>[text(r.label),f(r.n,0),f(r.m),f(r.p50),f(r.p90),...r.extra.map(x=>f(x))]))+pages);
}
function stepDaily(rows,k,title){
 const d=group(rows,r=>r[0]);
 const dates=cycleDates.filter(x=>x>=state.inicio&&x<=state.fim);
 const charts=dates.map(x=>{
  const r=stepSummary(d.get(x)||[],k);
  return [x.slice(8),[r.m],`${iso(x)} · ${f(r.n,0)} viagens · ${min(r.m)}`];
 });
 return panel(title,'Média por viagem com a etapa registrada e tempo válido.',
  stacked(charts,[stageColors[k-10]],true));
}
function dayInput(key,value){
 return `<label>Dia <input type="date" required data-change="${key}" value="${value}"></label>`;
}
let goal=69,goalRevision=null,selectedCrane='';
function goalEditor(){
 return panel('Meta de tempo de campo','Usada nos gráficos e no ranking de gruas.',`<label>Minutos <input id="field-goal" type="number" min="0.1" max="1440" step="0.1" value="${goal}"></label> <button data-goal="1" ${goalRevision===null?'disabled':''}>Salvar meta</button> <span id="goal-result" role="status"></span>`);
}
async function saveGoal(button){
 const input=document.getElementById('field-goal'),msg=document.getElementById('goal-result');
 if(!input.value||!input.reportValidity())return;
 button.disabled=true;
 try{
  const value=input.valueAsNumber;
  const reply=await fetch('/api/data/meta-campo',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:goalRevision,grid:value})});
  const result=await reply.json();if(!reply.ok)throw Error(result.error);
  goal=value;goalRevision=result.revision;msg.textContent='Meta salva.';
 }catch(e){msg.textContent=e.message;}finally{button.disabled=false;}
}
const fieldOrder=[15,14,16,17],fieldNames=['Fila crítica','Fila de carga','Carregamento','Amarração'];
function combo(labels,columns,volumes,names,target=null,compact=false){
 if(!labels.length)return note('Sem registros no período.');
 const colors=[...stageColors,'#999'],w=Math.max(compact?260:620,labels.length*47+100),base=193,top=26,left=54,right=w-53;
 const totals=columns.map(c=>c.reduce((a,b)=>a+(b||0),0)),upper=Math.max(1,target||0,...totals)*1.15,vol=Math.max(1,...volumes);
 const x=i=>left+(right-left)*(i+.5)/labels.length,y=n=>base-(base-top)*n/upper;
 const points=volumes.map((v,i)=>[x(i),base-(base-top)*v/vol]);
 let svg='';
 for(let i=0;i<=4;i++){const yy=base-(base-top)*i/4;svg+=`<path d="M${left} ${yy}H${right}" stroke="#e1e8e4"/><text x="26" y="${yy}">${f(upper*i/4,0)}</text><text x="${w-24}" y="${yy}">${f(vol*i/4,0)}</text>`;}
 columns.forEach((c,i)=>{let acc=0;const bw=Math.min(38,(right-left)/labels.length*.61);
  c.forEach((v,j)=>{const height=Math.max(0,v||0);acc+=height;svg+=`<rect x="${x(i)-bw/2}" y="${y(acc)}" width="${bw}" height="${base-y(height)}" fill="${colors[j]}"><title>${labels[i]} · ${names[j]} · ${min(v)}</title></rect>`;});
  svg+=`<text x="${x(i)}" y="${y(acc)-5}">${f(totals[i],0)}</text><text x="${x(i)}" y="213">${labels[i]}</text>`;
 });
 if(target!==null)svg+=`<path d="M${left} ${y(target)}H${right}" stroke="#ba3a36" stroke-dasharray="6 4"/>`;
 svg+=`<polyline points="${points.map(p=>p.join(',')).join(' ')}" fill="none" stroke="#403c86" stroke-width="2"/>`+points.map(([xx,yy],i)=>`<circle cx="${xx}" cy="${yy}" r="3" fill="#403c86"><title>${volumes[i]} viagens</title></circle>`).join('');
 return legend(names.map((n,i)=>[colors[i],n]).concat([['#403c86','Volume de viagens · eixo direito']],target===null?[]:[['#ba3a36','Meta '+min(target)]]))+`<div class="plot-scroll"><svg role="img" aria-label="Médias em minutos e volume em viagens" viewBox="0 0 ${w} 224" style="width:100%;min-width:${w}px;font:11px system-ui;text-anchor:middle;fill:#364e44"><text x="26" y="12">min</text><text x="${w-26}" y="12">viagens</text>${svg}</svg></div>`;
}
function fieldHistory(rows,mode='field'){
 const cycle=mode==='cycle',drop=mode==='drop';
 const valid=rows.filter(r=>cycle?validTrip(r):r[drop?13:11]!=null);
 const names=cycle?['Trajeto vazio','Carregamento total','Trajeto carregado','Descarga']:drop?['Descarga']:[...fieldNames,'Outros'];
 const title=cycle?'Tempo de ciclo':drop?'Tempo de descarga':'Tempo de campo';
 const panels=[7,10].map(len=>{
  const buckets=[...group(valid,r=>r[0].slice(0,len))].sort(([a],[b])=>a.localeCompare(b));
  const columns=buckets.map(([,rs])=>{const keys=cycle?[10,11,12,13]:drop?[13]:fieldOrder;
   const values=keys.map(k=>sum(rs,k)/rs.length);
   if(!cycle&&!drop)values.push(sum(rs,11)/rs.length-values.reduce((a,b)=>a+b,0));return values;});
  return panel(title+(len===7?' por mês':' por dia'),'Barras em minutos por viagem. Linha de volume no eixo direito.',combo(buckets.map(([d])=>len===7?d:iso(d)),columns,buckets.map(([,rs])=>rs.length),names,mode==='field'?goal:null,len===7&&!drop));
 }).join('');
 return drop?panels:'<div class="cycle-periods">'+panels+'</div>';
}
const hh=r=>Number(r[18].slice(11,13));
function rankMean(rs,key,metric){
 return [...group(rs.filter(r=>r[metric]!=null),r=>r[key])].map(([name,list])=>({name,list,avg:mean(series(list,metric))})).sort((a,b)=>b.avg-a.avg||a.name.localeCompare(b.name));
}
function shade(value){
 if(value==null)return '#f4f6f4';
 const distance=Math.min(1,Math.abs(value-goal)/goal);
 return value>goal?`hsl(3 78% ${93-distance*24}%)`:`hsl(146 45% ${94-distance*16}%)`;
}
function agenda(rows){
 if(!selectedCrane)return '';
 const entries=rows.filter(r=>r[5]===selectedCrane);
 if(!entries.length)return '';
 const day=state.campoDia,origin=Date.parse(day+'T00:00:00Z');
 const offset=s=>(Date.parse(s+'Z')-origin)/3600000;
 const br=s=>s.slice(0,10).split('-').reverse().join('/')+' '+s.slice(11,19);
 const bars=entries.flatMap(r=>(r[21]||[]).filter(([s,e])=>s&&e&&e>=s).map(([s,e,,cm])=>({s,e,cm,arrival:r[18],id:r[1]})));
 const end=Math.max(24,...bars.map(v=>Math.ceil(offset(v.e))));
 const axis='<div style="display:flex;justify-content:space-between;min-width:400px">'+Array.from({length:7},(_,i)=>'<span>'+f(end*i/6,0)+'h</span>').join('')+'</div>';
 const items=[...group(bars.sort((a,b)=>a.s.localeCompare(b.s)),b=>b.cm)];
 return panel('Agenda · '+text(selectedCrane),'Uma linha por prefixo. As faixas representam os intervalos reais de carregamento. Passe o cursor para ver início, fim e duração.',
 table(['Prefixo CM','Horas de chegada',axis],items.map(([cm,list])=>[text(cm),[...new Set(list.map(b=>b.arrival.slice(11,16)))].join(', '),
 `<div style="position:relative;min-width:400px;height:18px;background:#f1f5f2">${list.map(b=>`<i title="${text('Início: '+br(b.s)+' · Fim: '+br(b.e)+' · Tempo total: '+min((offset(b.e)-offset(b.s))*60))}" style="position:absolute;top:4px;height:10px;border-radius:5px;background:#28775f;left:${100*offset(b.s)/end}%;width:${100*(offset(b.e)-offset(b.s))/end}%"></i>`).join('')}</div>`])));

}
function fieldDay(rows){
 const valid=rows.filter(r=>r[11]!=null),slots=Array.from({length:24},(_,i)=>i);
 const cranes=rankMean(valid,5,11),mesos=rankMean(valid,3,11);
 const peak=[...group(rows,r=>JSON.stringify([hh(r),r[5],r[3]]))].sort((a,b)=>b[1].length-a[1].length)[0];
 const p=peak&&JSON.parse(peak[0]);
 const worst=r=>{
  if(!r)return 'Sem registros.';
  const blocks=[...new Set(r.list.map(v=>v[4]))].sort();
  return '<strong>'+text(r.name)+'</strong> · '+min(r.avg)+' em '+f(r.list.length,0)+' registros · Blocos: '+blocks.map(text).join(', ')+'.';
 };
 const highlight=panel('Destaques do dia',iso(state.campoDia),
  '<p>Maior tempo por grua: '+worst(cranes[0])+'</p><p>Maior tempo por mesorregião: '+worst(mesos[0])+'</p><p>Pico de chegadas: '+
  (peak?'<strong>'+f(peak[1].length,0)+' registros</strong> às '+hour(p[0])+' · '+text(p[1])+' · '+text(p[2])+'.':'Sem chegadas.')+'</p>');
 const hourly=slots.map(h=>mean(series(valid.filter(r=>hh(r)===h),11)));

 const counts=[...group(rows,r=>r[5])].sort(([a],[b])=>a.localeCompare(b)).map(([name,list])=>{
  const bins=Array(24).fill(0);for(const r of list)bins[hh(r)]++;return [name,bins];
 });
 const peakCount=Math.max(1,...counts.flatMap(r=>r[1]));
 const heat=table(['Grua',...slots.map(hour)],counts.map(([name,bins])=>[
  `<button data-agenda="${text(name)}">${text(name)}</button>`,...bins.map(v=>{
   const [bg,fg]=heatColor(v,peakCount);
   return `<span style="display:block;background:${bg};color:${fg};padding:4px">${f(v,0)}</span>`;
  })]));
 const dots=rows.filter(r=>r[16]!=null);
 const ranking='<div class="tablewrap"><table><thead><tr>'+['Grua','Registros','Tempo total','Fila crítica','Fila de carga','Carregamento','Amarração'].map(n=>'<th>'+n+'</th>').join('')+'</tr></thead><tbody>'+cranes.map(c=>`<tr style="background:${shade(c.avg)}"><td>${text(c.name)}</td><td>${f(c.list.length,0)}</td><td>${min(c.avg)}</td>${fieldOrder.map(k=>'<td>'+min(sum(c.list,k)/c.list.length)+'</td>').join('')}</tr>`).join('')+'</tbody></table></div>';
 return highlight+kpis([['Chegadas',f(rows.length,0)],['Tempo de campo médio',min(mean(series(valid,11)))],['Meta de campo',min(goal)],['P90',min(percentile(series(valid,11),.9))]])+
 panel('Tempo de campo por hora de chegada','Média total da etapa 2 em minutos. Clique na grua para abrir a agenda.','<div class="plot-scroll"><div style="min-width:920px">'+hourlyPlot(hourly)+'</div></div><h3>Chegadas por hora e grua</h3><p>Quantidade de registros por hora. A cor mais intensa indica o maior volume do dia.</p>'+heat)+
 panel('Dispersão · hora × tempo de carregamento','Cada ponto é uma viagem, pela hora de chegada ao campo e duração do status Carregamento.',chart('Hora de chegada e minutos de carregamento',el=>plot(el,Math.max(1,...dots.map(r=>r[16]))*1.06,[0,6,12,18,24].map(h=>[h/24,h+'h']),(c,X,Y)=>{c.fillStyle='#14755588';for(const r of dots){c.beginPath();c.arc(X((hh(r)+Number(r[18].slice(14,16))/60)/24),Y(r[16]),2.5,0,7);c.fill();}})))+
 panel('Composição do tempo do dia','Minutos por viagem com etapa válida.',bars(fieldNames,fieldOrder.map(k=>valid.length?sum(valid,k)/valid.length:null),navy,null,true))+
 panel('Gruas por tempo de campo','Da maior média para a menor. Vermelho indica tempo acima da meta de '+min(goal)+'.',ranking);
}
function hourlyPlot(values){
 return legend([[green,'Tempo médio de campo'],['#ba3a36','Meta '+min(goal)]])+chart('Campo médio por hora',el=>plot(el,Math.max(goal,...values)*1.1,[0,4,8,12,16,20,23].map(i=>[(i+.5)/24,hour(i)]),(c,X,Y,w)=>{
  c.fillStyle=green;values.forEach((v,i)=>{if(v!=null){const x=X((i+.5)/24);c.fillRect(x-w/80,Y(v),w/40,Y(0)-Y(v));c.fillText(f(v),x,Y(v)-8);}});
  c.strokeStyle='#ba3a36';c.setLineDash([5,3]);c.beginPath();c.moveTo(X(0),Y(goal));c.lineTo(X(1),Y(goal));c.stroke();c.setLineDash([]);
 }));
}
function openDetail(title,html){
 const dialog=document.createElement('dialog');
 dialog.style.cssText='width:min(1100px,94vw);max-height:90vh;border:1px solid #c9d6ce;border-radius:12px;padding:18px;color:#183528';
 dialog.setAttribute('aria-label',title);
 dialog.innerHTML='<form method="dialog" style="text-align:right"><button autofocus>Fechar</button></form>'+html;
 main.append(dialog);dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();
}
function fractionSummary(list){
 const values=series(list,16);
 return [min(values.length?Math.min(...values):null),min(values.length?Math.max(...values):null),min(mean(values))];
}
function fieldSim(rows){
 const months=[...group(rows.filter(r=>r[11]!=null),r=>r[0].slice(0,7))].sort(([a],[b])=>a.localeCompare(b));
 const result=[];
 removedScenarios.clear();
 for(const [month,list] of months){
  const ordered=[...list].sort((a,b)=>(b[16]??0)-(a[16]??0)||String(a[1]).localeCompare(String(b[1])));
  const baseline=mean(series(list,11));
  for(const pct of [0,10,20,30,40,50]){
   const n=Math.floor(list.length*pct/100),avg=mean(series(ordered.slice(n),11));
   const removed=ordered.slice(0,n),key=month+'/'+pct;
   removedScenarios.set(key,removed);
   const [lo,hi]=fractionSummary(removed);
   result.push([month,n?`<button data-fraction="${key}">${pct}%</button>`:pct+'%',n?lo+' – '+hi:'—',f(n,0),f(list.length-n,0),min(avg),min(baseline-avg)]);
  }
 }
 return panel('Tempo de campo por mês','Tempo observado em minutos por viagem.',bars(months.map(m=>m[0]),months.map(m=>mean(series(m[1],11))),green,null,true))+
 panel('Impacto dos maiores tempos de carregamento','Em cada mês, ordenamos viagens pelo tempo de carregamento e retiramos a fração indicada. Ganho é a redução da média de campo na amostra restante.',
 table(['Mês','Fração retirada','Min e Max','Retiradas','Consideradas','Campo médio','Ganho médio'],result));
}
function fuelDay(){
 if(!state.postoDia){
  const local=new Date().toLocaleDateString('sv-SE',{timeZone:'America/Sao_Paulo'});
  const yesterday=new Date(local+'T12:00:00Z');yesterday.setUTCDate(yesterday.getUTCDate()-1);
  state.postoDia=yesterday.toISOString().slice(0,10);
 }
 const date=state.postoDia,rows=(data.fuel.allMovements||data.fuel.movements).filter(r=>r[0]===date);
 const controls='<div class="filters">'+dayInput('postoDia',date)+'<button data-print-report="1">Imprimir / salvar PDF</button></div>';
 const summary=panel('Abastecimento · '+date.split('-').reverse().join('/'),'Indicadores do dia por posto e consolidado.',
 table(['Posto','Com fila','Sem fila','Só fila','Prefixos','Fila média','Posto médio','Total médio'],[...station,'Total'].map((s,i)=>{
  const a=fuelStats(i===2?rows:rows.filter(r=>r[1]===i));return [s,a.withQueue,a.noQueue,a.onlyQueue,a.unique,min(a.q),min(a.p),min(a.total)];
 })));
 if(!rows.length)return controls+panel('Sem registros em '+date.split('-').reverse().join('/'),'Selecione um dia coberto pelas bases importadas.','');
 return controls+summary+station.map((s,i)=>{
  const rs=rows.filter(r=>r[1]===i),counts=Array(24).fill(0);
  for(const r of rs)if(r[8])counts[Math.min(23,Math.floor(r[4]/60))]++;
  const hdr=['Data','Ciclo médio',...counts.map((_,h)=>hour(h)),'Dia'];
  return panel(s+' · chegadas por hora','Quantidade de veículos com abastecimento.',bars(counts.map((_,h)=>hour(h)),counts,i?ochre:green))+
  capacityHeat(s,i,[[date,counts,fuelStats(rs).total]],hdr);
 }).join('');
}

function loading(rows){
 const valid=rows.filter(r=>r[11]!=null), x=stepSummary(valid,11);
 const s=parts.map((l,j)=>{
  const v=series(valid,j+14);
  return [l,f(v.length,0),valid.length?f(v.length/valid.length*100)+'%':'—',min(mean(v)),min(percentile(v,.90)),min(valid.length?sum(valid,j+14)/valid.length:null)];
 });
 return kpis([['Tempo de campo médio',min(x.m),'Etapa 2 · todas as subetapas'],['Viagens com etapa válida',f(x.n,0)],['Mediana',min(x.p50)],['P90',min(x.p90)],['Fila + fila crítica',min(valid.length?(sum(valid,14)+sum(valid,15))/valid.length:null),'Por viagem com etapa 2 válida'],['Carregamento',min(valid.length?sum(valid,16)/valid.length:null),'Por viagem com etapa 2 válida']])+fieldHistory(rows)+
 panel('O que compõe o tempo de campo','Fila de carga, fila crítica, carregamento e amarração vêm da coluna K.',
  table(['Subetapa','Viagens com status','% da etapa 2','Média quando registrada','P90 quando registrada','Contribuição à média da etapa'],s)+
  note('A contribuição divide o tempo do status por todas as viagens com etapa 2 válida. As quatro contribuições somam a média do tempo de campo.'))+
 stageRanking(valid,'loadRank',11,true);
}
function destinationChart(rows){
 const ranking=rankMean(rows,22,13);
 return panel('Tempo médio por destino','Minutos por viagem com etapa 4 válida.',rankBars(ranking.map(r=>({label:r.name,m:r.avg})),'m'));
}
function dropDay(rows){
 const ranking=rankMean(rows,22,13),valid=rows.filter(r=>r[13]!=null);
 const slots=Array.from({length:24},(_,i)=>i);
 return kpis([['Viagens com descarga',f(rows.length,0)],['Descarga média',min(mean(series(valid,13)))],['Maior média por destino',ranking.length?text(ranking[0].name):'—',ranking.length?min(ranking[0].avg):'']])+
 destinationChart(valid)+panel('Descarga por destino e hora','Média em minutos pela hora de início da etapa 4.',table(['Destino',...slots.map(hour)],ranking.map(d=>[text(d.name),...slots.map(h=>f(mean(series(d.list.filter(r=>+r[23].slice(11,13)===h),13))))])))+
 panel('Ranking diário de descarga','Destinos ordenados pelo maior tempo médio.',table(['Destino','Viagens','Descarga média','Mediana','P90','Máximo'],ranking.map(d=>{const times=series(d.list,13);return [text(d.name),times.length,min(d.avg),min(percentile(times,.5)),min(percentile(times,.9)),min(Math.max(...times))];})));
}
function discharge(rows){
 const valid=rows.filter(r=>r[13]!=null), x=stepSummary(valid,13);
 return kpis([['Tempo médio de descarga',min(x.m),'Etapa 4 · destino'],['Viagens com etapa válida',f(x.n,0)],['Mediana',min(x.p50)],['P90',min(x.p90)]])+
  fieldHistory(valid,'drop')+destinationChart(valid)+stageRanking(valid,'dropRank',13,false);
}
const invalidStep=r=>r.slice(10,14).some((v,i)=>v==null&&(r[9]&(1<<i)));
const tripStatus=r=>r[9]!==15?(invalidStep(r)?'Incompleto · tempo inválido':'Incompleto'):validTrip(r)?'Completo':'Tempo inválido';
const maskText=r=>[1,2,3,4].filter(i=>!(r[9]&(1<<(i-1)))).join(', ')||'—';
function cycleCases(rows){
 const options=[['all','Todos'],['complete','Completos'],['partial','Incompletos'],['invalid','Tempos inválidos']];
 const valid={all:()=>true,complete:r=>r[9]===15,partial:r=>r[9]!==15,invalid:invalidStep};
 const filtered=rows.filter(r=>valid[state.quality](r)&&r.slice(1,8).join(' ').toLowerCase().includes(state.query.toLowerCase()));
 lastCaseRows=filtered.map(r=>[r[0],r[1],r[7],r[2],r[3],r[4],r[5],r[6],tripStatus(r),maskText(r),...r.slice(10,14).map(x=>f(x)),validTrip(r)?f(total(r)):'—',f(r[8])]);
 const [view,pages]=pageRows(lastCaseRows,20);
 return panel('Viagens por ID','Uma linha por viagem. As etapas ausentes estão indicadas no campo Faltam.',
  `<div class="tools">${select('quality','Situação',state.quality,options)}${caseSearch('ID, prefixo, grua ou bloco')}<button data-export="cycle">Exportar CSV</button></div>`+
  kpis([['Viagens selecionadas',f(filtered.length,0)],['Completas',f(filtered.filter(r=>r[9]===15).length,0)],['Incompletas',f(filtered.filter(r=>r[9]!==15).length,0)],['Carregamento médio',min(mean(series(filtered,11))),'Etapa 2'],['Descarga média',min(mean(series(filtered,13))),'Etapa 4'],['Tempo total médio',min(mean(completeMinutes(filtered))),'Completas com tempo válido']])+table(['Data','ID da viagem','Prefixo','Modal','Mesorregião','Bloco','Grua','Talhão','Situação','Faltam','Vazio min','Carga min','Carregado min','Descarga min','Total min','Km'],view.map(r=>r.map(text)))+pages);
}
function cycle(){
 if(state.cycleTab==='meta')return heading('Ciclo florestal','Parâmetros','')+tabs(tabsCycle,'meta')+goalEditor();
 if(state.cycleTab==='importacao')return heading('Ciclo florestal','Gerencie as planilhas do painel','Importação')+tabs(tabsCycle,'importacao')+Gerencia.html('cycle');
 if(!cycleMin)return heading('Ciclo florestal','Tempo logístico por viagem','Sem dados')+tabs(tabsCycle,state.cycleTab)+emptyDashboard('Nenhuma base de ciclo','Importe uma planilha para abrir os indicadores.');
 const rows=tripFilter(), audit=data.cycle.audit;
 const displays={visao:cycleOverview,carga:loading,campoDia:fieldDay,campoSim:fieldSim,descarga:discharge,descDia:dropDay,viagens:cycleCases};
 const date=(k,l)=>`<label>${l}<input type="date" data-change="${k}" value="${state[k]}" min="${cycleMin}" max="${cycleMax}"></label>`;
 const mesoRows=state.meso?tripRows.filter(r=>r[3]===state.meso):tripRows;
 const filteredRows=state.bloco?mesoRows.filter(r=>r[4]===state.bloco):mesoRows;
 const controls=`<div class="filters">${['campoDia','descDia'].includes(state.cycleTab)?dayInput('campoDia',state.campoDia):date('inicio','De')+date('fim','Até')}${select('outliers','Outliers da etapa 2',state.outliers,[['excluir','Excluir apontamentos'],['incluir','Incluir apontamentos']])}${select('modal','Modal',state.modal,options(tripRows,2,'Todos'))}${select('meso','Mesorregião',state.meso,options(tripRows,3,'Todas'))}${select('bloco','Bloco',state.bloco,options(mesoRows,4,'Todos'))}${select('grua','Grua',state.grua,options(filteredRows,5,'Todas'))}<button data-reset>Limpar filtros</button></div>`;
 const dates=`${iso(cycleMin)} a ${iso(cycleMax)}/${cycleMax.slice(0,4)}`;
 return heading('Ciclo florestal','Tempo logístico por viagem, etapa e frente de operação',dates)+controls+note('Filtro por apontamento da etapa 2: duração negativa em qualquer uma das quatro subetapas, fila crítica ≥ 120 min, fila > 240 min, carregamento ou amarração > 60 min. A exclusão preserva os demais eventos da viagem.')+tabs(tabsCycle,state.cycleTab)+displays[state.cycleTab](rows)+footer(
  'Fontes disponíveis na aba Importação de Ciclo.',
  `<p>Foram lidas ${f(audit.rows,0)} linhas. ${f(audit.noId,0)} sem ID de viagem válido em B foram excluídas. As viagens foram consolidadas por ID e atribuídas à data da etapa 1 quando disponível.</p><p>As etapas vêm da coluna J. O tempo soma os minutos de N por etapa. O total exige as etapas 1 a 4 com tempos válidos; ${f(audit.invalidMinutes,0)} linhas com tempos negativos ou inválidos foram desconsideradas nas métricas da etapa afetada. A distância soma os valores por linha de I.</p><p>Para a grua, prevalece o registro do status Carregamento quando disponível; na ausência dele, usa-se a informação da etapa 2. Divergências no status preferencial aparecem como Múltiplas gruas. A etapa 4 reúne a descarga e os demais registros de destino listados em K.</p>`);
}

function render(focusSearch=false,caret=null){
 charts=[];
 const mode=nav();
 for(const key of ['postos','ciclo','cadastro']){
  const a=document.getElementById('nav-'+key);
  if(key===mode)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');
 }
 main.innerHTML=mode==='cadastro'?trucks():mode==='ciclo'?cycle():fuel();
 if(focusSearch){
  const input=main.querySelector('[data-search]');
  if(input){input.focus();if(caret!=null)input.setSelectionRange(caret,caret);}
 }
 requestAnimationFrame(redraw);
}
const removedScenarios=new Map();
const resetList=()=>{state.page=1;state.query='';state.sort='m';state.up=false;};
main.addEventListener('click',e=>{
 const target=e.target.closest('button');
 if(!target)return;
 const d=target.dataset;
 if(d.printReport){window.print();return;}
 if(d.goal){saveGoal(target);return;}
 if(d.agenda){selectedCrane=d.agenda;openDetail('Agenda da grua '+d.agenda,agenda(tripFilter()));return;}
 if(d.fraction){
  const removed=removedScenarios.get(d.fraction)||[];
  const groups=[...group(removed,r=>r[5])].sort(([a,ra],[b,rb])=>rb.length-ra.length||a.localeCompare(b));
  openDetail('Registros retirados por grua',panel('Retiradas por grua · '+text(d.fraction.replace('/',' · '))+'%',f(removed.length,0)+' viagens retiradas. Tempos do status Carregamento em minutos.',
   table(['Grua','Registros retirados','Mínimo','Máximo','Média'],groups.map(([name,list])=>[text(name),f(list.length,0),...fractionSummary(list)]))));return;
 }
 if(d.saveCap){saveCapacity(target);return;}
 if(d.removeSource){Gerencia.remove(d.removeSource,atualizarTorre);}
 else if(d.tab){
  const menu=nav();
  const to='#'+menu+(d.tab==='importacao'?'/importacao':'');
  if(location.hash!==to)history.replaceState(null,'',to);
  state[menu==='ciclo'?'cycleTab':'fuelTab']=d.tab;
  resetList();render();main.querySelector('[data-tab="'+d.tab+'"]').focus();
 }else if(d.page){
  state.page=+d.page;render();
 }else if(d.sort){
  state.up=state.sort===d.sort?!state.up:d.sort==='label';
  state.sort=d.sort;state.page=1;render();
 }else if(d.reset!=null){
  Object.assign(state,{modal:'',meso:'',bloco:'',grua:'',inicio:cycleMin,fim:cycleMax});resetList();render();
 }else if(d.export){downloadCases(d.export);}
},opt);
main.addEventListener('change',e=>{
 if(e.target.hasAttribute('data-truck-file')){importTrucks(e.target);return;}
 if(e.target.dataset.sourceKind){Gerencia.add(e.target,atualizarTorre);return;}
 const k=e.target.dataset.change;
 if(k==="campoDia")selectedCrane="";
 if(!k)return;
 state[k]=e.target.value;
 if(k==='meso')Object.assign(state,{bloco:'',grua:''});
 if(k==='bloco')state.grua='';
 if(k==='inicio'&&(!state.inicio||state.inicio>state.fim))state.inicio=state.fim;
 if(k==='fim'&&(!state.fim||state.fim<state.inicio))state.fim=state.inicio;
 resetList();render();
 const target=main.querySelector('[data-change="'+k+'"]');
 if(target)target.focus();
},opt);
main.addEventListener('input',e=>{
 if(e.target.dataset.search==null)return;
 state.query=e.target.value;state.page=1;render(true,e.target.selectionStart);
},opt);
function downloadCases(mode){
 const labels=mode==='fuel'?['Data','Entrada','Posto','Transportadora','Prefixo','Fila_min','IDs_origem']:
 ['Data','ID','Prefixo','Modal','Mesorregiao','Bloco','Grua','Talhao','Situacao','Etapas_ausentes','Vazio_min','Carga_min','Carregado_min','Descarga_min','Total_min','Km'];
 const val=v=>{const s=String(v??'');return '"'+(/^[=+@-]/.test(s)?"'":'')+s.replace(/"/g,'""')+'"';};
 const rows=[labels,...lastCaseRows].map(r=>r.map(val).join(';')).join('\r\n');
 const link=document.createElement('a'),url=URL.createObjectURL(new Blob(['\ufeff'+rows],{type:'text/csv;charset=utf-8'}));
 link.href=url;link.download=(mode==='fuel'?'fila-sem-abastecimento':'viagens-ciclo-florestal')+'.csv';link.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
window.addEventListener('hashchange',()=>{
 const key=nav()==='ciclo'?'cycleTab':'fuelTab';
 state[key]=location.hash.endsWith('/importacao')?'importacao':'visao';
 resetList();render();window.scrollTo({top:0});
},opt);
if(typeof fetch==='function' && location.protocol!=='file:')fetch('/api/data/meta-campo',{cache:'no-store',signal:controller.signal}).then(async r=>{
 if(!r.ok)return;
 const parameter=await r.json();goal=parameter.grid;goalRevision=parameter.revision;if(nav()==='ciclo')render();
}).catch(()=>{});
if(typeof fetch==='function'&&location.protocol!=='file:')fetch('/api/data/caminhoes',{cache:'no-store',signal:controller.signal}).then(async r=>{
 if(!r.ok)throw Error('Cadastro indisponível.');
 fleet=await r.json();
 if(nav()==='cadastro'||nav()==='ciclo'&&state.cycleTab==='visao')render();
}).catch(e=>{fleetError=e.message;if(nav()==='cadastro')render();});
window.addEventListener('resize',()=>requestAnimationFrame(redraw),{passive:true,...opt});
render();
}
