const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=()=>JSON.parse(fs.readFileSync(path.join(root,'seed/bases.json'),'utf8'));
const quote=s=>"'"+String(s).replaceAll("'","''")+"'";
const gate='(SELECT revision FROM catalogue WHERE singleton=1) = 0';
function seedSql(sources){
 const sql=[];
 for(const s of sources){
  const fields=[s.id,s.kind,s.name,s.start,s.end,s.imported].map(quote).concat(s.count,s.skipped);
  sql.push('INSERT OR IGNORE INTO sources SELECT '+fields.join(', ')+' WHERE '+gate+';');
  for(let i=0;i<s.content.length;i+=48000)sql.push('INSERT OR IGNORE INTO source_chunks SELECT '+
   [quote(s.id),i/48000,quote(s.content.slice(i,i+48000))].join(', ')+' WHERE '+gate+';');
 }
 sql.push("UPDATE catalogue SET revision = 1, stamp = 'initial-seed' WHERE singleton=1 AND revision=0;");
 return sql.join('\n')+'\n';
}
if(require.main===module){
 const output=path.join(root,'seed','catalogo.sql');
 fs.writeFileSync(output,seedSql(read()));
 console.log(output);
}
module.exports={read,seedSql};
