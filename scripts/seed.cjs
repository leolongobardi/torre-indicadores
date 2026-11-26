const fs=require('node:fs/promises');
const zlib=require('node:zlib');
global.JSZip=require('../vendor/jszip.min.js');
const Fonte=require('../importacao.js');
(async()=>{
 const args=process.argv.slice(2);
 const sources=[];
 for(const filepath of args){
  const bytes=await fs.readFile(filepath);
  const name=require('node:path').basename(filepath);
  const target=name.startsWith('Ciclo')?'cycle':'fuel';
  const source=await Fonte.spreadsheet(target,new File([bytes],name));
  console.log(name,source.count,source.start,source.end,source.skipped);
  sources.push(source);
 }
 const grouped=Fonte.consolidate(sources);
 console.log(grouped.fuel.audit,grouped.cycle.audit,grouped.cycle.trips.length);
 await fs.mkdir('seed',{recursive:true});
 const manifest=[];
 for(const {rows,...meta} of sources){
  const content=zlib.gzipSync(JSON.stringify(rows),{level:9}).toString('base64');
  manifest.push({...meta,content});
 }
 await fs.writeFile('seed/bases.json',JSON.stringify(manifest));
})();
