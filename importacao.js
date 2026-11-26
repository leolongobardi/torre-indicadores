'use strict';

const Fonte=(()=>{
 const fuelHeader=['data','id','transportadora','nome','prefixo','entrada cerca','entrada ionics','saida ionics','saida cerca','tempo cerca'];
 const cycleHeader=['data','id viagem','bloco','meso','talhao','grua','prefixo','modal','distancia total km','tempo logistico','tipo de operacao','inicio','fim','tempo decorrido minutos'];
 const key=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 const has=v=>v!=null&&!['','-','—'].includes(String(v).trim());
 const val=v=>has(v)?String(v).trim():null;
 const num=v=>{
  const n=typeof v==='number'?v:has(v)?Number(String(v).replace(',','.')):NaN;
  return Number.isFinite(n)?n:null;
 };
 const xml=s=>s.replace(/&(?:#x([\da-f]+)|#(\d+)|(amp|lt|gt|apos|quot));/gi,(_,h,n,k)=>
  h?String.fromCodePoint(parseInt(h,16)):n?String.fromCodePoint(+n):({amp:'&',lt:'<',gt:'>',apos:"'",quot:'"'})[k.toLowerCase()]);
 const att=(s,n)=>s.match(new RegExp('(?:^|\\s)'+n+'="([^"]*)"'))?.[1];
 const texts=s=>Array.from(s.matchAll(/<(?:[\w.-]+:)?t(?=\s|>)[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?t>/g),r=>xml(r[1])).join('');
 const column=s=>[...s.replace(/\d/g,'')].reduce((a,k)=>a*26+k.charCodeAt(0)-64,0)-1;
 const day=s=>s?.slice(0,10)??null;
 const minute=s=>Math.round((+s.slice(11,13)*60 + +s.slice(14,16) + +s.slice(17,19)/60)*1000)/1000;
 const round=(x,n=6)=>Math.round(x*10**n)/10**n;
 const meanSum=(rows,k)=>rows.reduce((a,r)=>a+(r[k]??0),0);
 function date(value,mac=false){
  if(typeof value==='number'){
   if(value<1||value>2958465)return null;
   const ts=Math.round((value-(mac?24107:25569))*86400)*1000;
   return new Date(ts).toISOString().slice(0,19);
  }
  if(typeof value!=='string')return null;
  const iso=value.match(/^(\d{4}-\d\d-\d\d)(?:[T ](\d\d:\d\d(?::\d\d)?))?/);
  const br=value.match(/^(\d\d)\/(\d\d)\/(\d{4})(?:[T ](\d\d:\d\d(?::\d\d)?))?/);
  const a=iso?.[1]??(br?br[3]+'-'+br[2]+'-'+br[1]:null);
  if(!a)return null;
  const at=iso?.[2]??br?.[4]??'00:00:00';
  const result=a+'T'+(at.length===5?at+':00':at);
  return Number.isFinite(Date.parse(result+'Z'))&&new Date(result+'Z').toISOString().slice(0,10)===a?result:null;
 }
 function parseCells(body,strings){
  const values=[];
  let next=0;
  const pattern=/<(?:[\w.-]+:)?c(?=\s|>)([^>]*?)(?:\/\s*>|>([\s\S]*?)<\/(?:[\w.-]+:)?c>)/g;
  for(const cell of body.matchAll(pattern)){
   const reference=att(cell[1],'r');
   const pos=reference?column(reference):next;next=pos+1;
   const content=cell[2]||'', type=att(cell[1],'t');
   const v=content.match(/<(?:[\w.-]+:)?v(?=\s|>)[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?v>/)?.[1];
   if(type==='s')values[pos]=strings[Number(v)];
   else if(type==='inlineStr')values[pos]=texts(content);
   else if(v!=null)values[pos]=!type||type==='n'?num(v):xml(v);
  }
  return values;
 }
 const coordinate=(r,i)=>r[i]??null;
 function project(kind,r,mac){
  const x=i=>coordinate(r,i);
  const when=day(date(x(0),mac));
  if(!when)return null;
  if(kind==='fuel'){
   const name=key(x(3)), s=name.includes('puma')?0:name.includes('monte alegre')?1:null;
   const mins=num(x(11)), entry=date(x(5),mac);
   if(s===null||!has(x(1))||!entry||mins==null||mins<0)return null;
   return [when,val(x(1)),s,val(x(2)),val(x(4)),name.startsWith('fila')?0:1,entry,date(x(6),mac),date(x(8),mac),date(x(9),mac),mins];
  }
  return [when,val(x(1)),val(x(2)),val(x(3)),val(x(4)),val(x(5)),val(x(6)),val(x(7)),num(x(8)),num(x(9)),val(x(10)),date(x(11),mac),date(x(12),mac),num(x(13)),val(x(14))];
 }
 function header(kind,r){
  const indexes=kind==='fuel'?[0,1,2,3,4,5,6,8,9,11]:[0,1,2,3,4,5,6,7,8,9,10,11,12,13];
  const expected=kind==='fuel'?fuelHeader:cycleHeader;
  return indexes.every((i,j)=>key(r[i])===expected[j]);
 }
 async function spreadsheet(kind,file){
  if(!/\.(xlsx|xlsm)$/i.test(file.name))throw new Error('Selecione uma planilha .xlsx ou .xlsm.');
  if(file.size>30_000_000)throw new Error('A planilha excede o limite de 30 MB.');
  const zip=await JSZip.loadAsync(new Uint8Array(await file.arrayBuffer()));
  const stringsXml=await zip.file('xl/sharedStrings.xml')?.async('string')||'';
  const strings=Array.from(stringsXml.matchAll(/<(?:[\w.-]+:)?si(?=\s|>)[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?si>/g),r=>texts(r[1]));
  const workbook=await zip.file('xl/workbook.xml')?.async('string')||'';
  const mac=/date1904="(?:true|1)"/.test(workbook);
  for(const name of Object.keys(zip.files).filter(k=>/^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort()){
   const sheet=await zip.file(name).async('string');
   const rowPattern=/<(?:[\w.-]+:)?row(?=\s|>)[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?row>/g;
   let found=false, scan=0, skipped=0;
   const rows=[];
   for(const line of sheet.matchAll(rowPattern)){
    const cells=parseCells(line[1],strings);
    if(!found){found=header(kind,cells);if(!found&&++scan>=25)break;continue;}
    if(!cells.some(v=>v!=null&&v!==''))continue;
    const row=project(kind,cells,mac);
    if(row)rows.push(row);else skipped++;
   }
   if(found){
    if(!rows.length||(kind==='cycle'&&!rows.some(r=>r[1])))throw new Error('A aba de dados não tem registros elegíveis para este painel.');
    return make(kind,file.name,rows,skipped);
   }
  }
  throw new Error(kind==='fuel'?'Não encontrei os cabeçalhos da base de postos (Entrada Cerca, Entrada IONICS, Saída IONICS e Tempo Cerca).':
   'Não encontrei os cabeçalhos da base de ciclo (ID Viagem, Tempo Logístico e Tempo Decorrido).');
 }
 async function make(kind,name,rows,skipped=0){
  const raw=new TextEncoder().encode(JSON.stringify(rows));
  const digest=await crypto.subtle.digest('SHA-256',raw);
  const id=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
  let start=rows[0][0],end=start;
  for(const r of rows){if(r[0]<start)start=r[0];if(r[0]>end)end=r[0];}
  return {id,kind,name,rows,skipped,start,end,imported:new Date().toISOString(),count:rows.length};
 }
 function consolidateFuel(sources){
  const sourceCount=sources.reduce((a,s)=>a+s.rows.length+s.skipped,0);
  const byId=new Map(), groups=new Map(), movements=[],pump=[],days=new Map();
  for(const s of sources)for(const r of s.rows)byId.set(r[2]+'|'+r[1],r);
  for(const r of byId.values()){
   const k=JSON.stringify([r[2],r[3],r[4],...(r[7]&&r[8]?[r[7],r[8]]:['linha',r[1]])]);
   if(!groups.has(k))groups.set(k,[]);
   groups.get(k).push(r);
  }
  for(const a of groups.values()){
   const q=a.filter(r=>r[5]===0),p=a.filter(r=>r[5]===1),firstP=p.map(r=>r[6]).sort()[0];
   const early=q.map(r=>r[6]).filter(d=>!firstP||d<=firstP).sort();
   const arrival=early[0]??firstP;
   const r=a[0];
   const clean=q.length===1&&p.length===1&&!!q[0][9]&&q[0][9]<=p[0][6];
   movements.push([day(arrival),r[2],r[4],r[3],minute(arrival),q.length?round(meanSum(q,10)):null,p.length?round(meanSum(p,10)):null,q.length,p.length,clean,p.length?null:q.map(r=>r[1]).join(', ')]);
   for(const row of a){
    const k=row[0]+'|'+row[2];
    if(!days.has(k))days.set(k,[row[0],row[2],0,0,0,0,0,0]);
    const s=days.get(k),t=row[5]*2+2;
    s[t]+=row[10];s[t+1]++;
    if(!row[5]&&p.length){s[6]+=row[10];s[7]++;}
    if(row[5])pump.push([day(row[6]),row[2],minute(row[6]),round(row[10])]);
   }
  }
  const order=(a,b)=>a[0].localeCompare(b[0])||a[1]-b[1];
  const d=[...days.values()].sort(order),month=d.at(-1)?.[0].slice(0,7);
  return {day:d,allMovements:movements.sort((a,b)=>order(a,b)||a[4]-b[4]),movements:movements.filter(r=>month&&r[0].startsWith(month)),
   pump:pump.filter(r=>month&&r[0].startsWith(month)).sort(order),
   audit:{source:sourceCount,rows:byId.size}};
 }
 function consolidateCycle(sources){
  let rows=0,noId=0,invalidMinutes=0,unmapped=0;
  const unique=new Map(),trips=[],statuses=['fila de carga','fila critica de carga','carregamento','amarracao de carga'];
  for(const source of sources)for(const r of source.rows){
   if(!r[1]){rows++;noId++;continue;}
   const event=JSON.stringify([r[9],key(r[10]),r[11],r[12]]);
   if(!unique.has(r[1]))unique.set(r[1],new Map());
   const events=unique.get(r[1]), prior=events.get(event);
   // O registro mais recente prevalece. Campos vazios aproveitam a versão anterior.
   events.set(event,prior?r.map((v,i)=>v??prior[i]):r);
  }
  for(const [id,events] of unique){
   const a=[...events.values()].sort((x,y)=>(x[11]??x[0]).localeCompare(y[11]??y[0]));
   rows+=a.length;
   const sets=[1,2,3,4].map(n=>a.filter(r=>r[9]===n));
   let mask=0;
   const steps=sets.map((list,i)=>{
    if(!list.length)return null;
    mask|=1<<i;
    const invalid=list.filter(r=>r[13]==null||r[13]<0).length;
    invalidMinutes+=invalid;
    return invalid?null:round(meanSum(list,13),4);
   });
   unmapped+=a.length-sets.reduce((n,r)=>n+r.length,0);
   const by=(i,x)=>a.find(r=>has(r[i]))?.[i]??x;
   const list=sets[1];
   const gruas=r=>[...new Set(r.map(x=>x[5]).filter(has))];
   const preferred=gruas(list.filter(r=>key(r[10])==='carregamento'));
   const cranes=preferred.length?preferred:gruas(list);
   const crane=cranes.length>1?'Múltiplas gruas':cranes[0]??'Sem grua';
   const distance=sets.flat().map(r=>r[8]).filter(x=>x!=null&&x>=0);
   const sub=statuses.map(s=>{
    const subset=list.filter(r=>key(r[10])===s);
    return steps[1]!=null&&subset.length?round(meanSum(subset,13),4):null;
   });
   const first=list.find(r=>r[11])?.[11]??null;
   const field=list.map(r=>({part:statuses.indexOf(key(r[10])),minutes:r[13]}));
   const aggregate=events=>events.length&&events.every(e=>e.minutes!=null)?
    [events.reduce((v,e)=>v+e.minutes,0),...statuses.map((_,i)=>{
     const hits=events.filter(e=>e.part===i);
     return hits.length?hits.reduce((v,e)=>v+e.minutes,0):null;
    })]:[null,null,null,null,null];
   const kept=field.filter(({part,minutes:m})=>m==null||part<0||m>=0&&(part===1?m<120:m<=[240,120,60,60][part]));
   trips.push([(sets[0][0]??a[0])[0],id,by(7,by(14,'Sem modal')),by(3,'Sem mesorregião'),by(2,'Sem bloco'),crane,by(4,'Sem talhão'),by(6,'Sem prefixo'),
    distance.length?round(distance.reduce((x,y)=>x+y,0),3):null,mask,...steps,...sub,first,aggregate(field),aggregate(kept)]);
  }
  return {trips:trips.sort((a,b)=>a[0].localeCompare(b[0])||a[1].localeCompare(b[1])),audit:{rows,noId,invalidMinutes,unmapped}};
 }
 function consolidate(sources){
  return {fuel:consolidateFuel(sources.filter(s=>s.kind==='fuel')),cycle:consolidateCycle(sources.filter(s=>s.kind==='cycle'))};
 }
 return {spreadsheet,make,consolidate};
})();
if(typeof module!=='undefined')module.exports=Fonte;
