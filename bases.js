'use strict';

const Repositorio=(()=>{
 const hosted=location.protocol!=='file:'&&!document.getElementById('seed-bases');
 const bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
 const encode=a=>{
  let s='';
  for(let i=0;i<a.length;i+=0x4000)s+=String.fromCharCode(...a.subarray(i,i+0x4000));
  return btoa(s);
 };
 const order=(a,b)=>a.imported.localeCompare(b.imported);
 async function pack(rows){
  const out=new Blob([JSON.stringify(rows)]).stream().pipeThrough(new CompressionStream('gzip'));
  return encode(new Uint8Array(await new Response(out).arrayBuffer()));
 }
 async function unpack(content){
  const out=new Blob([bytes(content)]).stream().pipeThrough(new DecompressionStream('gzip'));
  const rows=await new Response(out).json();
  if(!Array.isArray(rows))throw new Error('Formato da base armazenada inválido.');
  return rows;
 }
 async function fetchJson(path,opts){
  const reply=await fetch('/api/data'+path,{cache:'no-store',...opts});
  let payload;
  try{payload=await reply.json();}catch{throw new Error('A API de bases está indisponível.');}
  if(!reply.ok){
   const e=new Error(payload.error||'Falha ao acessar as bases.');
   e.status=reply.status;
   throw e;
  }
  return payload;
 }
 function dbOpen(){
  return new Promise((ok,fail)=>{
   const req=indexedDB.open('torre-indicadores-v1',1);
   req.onupgradeneeded=()=>req.result.createObjectStore('state');
   req.onsuccess=()=>ok(req.result);
   req.onerror=()=>fail(new Error('O navegador não disponibilizou o armazenamento local.'));
  });
 }
 function dbRead(db){
  return new Promise((ok,fail)=>{
   const req=db.transaction('state','readonly').objectStore('state').get('catalogue');
   req.onsuccess=()=>ok(req.result||null);req.onerror=()=>fail(req.error);
  });
 }
 function dbWrite(db,value,expected){
  return new Promise((ok,fail)=>{
   const tx=db.transaction('state','readwrite'), store=tx.objectStore('state'),read=store.get('catalogue');
   let conflict=false;
   read.onsuccess=()=>{
    if((read.result?.revision??0)!==expected){conflict=true;tx.abort();return;}
    store.put(value,'catalogue');
   };
   tx.oncomplete=ok;
   tx.onabort=()=>fail(new Error(conflict?'O catálogo mudou em outra aba. Recarregue antes de tentar novamente.':'O navegador não conseguiu salvar a base.'));
  });
 }
 let db=null,current={revision:0,sources:[]},seeded=[];
 async function local(){
  try{db=await dbOpen();current=await dbRead(db)||current;}catch{db=null;}
  if(!current.revision){
   const seed=document.getElementById('seed-bases');
   const manifest=seed?JSON.parse(seed.textContent):[];
   seeded=await Promise.all(manifest.map(async({content,...s})=>({...s,rows:await unpack(content)})));
   current={revision:0,sources:seeded};
  }
 }
 async function remote(){
  for(let i=0;i<2;i++){
   const meta=await fetchJson('');
   try{
    const sources=[];
    for(const src of meta.sources.filter(s=>!s.archived)){
     const record=await fetchJson('/'+src.id);
     const rows=await unpack(record.content);
     if(rows.length!==src.count)throw new Error('A base '+src.name+' não pôde ser validada.');
     sources.push({...src,rows});
    }
    current={revision:meta.revision,sources,archived:meta.archived||[]};return;
   }catch(e){if(i||e.status!==404)throw e;}
  }
 }
 async function open(){if(hosted)await remote();else await local();return current.sources.slice().sort(order);}
 async function save(next,meta,method){
  if(hosted){
   const result=await fetchJson('/'+meta.id,{
    method,headers:{'Content-Type':'application/json'},
    body:JSON.stringify({revision:current.revision,...(method==='PUT'?{source:meta,content:await pack(meta.rows)}:{})},(k,v)=>k==='rows'?undefined:v)
   });
   current={...current,revision:result.revision,sources:next};
  }else{
   if(!db)throw new Error('Abra o HTML baixado em um navegador com armazenamento local habilitado para importar ou excluir bases.');
   const expected=current.revision, draft={revision:expected+1,sources:next};
   await dbWrite(db,draft,expected);current=draft;
  }
 }
 async function add(source){
  if(current.sources.some(s=>s.id===source.id))throw new Error('Esta base já foi importada.');
  await save([...current.sources,source],source,'PUT');
 }
 async function remove(id){
  const source=current.sources.find(s=>s.id===id);
  if(!source)throw new Error('A base selecionada não está disponível.');
  await save(current.sources.filter(s=>s.id!==id),source,'DELETE');
  if(hosted)current.archived=[...(current.archived||[]),source];
 }
 async function restore(id){
  await fetchJson('/'+id+'/restaurar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:current.revision})});
  await remote();
 }
 return {open,add,remove,restore,hosted,get archived(){return current.archived||[];},get sources(){return current.sources.slice().sort(order);}};
})();

async function iniciarPainel(){
 const main=document.getElementById('main');
 try{
  const sources=await Repositorio.open();
  window.torreData=Fonte.consolidate(sources);
  startDashboard();
 }catch(error){
  main.replaceChildren();
  const heading=document.createElement('h1');heading.textContent='Bases indisponíveis';
  const message=document.createElement('p');message.textContent=error.message;
  const refresh=document.createElement('button');refresh.textContent='Tentar novamente';refresh.onclick=()=>location.reload();
  main.append(heading,message,refresh);
 }
}

function atualizarTorre(){
 window.stopTorreDashboard?.();
 window.torreData=Fonte.consolidate(Repositorio.sources);
 startDashboard();
}
