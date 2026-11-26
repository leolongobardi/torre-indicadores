const maxBody=11_000_000;
const idPattern=/^[a-f0-9]{64}$/;
const calendar=/^\d{4}-\d{2}-\d{2}$/;
const commitCondition='EXISTS (SELECT 1 FROM catalogue WHERE stamp = ?)';
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const fail=(error,status)=>json({error},status);
const headers='id, kind, name, date_start AS start, date_end AS end, imported_at AS imported, row_count AS count, skipped';

function goodMeta(s,id){
 return s?.id===id&&['fuel','cycle'].includes(s.kind)&&typeof s.name==='string'&&s.name.length>0&&s.name.length<260&&
 calendar.test(s.start)&&calendar.test(s.end)&&s.start<=s.end&&[s.count,s.skipped].every(n=>Number.isSafeInteger(n)&&n>=0)&&s.count>0&&s.count<=500000;
}
const chunk=(db,id,seq,encoded,stamp)=>db.prepare(
 'INSERT INTO source_chunks SELECT ?, ?, ? WHERE '+commitCondition
).bind(id,seq,encoded,stamp);

async function update(request,db,id){
 const origin=request.headers.get('Origin');
 if(origin&&origin!==new URL(request.url).origin)return fail('Origem inválida.',403);
 if(!request.headers.get('Content-Type')?.startsWith('application/json'))return fail('Formato esperado: JSON.',415);
 const advertised=Number(request.headers.get('Content-Length'));
 if(advertised>maxBody)return fail('Base muito grande.',413);
 const reader=request.body?.getReader();
 if(!reader)return fail('Corpo ausente.',400);
 let size=0,encoded='';
 const decoder=new TextDecoder();
 for(;;){
  const next=await reader.read();
  if(next.done)break;
  size+=next.value.byteLength;
  if(size>maxBody){await reader.cancel();return fail('Base muito grande.',413);}
  encoded+=decoder.decode(next.value,{stream:true});
 }
 encoded+=decoder.decode();
 let body;
 try{body=JSON.parse(encoded);}catch{return fail('JSON inválido.',400);}
 if(!Number.isSafeInteger(body?.revision)||body.revision<0)return fail('Revisão inválida.',400);
 const {revision,source,content}=body;
 const saving=request.method==='PUT';
 if(saving&&(!goodMeta(source,id)||typeof content!=='string'||!content.length||content.length%4||!/^H4sI[A-Za-z0-9+/]+={0,2}$/.test(content))){
  return fail('Dados da base inválidos.',400);
 }
 const stamp=crypto.randomUUID();
 const gate=db.prepare('UPDATE catalogue SET revision = revision + 1, stamp = ? WHERE revision = ? AND '+
  (saving?'NOT ':'')+'EXISTS (SELECT 1 FROM sources WHERE id = ?)').bind(stamp,revision,id);
 const writes=[gate];
 if(saving){
  writes.push(db.prepare('INSERT INTO sources SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE '+commitCondition)
   .bind(id,source.kind,source.name,source.start,source.end,new Date().toISOString(),source.count,source.skipped,stamp));
  for(let i=0;i<content.length;i+=600_000)writes.push(chunk(db,id,i/600_000,content.slice(i,i+600_000),stamp));
 }else{
  writes.push(db.prepare('DELETE FROM source_chunks WHERE source_id = ? AND '+commitCondition).bind(id,stamp));
  writes.push(db.prepare('DELETE FROM sources WHERE id = ? AND '+commitCondition).bind(id,stamp));
 }
 const [result]=await db.batch(writes);
 if(!result.meta.changes){
  const head=await db.prepare('SELECT revision FROM catalogue WHERE singleton=1').first();
  if(head.revision!==revision)return fail('As bases mudaram em outro aparelho. Recarregue antes de tentar novamente.',409);
  return fail(saving?'Esta base já foi importada.':'Base não encontrada.',saving?409:404);
 }
 return json({revision:revision+1},saving?201:200);
}

async function api(request,env,path){
 if(!env.DB)return fail('Banco de dados do Torre Indicadores indisponível.',503);
 if(path==='/api/data'&&request.method==='GET'){
  const [h,s]=await env.DB.batch([
   env.DB.prepare('SELECT revision FROM catalogue WHERE singleton=1'),
   env.DB.prepare('SELECT '+headers+' FROM sources ORDER BY imported_at, rowid')]);
  return json({revision:h.results[0].revision,sources:s.results});
 }
 const id=path.slice('/api/data/'.length);
 if(!idPattern.test(id))return fail('Rota inválida.',404);
 if(request.method==='PUT'||request.method==='DELETE')return update(request,env.DB,id);
 if(request.method==='GET'){
  const result=await env.DB.prepare('SELECT content FROM source_chunks WHERE source_id = ? ORDER BY seq').bind(id).all();
  return result.results.length?json({content:result.results.map(x=>x.content).join('')}):fail('Base não encontrada.',404);
 }
 return fail('Método inválido.',405);
}
export default {async fetch(request,env){
 const path=new URL(request.url).pathname;
 if(path!=='/api/data'&&!path.startsWith('/api/data/'))return env.ASSETS.fetch(request);
 try{return await api(request,env,path);}
 catch(error){console.error('Falha no catálogo de bases',error.message);return fail('Falha ao acessar o catálogo. Confira se a migração D1 foi aplicada.',500);}
}};
