import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFile(resolve(root,p),'utf8');
const values={'/*STYLE*/':'estilo.css','/*SCRIPT*/':'painel.js','/*ZIP*/':'vendor/jszip.min.js','/*IMPORT*/':'importacao.js','/*STORAGE*/':'bases.js','/*MANAGER*/':'gerenciar.js'};
let html=await read('pagina.html');
for(const [slot,path] of Object.entries(values)){
 const source=await read(path);
 html=html.replace(slot,()=>source.replace(/<\/script/gi,'<\\/script'));
}
const offline=process.argv.includes('--offline');
const output=resolve(root,offline?'offline/Torre_Indicadores.html':'dist/index.html');
const seed=offline?'<script id="seed-bases" type="application/json">'+(await read('seed/bases.json')).replace(/</g,'\\u003c')+'</script>':'';
await mkdir(dirname(output),{recursive:true});
await writeFile(output,html.replace('<!--SEED-->',()=>seed));
console.log(output);
