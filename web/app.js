'use strict';
const $ = id => document.getElementById(id);
const Core = globalThis.SupplyLensCore;
const offline = Boolean(window.SUPPLYLENS_PREVIEW);
const scrollBehavior=matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth';
let mode='demo', cases=[], caseId='field', result=null, snapshot=null, states=[], busy=false, expanded=false, draftDirty=false, toastTimer;
const disabledWhileBusy=['demo','live','load','case-select','brief','reply','brief-file','reply-file','analyze','hero-demo'];
function el(tag,text,cls) { const n=document.createElement(tag); if(text!==undefined)n.textContent=text; if(cls)n.className=cls; return n; }
function toast(message) { clearTimeout(toastTimer); $('toast').textContent=message; $('toast').hidden=false; toastTimer=setTimeout(()=>$('toast').hidden=true,4200); }
function showError(message) { $('error').textContent=message; $('error').hidden=false; }
function countDocuments() { for(const id of ['brief','reply'])$(id+'-count').textContent=$(id).value.length.toLocaleString('en')+' / 16,000'; }
function invalidate() { result=null; snapshot=null; states=[]; $('results').hidden=true; $('error').hidden=true; $('draft-stale').hidden=true; }
function currentCase() { return cases.find(c=>c.id===caseId) || cases[0]; }
async function api(path,options) {
  if(offline) {
    if(path==='/api/examples')return {ok:true,json:async()=>window.SUPPLYLENS_PREVIEW};
    const input=JSON.parse(options.body);
    if(input.mode==='live')return {ok:false,json:async()=>({error:'Live analysis requires the Python server and an API key. This offline preview supports sample replays only.'})};
    const c=cases.find(item=>item.id===input.case_id);
    if(!c||input.brief!==c.brief||input.reply!==c.reply)return {ok:false,json:async()=>({error:'Sample replay requires the unchanged example documents.'})};
    return {ok:true,json:async()=>({mode:'demo',case_id:c.id,...c.result})};
  }
  return fetch(path,options);
}
function setMode(value) {
  if(busy)return;
  mode=value; invalidate();
  for(const id of ['demo','live']) { $(id).classList.toggle('active',id===mode); $(id).setAttribute('aria-pressed',String(id===mode)); }
  $('brief').readOnly=$('reply').readOnly=mode==='demo';
  $('mode-note').textContent=mode==='demo'?'Sample replay shows a fixed, hand-reviewed result. No AI request is made.':offline?'Live AI needs the Python server. You can edit the text here, but this offline preview only runs sample replays.':'Live AI analyzes your text. Source quotes are checked before the findings are displayed.';
  $('privacy-title').textContent=mode==='demo'?'A safe place to explore.':'Your documents, your choice.';
  $('privacy').textContent=mode==='demo'?'Synthetic sample. Replay runs without sending documents to an AI provider.':'Both documents are sent to OpenAI in live mode. Use appropriately redacted text. No document history is saved.';
  if(mode==='demo')loadSample(false);
}
function loadSample(notify=true) {
  if(busy||!cases.length)return;
  const c=currentCase(); $('brief').value=c.brief; $('reply').value=c.reply;
  invalidate();countDocuments();
  if(notify)toast('Sample loaded. '+c.name+'.');
}
async function importText(id,file) {
  if(!file||busy)return;
  if(!/\.(txt|md)$/i.test(file.name)){showError('Import a .txt or .md file. PDF and Word import are not supported in this version.');return;}
  if(file.size>65000){showError('This file is too large. Import up to 16,000 characters per document.');return;}
  try {
    const text=await file.text();
    if(text.length>16000||text.includes('\u0000'))throw Error('Use a plain-text document with at most 16,000 characters.');
    if(mode!=='live')setMode('live');
    if(mode!=='live')return;
    $(id).value=text;invalidate();countDocuments();toast('Imported '+file.name+'.');
  }catch(e){showError(e.message||'Could not read that file.');}
  finally{$(id+'-file').value='';}
}
function setPane(value,focus=false) {
  for(const name of ['findings','followup']) {
    const active=name===value;
    $(name+'-tab').setAttribute('aria-selected',String(active));$(name+'-tab').tabIndex=active?0:-1;$(name+'-pane').hidden=!active;
  }
  if(focus)$(value+'-tab').focus();
}
function updateProgress() {
  if(!result)return;
  const count=states.filter(s=>s.reviewed).length;
  $('reviewed-count').textContent=count;$('reviewed-total').textContent='/ '+states.length+' checked';
  $('review-progress').max=states.length;$('review-progress').value=count;
  $('outline').replaceChildren(...Core.filterFindings(result.findings,states,'all','').map(({row,index})=>{
    const b=el('button',undefined,'outline-button');b.type='button';
    b.append(el('span',undefined,'outline-dot '+row.status),el('span',row.topic));
    if(states[index].reviewed)b.append(el('span','✓','review-tick'));
    b.onclick=()=>{setPane('findings');$('search').value='';$('filter').value='all';renderFindings();const target=$('finding-'+index);target.open=true;target.scrollIntoView({behavior:scrollBehavior,block:'center'});target.querySelector('summary').focus({preventScroll:true});};
    return b;
  }));
}
function setFilter(value) { $('filter').value=value;setPane('findings');renderFindings(); }
function updateSummarySelection() { for(const b of $('summary').children){const selected=b.dataset.status===$('filter').value;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));} }
function renderSummary() {
  $('summary').replaceChildren(...Core.statuses.map(status=>{
    const count=result.findings.filter(r=>r.status===status).length;
    const b=el('button',undefined,'stat '+status);b.dataset.status=status;b.type='button';b.setAttribute('aria-label',`${count} ${Core.labels[status]}. Filter findings.`);
    const top=el('span',undefined,'stat-top');top.append(el('strong',String(count)),el('span',Core.symbols[status],'stat-icon'));
    b.append(top,el('span',Core.labels[status],'stat-label'));b.onclick=()=>setFilter($('filter').value===status?'all':status);return b;
  }));updateSummarySelection();
}
function evidence(label,text,sourceId) {
  const box=el('div',undefined,'evidence'+(!text?' no-evidence':'')),head=el('div',undefined,'evidence-label');head.append(el('span',label));
  if(text){const b=el('button','↗','source-link');b.type='button';b.setAttribute('aria-label','Locate quote in '+(sourceId==='brief'?'requirements':'supplier reply'));b.title='Locate quote in document';b.onclick=()=>{const t=$(sourceId);const start=t.value.indexOf(text);if(start<0)return;t.scrollIntoView({behavior:scrollBehavior,block:'center'});t.focus({preventScroll:true});t.setSelectionRange(start,start+text.length);toast('Source quote selected in '+(sourceId==='brief'?'requirements':'supplier reply')+'.');};head.append(b);}
  box.append(head,el('blockquote',text||'No relevant statement in the supplier’s reply.'));return box;
}
function checkbox(label,checked,callback) {const wrapper=el('label',undefined,'check-label'),input=el('input');input.type='checkbox';input.checked=checked;input.onchange=()=>callback(input.checked);wrapper.append(input,el('span',label));return wrapper;}
function findingCard(row,index) {
  const state=states[index],card=el('details',undefined,'finding '+row.status+(state.reviewed?' reviewed':''));card.id='finding-'+index;
  card.open=state.open??(expanded||row.status!=='aligned');card.ontoggle=()=>{state.open=card.open;};
  const verifiedLabel=result.mode==='structured'?(row.priority==='critical'?'CRITICAL · Values compared':'Values compared'):'Source quotes checked';
  const summary=el('summary'),title=el('div',undefined,'finding-summary-text');title.append(el('h3',row.topic,'finding-title'),el('span',state.reviewed?'Reviewed by you':verifiedLabel,'finding-subtitle'));
  summary.append(el('span',Core.symbols[row.status],'finding-symbol'),title,el('span',row.status==='aligned'?'Aligned claim':row.status==='missing'?'Not addressed':row.status==='unclear'?'Unclear':'Conflict','badge '+row.status),el('span','+','finding-chevron'));
  const body=el('div',undefined,'finding-body');body.append(el('p',row.explanation,'finding-explanation'));
  const grid=el('div',undefined,'evidence-grid');grid.append(evidence('THE REQUIREMENT',row.requirement_quote,'brief'),evidence('THE REPLY',row.supplier_quote,'reply'));body.append(grid);
  if(row.question){const q=el('p',undefined,'finding-question');q.append(el('span','↳'),el('span',row.question));body.append(q);}
  const actions=el('div',undefined,'finding-actions');
  actions.append(checkbox('Reviewed by me',state.reviewed,value=>{state.reviewed=value;card.classList.toggle('reviewed',value);title.querySelector('.finding-subtitle').textContent=value?'Reviewed by you':verifiedLabel;updateProgress();if($('filter').value==='reviewed')renderFindings();}));
  if(row.status!=='aligned')actions.append(checkbox('Include in follow-up',state.include,value=>{state.include=value;$('draft-stale').hidden=false;updateQuestionCount();}));
  body.append(actions);
  const notes=el('div',undefined,'notes-wrap'),noteLabel=el('label','YOUR NOTE · SAVE A REVISION OR EXPORT');noteLabel.htmlFor='note-'+index;const input=el('textarea',undefined,'finding-notes');input.id='note-'+index;input.value=state.note;input.maxLength=2000;input.rows=1;input.placeholder='Add context, a decision or something to check…';input.setAttribute('aria-label','Review note for '+row.topic);input.oninput=()=>{state.note=input.value;};notes.append(noteLabel,input);body.append(notes);card.append(summary,body);return card;
}
function renderFindings() {
  if(!result)return;
  const filtered=Core.filterFindings(result.findings,states,$('filter').value,$('search').value);
  $('findings').replaceChildren(...filtered.map(({row,index})=>findingCard(row,index)));
  if(!filtered.length){const empty=el('div',undefined,'empty-state');empty.append(el('strong','Nothing in this view.'),el('span','Try another filter or a different search.'));$('findings').append(empty);}
  $('visible-count').textContent=filtered.length+' OF '+result.findings.length+' FINDINGS';updateSummarySelection();
}
function updateQuestionCount() {if(!result)return;const n=result.findings.filter((r,i)=>r.status!=='aligned'&&states[i].include).length;$('question-count').textContent=n+' question'+(n===1?'':'s')+' selected';}
function rebuildDraft(notify=true) {
  if(!result)return;
  const draft=Core.compose(result.findings,states,$('tone').value);$('draft').value=draft.text;draftDirty=false;$('draft-stale').hidden=true;updateQuestionCount();
  if(notify)toast('Draft rebuilt from '+draft.count+' selected question'+(draft.count===1?'':'s')+'.');
}
function render() {
  $('results').hidden=false;$('filter').value='all';$('search').value='';expanded=false;
  $('expand-all').replaceChildren(document.createTextNode('Expand all '),el('span','+'));
  $('findings-tab-count').textContent=result.findings.length;
  $('result-mode').textContent=result.mode==='structured'?'RULE-BASED REVIEW / VALUES COMPARED':result.mode==='demo'?'SAMPLE REPLAY / FIXED, HAND-REVIEWED RESULT':'LIVE AI / SOURCE QUOTES CHECKED';
  $('subject').value=(result.mode==='demo'?(currentCase()?.short_name||'Sample review'):'Supplier review')+' — points to confirm';
  renderSummary();updateProgress();renderFindings();setPane('findings');rebuildDraft(false);
  $('results').classList.remove('just-entered');requestAnimationFrame(()=>$('results').classList.add('just-entered'));
  $('results').scrollIntoView({behavior:scrollBehavior,block:'start'});$('review-title').focus({preventScroll:true});
}
async function compare() {
  if(busy||!cases.length)return;
  const brief=$('brief').value,reply=$('reply').value;
  if([brief,reply].some(t=>t.trim().length<10||t.length>16000)){showError('Add 10–16,000 characters to each document before comparing.');return;}
  busy=true;invalidate();disabledWhileBusy.forEach(id=>$(id).disabled=true);
  $('analysis-status').hidden=false;$('workspace').setAttribute('aria-busy','true');
  $('analysis-message').textContent=mode==='demo'?'Loading the hand-reviewed sample…':'Waiting for AI analysis and source-quote checks. This can take up to 70 seconds.';
  $('analyze-label').textContent=mode==='demo'?'Loading review…':'Comparing…';$('analyze-arrow').textContent='';$('analyze-arrow').classList.add('spinner');
  snapshot={brief,reply};
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),80000);
  try {
    const response=await api('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode,case_id:caseId,...snapshot}),signal:controller.signal});
    const data=await response.json();if(!response.ok)throw Error(data.error||'Analysis failed.');
    if(!Array.isArray(data.findings)||!data.findings.length)throw Error('The analysis returned no findings.');
    result=data;states=data.findings.map(r=>({reviewed:false,note:'',include:r.status!=='aligned',open:undefined}));render();
  }catch(e){showError(e.name==='AbortError'?'The request timed out. Shorten the documents or retry.':e.message||'Could not reach the local app.');}
  finally{clearTimeout(timer);busy=false;disabledWhileBusy.forEach(id=>$(id).disabled=false);$('analysis-status').hidden=true;$('workspace').removeAttribute('aria-busy');$('analyze-label').textContent='Find the gaps';$('analyze-arrow').classList.remove('spinner');$('analyze-arrow').textContent='↗';}
}
function makeReport() {return {application:'SupplyLens',version:'0.3',exported_at:new Date().toISOString(),mode:result.mode,case_id:result.case_id||null,documents:{...snapshot},findings:result.findings.map((row,i)=>({...row,reviewed:states[i].reviewed,note:states[i].note,include_in_follow_up:states[i].include})),subject:$('subject').value,follow_up:$('draft').value,draft_selection_changed:!$('draft-stale').hidden};}
function downloadReport() {
  if(!result)return;
  const format=$('export-format').value,report=makeReport();
  const contents=format==='csv'?Core.csv(report):format==='md'?Core.markdown(report):JSON.stringify(report,null,2);
  const mime=format==='csv'?'text/csv;charset=utf-8':format==='md'?'text/markdown;charset=utf-8':'application/json';
  const url=URL.createObjectURL(new Blob([contents],{type:mime})),link=el('a');link.href=url;link.download='supplylens-review.'+format;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);toast('Review exported as '+format.toUpperCase()+'.');
}
async function copyDraft() {
  const text='Subject: '+$('subject').value+'\n\n'+$('draft').value;
  try{await navigator.clipboard.writeText(text);toast('Message copied. Review it before sending.');}
  catch{$('draft').focus();$('draft').select();toast('Clipboard unavailable. The draft is selected for manual copying.');}
}
function openHelp() {if(!$('help-dialog').open)$('help-dialog').showModal();}
function closeHelp() {$('help-dialog').close();}
$('demo').onclick=()=>setMode('demo');$('live').onclick=()=>setMode('live');$('load').onclick=()=>loadSample();$('case-select').onchange=()=>{caseId=$('case-select').value;loadSample(false);};
$('analyze').onclick=compare;$('hero-demo').onclick=async()=>{setMode('demo');$('workspace').scrollIntoView({behavior:scrollBehavior});await compare();};
for(const id of ['brief','reply']){$(id).oninput=()=>{invalidate();countDocuments();};$(id+'-file').onchange=e=>importText(id,e.target.files[0]);}
$('search').oninput=renderFindings;$('filter').onchange=renderFindings;
$('findings-tab').onclick=()=>setPane('findings');$('followup-tab').onclick=()=>setPane('followup');
for(const name of ['findings','followup'])$(name+'-tab').onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();setPane(e.key==='Home'?'findings':e.key==='End'?'followup':name==='findings'?'followup':'findings',true);}};
$('to-followup').onclick=()=>{setPane('followup',true);$('followup-tab').scrollIntoView({behavior:scrollBehavior,block:'center'});};
$('expand-all').onclick=()=>{expanded=!expanded;states.forEach(s=>s.open=expanded);$('expand-all').replaceChildren(document.createTextNode(expanded?'Collapse all ':'Expand all '),el('span',expanded?'−':'+'));renderFindings();};
$('draft').oninput=()=>{draftDirty=true;};$('regenerate').onclick=()=>rebuildDraft();$('tone').onchange=()=>{if(draftDirty){$('draft-stale').hidden=false;toast('Tone changed. Rebuild the draft when you’re ready to replace your edits.');}else rebuildDraft(false);};
$('copy').onclick=copyDraft;$('download').onclick=downloadReport;
$('print').onclick=()=>{
  if(!result)return;
  const report=makeReport(),target=$('print-report');target.replaceChildren();
  target.append(el('h1','SupplyLens / review'),el('p',report.mode==='structured'?'Rule-based specification comparison':report.mode==='demo'?'Sample replay — fixed, hand-reviewed result':'Live AI — source quotes checked'),el('p',report.exported_at));
  for(const row of report.findings){
    const card=el('article');card.append(el('h2',row.topic+' · '+row.status),el('p',row.explanation),el('h3','Requirement'),el('blockquote',row.requirement_quote),el('h3','Supplier reply'),el('blockquote',row.supplier_quote||'No relevant statement.'),el('p','Reviewed by you: '+(row.reviewed?'yes':'no')));
    if(row.note)card.append(el('p','Your note: '+row.note));if(row.question)card.append(el('p','Follow-up question: '+row.question));target.append(card);
  }
  target.append(el('h2','Follow-up'),el('h3',report.subject),el('pre',report.follow_up),el('p','Quotes verify source presence, not correct interpretation or completeness.'));
  window.print();
};
for(const b of document.querySelectorAll('[data-open-help]'))b.onclick=openHelp;$('close-help').onclick=closeHelp;$('help-done').onclick=closeHelp;
$('help-dialog').addEventListener('click',e=>{if(e.target===$('help-dialog')){const r=$('help-dialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeHelp();}});
document.addEventListener('keydown',e=>{
  if($('help-dialog').open)return;
  const typing=['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName);
  if((e.metaKey||e.ctrlKey)&&e.key==='Enter'){e.preventDefault();compare();}
  else if(e.key==='/'&&!typing&&result){e.preventDefault();setPane('findings');$('search').focus();}
  else if(e.key==='Escape'&&document.activeElement===$('search')){$('search').value='';renderFindings();$('search').blur();}
});
let scrollPending=false;
window.addEventListener('scroll',()=>{if(scrollPending)return;scrollPending=true;requestAnimationFrame(()=>{const height=document.documentElement.scrollHeight-innerHeight;$('scroll-progress').style.width=(height>0?Math.min(100,Math.max(0,scrollY/height*100)):0)+'%';scrollPending=false;});},{passive:true});
if('IntersectionObserver' in window&&!matchMedia('(prefers-reduced-motion: reduce)').matches){document.documentElement.classList.add('motion-ready');const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){entry.target.classList.add('in-view');observer.unobserve(entry.target);}},{threshold:.08});document.querySelectorAll('.reveal').forEach(n=>observer.observe(n));}
async function init() {
  $('analyze').disabled=$('hero-demo').disabled=true;
  try{const response=await api('/api/examples');if(!response.ok)throw Error('Could not load examples.');cases=await response.json();if(!Array.isArray(cases)||!cases.length)throw Error('No sample scenarios available.');
    $('case-select').replaceChildren(...cases.map(c=>{const option=el('option',c.name);option.value=c.id;return option;}));caseId=cases[0].id;setMode('demo');$('analyze').disabled=$('hero-demo').disabled=false;
  }catch(e){showError(e.message);}
}
init().then(()=>{window.SUPPLYLENS_READY=true;window.dispatchEvent(new Event('supplylens-ready'));});
