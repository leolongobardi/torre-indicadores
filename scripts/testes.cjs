const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const { DatabaseSync }=require('node:sqlite');
const {gunzipSync,gzipSync}=require('node:zlib');
const vm=require('node:vm');
const path=require('node:path');
global.JSZip=require('../vendor/jszip.min.js');
const Fonte=require('../importacao.js');
const {seedSql,read}=require('./seed-sql.cjs');
const root=path.resolve(__dirname,'..');
const seeds=fs.existsSync(path.join(root,'seed/bases.json'))?read():[];
const sources=seeds.map(({content,...s})=>({...s,rows:JSON.parse(gunzipSync(Buffer.from(content,'base64')))}));
const context=(source)=>({
 window:{torreData:Fonte.consolidate(source),addEventListener(){},scrollTo(){}},
 document:{getElementById(id){return id==='main'?this.main:{setAttribute(){},removeAttribute(){}};},main:{innerHTML:'',addEventListener(){},querySelectorAll(){return [];}}},
 location:{hash:'#postos'}, requestAnimationFrame(){},Intl,AbortController,assert,
 Gerencia:{html(kind){return 'Gerenciar '+kind;}},console
});

test('As bases iniciais preservam os indicadores e a exclusão muda só o painel correspondente',{skip:!seeds.length},()=>{
 const all=Fonte.consolidate(sources);
 assert.equal(all.fuel.day[0][0],'2026-07-01');
 assert.equal(all.fuel.day.at(-1)[0],'2026-10-31');
 assert.equal(all.fuel.movements.filter(r=>r[8]).length,16588);
 assert.equal(all.fuel.movements.filter(r=>r[9]).length,11562);
 assert.equal(all.cycle.trips.length,19521);
 assert.equal(all.cycle.trips.filter(r=>r[9]===15).length,9176);
 assert.equal(all.cycle.audit.invalidMinutes,107);
 const removed=Fonte.consolidate(sources.filter(s=>s.name!=='Resumo (8).xlsx'));
 assert.equal(removed.fuel.day.at(-1)[0],'2026-09-30');
 assert.deepEqual(removed.cycle,all.cycle);
 const restored=Fonte.consolidate([...sources,sources.find(s=>s.name==='Resumo (8).xlsx')]);
 assert.equal(restored.fuel.movements.length,all.fuel.movements.length);
});

test('Importação XLSX aceita endereços explícitos e cabeçalho correto',async()=>{
 const zip=new JSZip();
 const names=['Data','ID','Transportadora','Nome','Prefixo','Entrada Cerca','Entrada IONICS','Dif Entrada','Saída IONICS','Saída Cerca','Dif Saída','Tempo Cerca'];
 const row=a=>'<row>'+a.map((v,i)=>`<c r="${String.fromCharCode(65+i)}1" t="inlineStr"><is><t>${v}</t></is></c>`).join('')+'</row>';
 const vals=['2026-11-24','1','AFL','Posto Combustível Puma','AFL051','2026-11-24T12:12:00','2026-11-24T12:00:00','','2026-11-24T12:20:00','2026-11-24T12:20:00','','8'];
 zip.file('xl/worksheets/sheet1.xml','<worksheet>'+row(names)+row(vals)+'</worksheet>');
 const file=new File([await zip.generateAsync({type:'uint8array'})],'entrada.xlsx');
 const s=await Fonte.spreadsheet('fuel',file);
 assert.equal(s.count,1);assert.equal(s.start,'2026-11-24');
 assert.equal(Fonte.consolidate([s]).fuel.pump[0][3],8);
 await assert.rejects(()=>Fonte.spreadsheet('cycle',file),/cabeçalhos/);
});

test('Menus de indicadores e importação renderizam com e sem bases',()=>{
 const code=fs.readFileSync(path.join(root,'painel.js'),'utf8');
 for(const src of [sources,[]]){
  const c=vm.createContext(context(src));
  vm.runInContext(code,c);
  for(const [hash,heading] of [['#postos','Postos de combustível'],['#ciclo','Ciclo florestal'],['#postos/importacao','Gerenciar fuel'],['#ciclo/importacao','Gerenciar cycle']]){
   vm.runInContext(`location.hash=${JSON.stringify(hash)};startDashboard();`,c);
   assert(c.document.main.innerHTML.includes(heading),hash);
  }
 }
});

test('D1 grava, exclui e rejeita mutações com uma revisão desatualizada',async()=>{
 const sqlite=new DatabaseSync(':memory:');
 const sample=(id,kind)=>({id:id.repeat(64),kind,name:id+'.xlsx',start:'2026-10-01',end:'2026-10-01',imported:'2026-11-26T12:00:00.000Z',count:1,skipped:0,content:gzipSync(JSON.stringify([[id]])).toString('base64')});
 const workerSeeds=seeds.length?seeds:[sample('a','fuel'),sample('b','fuel'),sample('c','cycle')];
 sqlite.exec(fs.readFileSync(path.join(root,'migrations/0001_bases.sql'),'utf8'));
 sqlite.exec(seedSql(workerSeeds));
 class SQL{
  constructor(query,args=[]){this.query=query;this.args=args;}
  bind(...args){return new SQL(this.query,args);}
  async all(){return this.run();}
  async first(){return this.run().results[0]??null;}
  run(){
   const s=sqlite.prepare(this.query);
   if(this.query.startsWith('SELECT'))return {results:s.all(...this.args),meta:{changes:0}};
   return {results:[],meta:s.run(...this.args)};
  }
 }
 const DB={prepare:q=>new SQL(q),async batch(items){
  sqlite.exec('BEGIN');
  try{const out=items.map(x=>x.run());sqlite.exec('COMMIT');return out;}
  catch(e){sqlite.exec('ROLLBACK');throw e;}
 }};
 const worker=(await import('../worker.mjs')).default;
 const send=(suffix='',opts={})=>worker.fetch(new Request('https://torre.example/api/data'+suffix,{...opts}),{DB});
 const catalog=await (await send()).json();
 assert.equal(catalog.sources.length,3);
 const seed=catalog.sources[0];
 const stored=await (await send('/'+seed.id)).json();
 assert.equal(stored.content,workerSeeds[0].content);
 const mutate=(method,id,body)=>send('/'+id,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const removed=await mutate('DELETE',seed.id,{revision:1});assert.equal(removed.status,200);
 assert.equal((await mutate('PUT',seed.id,{revision:1,source:seed,content:stored.content})).status,409);
 assert.equal((await send('/'+seed.id)).status,404);
 sqlite.exec(seedSql(workerSeeds));
 assert.equal((await send('/'+seed.id)).status,404);
 const added=await mutate('PUT',seed.id,{revision:2,source:seed,content:stored.content});assert.equal(added.status,201);
 assert.equal((await (await send()).json()).sources.length,3);
 sqlite.close();
});
