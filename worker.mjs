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

const textCell = value => value === null || (typeof value === 'string' && value.length <= 512 && !/[<>\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value));
const numberCell = value => value === null || Number.isFinite(value);
const timestamp = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d$/.test(value);
function validRow(r,kind) {
 if (!Array.isArray(r) || typeof r[0] !== 'string' || !calendar.test(r[0])) return false;
 if (kind === 'fuel') return r.length === 11 && !!r[1] && [1,3,4].every(i=>textCell(r[i])) &&
  [0,1].includes(r[2]) && [0,1].includes(r[5]) && timestamp(r[6]) &&
  [7,8,9].every(i=>r[i]===null || timestamp(r[i])) && Number.isFinite(r[10]) && r[10]>=0;
 return (r.length===15 || (r.length===16 && textCell(r[15]))) && [1,2,3,4,5,6,7,10,14].every(i=>textCell(r[i])) &&
  [8,9,13].every(i=>numberCell(r[i])) && [11,12].every(i=>r[i]===null || timestamp(r[i]));
}
async function validReport(content,source,id) {
 const reader = new Blob([Uint8Array.from(atob(content),c=>c.charCodeAt(0))]).stream()
  .pipeThrough(new DecompressionStream('gzip')).getReader();
 const chunks=[];
 let bytes=0;
 for (;;) {
  const {done,value}=await reader.read();
  if(done)break;
  bytes+=value.length;
  if(bytes>26_000_000){await reader.cancel();return false;}
  chunks.push(value);
 }
 const raw=await new Blob(chunks).arrayBuffer();
 const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',raw));
 if(Array.from(digest,b=>b.toString(16).padStart(2,'0')).join('')!==id)return false;
 // Read a single normalized row at a time. Excel text may contain commas or brackets.
 const input=new TextDecoder('utf-8',{fatal:true}).decode(raw);
 if(input[0]!=='[' || input.at(-1)!==']')return false;
 const rowPattern=/\[(?:[^\[\]"\\]|"(?:[^"\\]|\\.)*")*\]/y;
 let pos=1,count=0,start=null,end=null,hasId=false;
 while(pos<input.length-1){
  rowPattern.lastIndex=pos;
  const match=rowPattern.exec(input);
  if(!match)return false;
  const row=JSON.parse(match[0]);
  if(!validRow(row,source.kind))return false;
  count++;hasId ||= Boolean(row[1]);
  if(start===null || row[0]<start)start=row[0];
  if(end===null || row[0]>end)end=row[0];
  pos=rowPattern.lastIndex;
  if(pos===input.length-1)break;
  if(input[pos++]!==',' || pos===input.length-1)return false;
 }
 return count===source.count && hasId && start===source.start && end===source.end;
}
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
 if(!goodMeta(source,id)||typeof content!=='string'||!content.length||content.length%4||!/^H4sI[A-Za-z0-9+/]+={0,2}$/.test(content)){
  return fail('Dados da base inválidos.',400);
 }
 if(!/\.(xlsx|xlsm)$/i.test(source.name))return fail('Selecione um arquivo XLSX ou XLSM.',400);
 try {if(!await validReport(content,source,id))return fail('Dados incompatíveis com o painel selecionado.',400);}
 catch{return fail('Dados compactados inválidos.',400);}
 const stamp=crypto.randomUUID();
 const gate=db.prepare('UPDATE catalogue SET revision = revision + 1, stamp = ? WHERE revision = ? AND '+
  'NOT EXISTS (SELECT 1 FROM sources WHERE id = ?) AND '+
  "(SELECT COUNT(*) FROM sources WHERE imported_at >= strftime('%Y-%m-%d','now')) < 24 AND "+
  '(SELECT COALESCE(SUM(length(content)),0) FROM source_chunks) + ? <= 192000000').bind(stamp,revision,id,content.length);
 const writes=[gate];
  writes.push(db.prepare('INSERT INTO sources SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE '+commitCondition)
   .bind(id,source.kind,source.name,source.start,source.end,new Date().toISOString(),source.count,source.skipped,stamp));
  for(let i=0;i<content.length;i+=600_000)writes.push(chunk(db,id,i/600_000,content.slice(i,i+600_000),stamp));

 const [result]=await db.batch(writes);
 if(!result.meta.changes){
  const head=await db.prepare('SELECT revision FROM catalogue WHERE singleton=1').first();
  if(head.revision!==revision)return fail('As bases mudaram em outro aparelho. Recarregue antes de tentar novamente.',409);
  if(await db.prepare('SELECT id FROM sources WHERE id = ?').bind(id).first())return fail('Esta base já foi importada.',409);
  return fail('Limite de importações diárias ou de armazenamento atingido.',429);
 }
 return json({revision:revision+1},201);
}

const initialCapacity = [[[16, 24, 24, 24, 20, 20, 20], [16, 24, 24, 24, 20, 20, 20], [16, 24, 24, 24, 20, 20, 20], [8, 16, 16, 16, 12, 12, 12], [8, 12, 12, 12, 12, 12, 12], [16, 20, 20, 20, 16, 16, 16], [12, 24, 24, 24, 16, 16, 16], [8, 24, 24, 24, 16, 16, 16], [24, 28, 28, 28, 28, 28, 24], [24, 28, 28, 28, 28, 28, 24], [24, 28, 28, 28, 28, 28, 24], [16, 16, 16, 16, 16, 16, 16], [16, 20, 20, 20, 20, 20, 16], [16, 20, 20, 20, 20, 20, 16], [24, 28, 28, 28, 28, 28, 24], [24, 28, 28, 28, 28, 28, 24], [24, 24, 24, 24, 24, 24, 24], [24, 24, 24, 24, 24, 24, 24], [24, 24, 24, 24, 24, 24, 24], [16, 16, 16, 16, 16, 16, 16], [16, 16, 16, 16, 16, 16, 16], [16, 16, 16, 16, 16, 16, 16], [24, 24, 24, 24, 24, 24, 24], [20, 20, 20, 20, 20, 20, 20]], [[12, 12, 12, 12, 12, 12, 12], [12, 12, 12, 12, 12, 12, 12], [12, 12, 12, 12, 12, 12, 12], [8, 8, 8, 8, 8, 8, 8], [8, 8, 8, 8, 8, 8, 8], [8, 8, 8, 8, 8, 8, 8], [12, 12, 12, 12, 12, 12, 12], [8, 12, 12, 12, 12, 12, 8], [12, 24, 24, 24, 24, 24, 20], [12, 24, 24, 24, 24, 24, 20], [12, 24, 24, 24, 24, 24, 20], [8, 16, 16, 16, 16, 16, 16], [8, 16, 16, 16, 16, 16, 12], [8, 16, 16, 16, 16, 16, 12], [12, 24, 24, 24, 24, 24, 20], [8, 24, 24, 24, 24, 24, 20], [12, 20, 20, 20, 20, 20, 20], [12, 16, 16, 16, 16, 16, 16], [12, 8, 8, 8, 8, 8, 8], [8, 12, 12, 12, 12, 12, 12], [8, 8, 8, 8, 8, 8, 8], [8, 12, 12, 12, 12, 12, 12], [12, 16, 16, 16, 16, 16, 16], [8, 12, 12, 12, 12, 12, 12]]];
async function capacity(request,db){
 await db.prepare('CREATE TABLE IF NOT EXISTS station_capacity (id INTEGER PRIMARY KEY, revision INTEGER NOT NULL, grid TEXT NOT NULL)').run();
 if(request.method==='GET'){
  const row=await db.prepare('SELECT revision,grid FROM station_capacity WHERE id=1').first();
  return json(row?{revision:row.revision,grid:JSON.parse(row.grid)}:{revision:0,grid:initialCapacity});
 }
 if(request.method!=='PUT')return fail('Método inválido.',405);
 if(request.headers.get('Origin')!==new URL(request.url).origin)return fail('Origem inválida.',403);
 if(!request.headers.get('Content-Type')?.startsWith('application/json') || Number(request.headers.get('Content-Length')||Infinity)>12000)return fail('Formato inválido.',400);
 const {revision,grid}=await request.json().catch(()=>({}));
 if(!Number.isSafeInteger(revision)||revision<0||!Array.isArray(grid)||grid.length!==2||
 !grid.every(m=>Array.isArray(m)&&m.length===24&&m.every(r=>Array.isArray(r)&&r.length===7&&r.every(n=>Number.isSafeInteger(n)&&n>=0&&n<=9999))))return fail('Capacidade inválida.',400);
 const stmt=revision===0?db.prepare('INSERT OR IGNORE INTO station_capacity VALUES(1,1,?)').bind(JSON.stringify(grid)):
 db.prepare('UPDATE station_capacity SET grid=?,revision=revision+1 WHERE id=1 AND revision=?').bind(JSON.stringify(grid),revision);
 const result=await stmt.run();
 return result.meta.changes?json({revision:revision+1}):fail('Os parâmetros mudaram em outro aparelho. Recarregue a página.',409);
}

async function fieldGoal(request,db){
 await db.prepare('CREATE TABLE IF NOT EXISTS field_goal (id INTEGER PRIMARY KEY, revision INTEGER NOT NULL, grid TEXT NOT NULL)').run();
 if(request.method==='GET'){
  const row=await db.prepare('SELECT revision,grid FROM field_goal WHERE id=1').first();
  return json(row?{revision:row.revision,grid:JSON.parse(row.grid)}:{revision:0,grid:69});
 }
 if(request.method!=='PUT')return fail('Método inválido.',405);
 if(request.headers.get('Origin')!==new URL(request.url).origin)return fail('Origem inválida.',403);
 if(!request.headers.get('Content-Type')?.startsWith('application/json') || Number(request.headers.get('Content-Length')||Infinity)>12000)return fail('Formato inválido.',400);
 const {revision,grid}=await request.json().catch(()=>({}));
 if(!Number.isSafeInteger(revision)||revision<0||!Number.isFinite(grid)||grid<=0||grid>1440)return fail('Capacidade inválida.',400);
 const stmt=revision===0?db.prepare('INSERT OR IGNORE INTO field_goal VALUES(1,1,?)').bind(JSON.stringify(grid)):
 db.prepare('UPDATE field_goal SET grid=?,revision=revision+1 WHERE id=1 AND revision=?').bind(JSON.stringify(grid),revision);
 const result=await stmt.run();
 return result.meta.changes?json({revision:revision+1}):fail('Os parâmetros mudaram em outro aparelho. Recarregue a página.',409);
}

async function api(request,env,path){
 if(path==='/api/data/versao' && request.method==='GET')return json({importacaoPublica:true,formatos:['xlsx','xlsm'],validacao:'estrutura'});
 if(!env.DB)return fail('Banco de dados do Torre Indicadores indisponível.',503);
 if(path==='/api/data/meta-campo')return fieldGoal(request,env.DB);
 if(path==='/api/data/capacidade')return capacity(request,env.DB);
 if(path==='/api/data'&&request.method==='GET'){
  const [h,s]=await env.DB.batch([
   env.DB.prepare('SELECT revision FROM catalogue WHERE singleton=1'),
   env.DB.prepare('SELECT '+headers+' FROM sources ORDER BY imported_at, rowid')]);
  return json({revision:h.results[0].revision,sources:s.results});
 }
 const id=path.slice('/api/data/'.length);
 if(!idPattern.test(id))return fail('Rota inválida.',404);
 if(request.method==='PUT')return update(request,env.DB,id);
 if(request.method==='DELETE')return fail('O painel público está em modo de consulta. A edição de bases requer acesso administrativo.',403);
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

