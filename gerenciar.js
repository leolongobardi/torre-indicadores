'use strict';

const Gerencia=(()=>{
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=new Intl.NumberFormat('pt-BR');
 const day=x=>x.split('-').reverse().join('/');
 const date=x=>new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(x));
 const scope=kind=>kind==='fuel'?'Postos':'Ciclo';
 function html(kind){
  const list=Repositorio.sources.filter(x=>x.kind===kind);
  const archived=Repositorio.archived.filter(x=>x.kind===kind);
  return `<section class="panel"><div class="phead"><div><h2>Importar bases de ${scope(kind)}</h2><p>Selecione uma ou mais planilhas .xlsx ou .xlsm no formato da base original.</p></div></div>
  <div class="upload"><label for="file-bases">Arquivos de ${scope(kind)}</label><input id="file-bases" data-source-kind="${kind}" type="file" accept=".xlsx,.xlsm" multiple></div>
  <p id="upload-status" class="note" role="status" aria-live="polite"></p>
  <p class="note">${Repositorio.hosted?'As alterações são salvas no catálogo deste projeto e ficam disponíveis em outros aparelhos.':'Neste HTML, as alterações ficam salvas neste navegador.'}</p></section>
  <section class="panel"><div class="phead"><div><h2>Bases importadas</h2><p>${fmt.format(list.length)} ${list.length===1?'base ativa':'bases ativas'} neste painel. Ao excluir uma base, os indicadores são recalculados.</p></div></div>
  ${list.length?`<div class="tablewrap"><table><thead><tr><th scope="col">Planilha</th><th scope="col">Período</th><th scope="col">Linhas lidas</th><th scope="col">Importada em</th><th scope="col">Ação</th></tr></thead><tbody>${list.map(s=>`<tr><td><strong>${esc(s.name)}</strong></td><td>${day(s.start)} a ${day(s.end)}</td><td>${fmt.format(s.count)}${s.skipped?` <small>(${fmt.format(s.skipped)} ignoradas)</small>`:''}</td><td>${date(s.imported)}</td><td><button type="button" data-remove-source="${s.id}" aria-label="Excluir ${esc(s.name)}">Excluir base</button></td></tr>`).join('')}</tbody></table></div>`:'<p class="empty">Nenhuma planilha importada neste painel.</p>'}</section>${archived.length?`<section class="panel"><h2>Bases excluídas</h2>${archived.map(s=>`<p>${esc(s.name)} · ${day(s.start)} a ${day(s.end)} <button data-restore-source="${s.id}">Restaurar</button></p>`).join('')}</section>`:''}`;
 }
 const setMessage=(message,error=false)=>{
  const status=document.getElementById('upload-status');
  if(status){status.textContent=message;status.dataset.error=String(error);}
 };
 let busy=false;
 async function add(input,refresh){
  if(busy||!input.files?.length)return;
  busy=true;input.disabled=true;
  const messages=[];
  try{
   for(const file of Array.from(input.files)){
    setMessage('Processando '+file.name+'…');
    try{
     await Repositorio.add(await Fonte.spreadsheet(input.dataset.sourceKind,file));
     messages.push({text:file.name+' importada.',error:false});
    }catch(e){messages.push({text:file.name+': '+(e.message||'não foi possível importar.'),error:true});}
   }
  }finally{busy=false;refresh();setMessage(messages.map(x=>x.text).join(' '),messages.some(x=>x.error));}
 }
 async function remove(id,refresh){
  if(busy)return;
  const source=Repositorio.sources.find(s=>s.id===id);
  if(!source||!window.confirm('Excluir '+source.name+' e recalcular os indicadores?'))return;
  busy=true;
  setMessage('Removendo '+source.name+'…');
  try{await Repositorio.remove(id);refresh();setMessage(source.name+' excluída.');}
  catch(e){setMessage(e.message,true);}
  finally{busy=false;}
 }
 return {html,add,remove};
})();
