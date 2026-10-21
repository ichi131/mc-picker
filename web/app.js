import { uniformIndex, cleanNames, simplifyName } from './random.mjs?v=20261021-shared-2';
import { loadShared, saveShared, getSession } from './sync.js?v=20261021-shared-2';
const defaults = ['Zhang Zimo','Chen Jianan','Pang Zi Haur','松浦 孝平','Zhou Wangjin','住田 龍宇一','二見 颯','Wang Yichi','Lee Jaeyoung','Zhu Kexin','加藤 利梓','福重 茜','馬越 亮','Zhang Yizhou','Kim Morris','石山 蒼大','岩田 宗真','冨田 直也','藤岡 登貴留アマル','松村 成真','北野 泰地','林 祥太郎','鳥丸 広翔','Anindita Mandal','Sarthak Giri'];
const $ = id => document.getElementById(id);
let state = {names:defaults.map(simplifyName), excluded:[], history:[]};
let legacyState=null;
try {
  const saved=JSON.parse(localStorage.getItem('lab-mc-picker-v1'));
  if(saved && Array.isArray(saved.names) && saved.names.every(n=>typeof n==='string') && Array.isArray(saved.excluded)){
    const names=cleanNames(saved.names.join('\n'));
    const excluded=saved.excluded.filter(n=>typeof n==='string').map(simplifyName).filter(n=>names.includes(n));
    if(names.length)legacyState={names,excluded:[...new Set(excluded)]};
    if(Array.isArray(saved.history))state.history=saved.history;
  }
  const history=JSON.parse(localStorage.getItem('mc-picker-history-v4'));
  if(Array.isArray(history))state.history=history;
  state.history=state.history.filter(h=>h&&typeof h.name==='string'&&Number.isFinite(h.time)).map(h=>({...h,name:simplifyName(h.name)})).slice(0,20);
}catch{}
let busy=false, saving=false, ready=false, refreshing=false, canEdit=false, revision=-1, syncProblem='', saveProblem='', lastSaveRevision=-1;
let pendingRemoval=null;
function adopt(snapshot){
  if(!snapshot || !Array.isArray(snapshot.names) || !Array.isArray(snapshot.excluded) || !Number.isSafeInteger(snapshot.revision))throw new Error('Invalid shared list response.');
  if(snapshot.revision<revision)return;
  state.names=snapshot.names;state.excluded=snapshot.excluded;revision=snapshot.revision;ready=true;syncProblem='';
}
function reportSync(){
  const problem=saveProblem||syncProblem;
  const receipt=problem?'Not saved — '+problem:saving?'Saving your change for everyone…':!ready?'Connecting to shared storage…':lastSaveRevision===revision?'Saved for everyone · '+state.excluded.length+' excluded':'Shared list · '+state.excluded.length+' excluded';
  for(const id of ['saveReceipt','excludeReceipt']){$(id).textContent=receipt;$(id).classList.toggle('save-failed',!!problem);}
  $('syncStatus').textContent=saveProblem?'Your change was not saved':syncProblem?'Connection needs attention':saving?'Saving for everyone…':!ready?'Connecting everyone…':'Shared live · synced';
  $('syncStatus').classList.toggle('sync-error',!!problem);
  $('syncDetail').textContent=problem||'Everyone can edit. Changes appear on other screens within a few seconds.';
  $('retrySync').disabled=saving||busy||refreshing;
  let imported;try{imported=localStorage.getItem('mc-picker-import-dismissed');}catch{}
  const differs=legacyState && (JSON.stringify(legacyState.names)!==JSON.stringify(state.names)||JSON.stringify(legacyState.excluded)!==JSON.stringify(state.excluded));
  $('importPanel').hidden=!(ready && legacyState && !imported && differs);
  $('importSummary').textContent=legacyState?`You have a list saved in this browser (${legacyState.names.length} members, ${legacyState.excluded.length} excluded). Importing replaces the shared list for everyone.`:'';
  $('importLocal').disabled=busy||saving||!canEdit||!ready;
}
async function refreshShared(){
  if(busy||saving||refreshing)return false;
  refreshing=true;reportSync();
  let changed=false;
  try{
    if(!canEdit)canEdit=(await getSession()).canEdit;
    const oldRevision=revision;const wasReady=ready;
    adopt(await loadShared());changed=oldRevision!==revision||!wasReady;
    return true;
  }
  catch(error){syncProblem=error.message;ready=false;changed=true;return false;}
  finally{refreshing=false;if(changed)render();else reportSync();}
}
async function mutateShared(change){
  if(busy||saving||!ready||!canEdit)return false;
  const next={names:[...state.names],excluded:[...state.excluded]};
  change(next);
  saving=true;syncProblem='';saveProblem='';render();
  try{adopt(await saveShared(next,revision));lastSaveRevision=revision;return true;}
  catch(error){
    if(error.latestState)adopt(error.latestState);
    saveProblem=error.message||'Unable to save. Please retry.';
    if(!error.latestState){try{adopt(await loadShared());saveProblem=error.message;}catch{ready=false;}}
    return false;
  }finally{saving=false;render();}
}
const eligible = () => state.names.filter(name => !state.excluded.includes(name));
const percent = n => n ? `${(100/n).toLocaleString('en-US',{maximumFractionDigits:2})}%` : '—';
function persist(){try{localStorage.setItem('mc-picker-history-v4',JSON.stringify(state.history));}catch{}}
function render(){
  const pool=eligible();
  const locked=busy||saving||!ready;
  const editLocked=locked||!canEdit;
  reportSync();
  $('eligibleCount').textContent=pool.length;
  $('chance').textContent=percent(pool.length);
  $('excludedCount').textContent=state.excluded.length;
  $('poolBadge').textContent=`${pool.length} in the pool`;
  $('spin').disabled=locked||!pool.length;
  $('spinText').textContent=busy?'PICKING YOUR NEXT MC…':!ready?'CONNECTING…':pool.length?'CLICK TO PICK AN MC':state.names.length?'INCLUDE SOMEONE TO PICK':'ADD A MEMBER TO PICK';
  $('includeAll').disabled=editLocked||!state.excluded.length;
  $('excludeAll').disabled=editLocked||state.excluded.length===state.names.length;
  $('editRoster').disabled=editLocked;
  $('newMember').disabled=editLocked;
  $('addMember').disabled=editLocked;
  $('excludedListCount').textContent=state.excluded.length;
  const select=$('excludeMember');const previousSelection=select.value;
  select.replaceChildren(new Option(pool.length?'Choose a member…':state.names.length?'Everyone is excluded':'No members yet',''));
  for(const name of pool)select.add(new Option(name,name));
  if(pool.includes(previousSelection))select.value=previousSelection;
  select.disabled=editLocked||!pool.length;
  $('addExclusion').disabled=editLocked||!select.value;
  $('excludedList').replaceChildren();
  for(const name of state.excluded){
    const chip=document.createElement('button');chip.type='button';chip.className='excluded-chip';chip.disabled=editLocked;chip.setAttribute('aria-label',`Restore ${name}`);
    const text=document.createElement('span');text.textContent=name;
    const close=document.createElement('span');close.textContent='×';close.className='chip-close';close.setAttribute('aria-hidden','true');chip.append(text,close);
    chip.addEventListener('click',()=>mutateShared(next=>{next.excluded=next.excluded.filter(n=>n!==name);}));
    $('excludedList').append(chip);
  }
  if(!state.excluded.length){const p=document.createElement('p');p.className='empty-history';p.textContent='No exclusions. Everyone is in the pool.';$('excludedList').append(p);}
  const query=$('search').value.trim().toLocaleLowerCase();
  const visible=state.names.filter(name=>name.toLocaleLowerCase().includes(query));
  $('listCount').textContent=query?`${visible.length} OF ${state.names.length} MEMBERS`:`${state.names.length} MEMBERS`;
  $('memberList').replaceChildren();
  for (const name of visible){
    const excluded=state.excluded.includes(name);
    const row=document.createElement('div');row.className=`member-row${excluded?' excluded':''}`;
    const toggle=document.createElement('label');toggle.className='member-toggle';
    const input=document.createElement('input');input.type='checkbox';input.checked=excluded;input.disabled=editLocked;input.setAttribute('aria-label',`Exclude ${name}`);
    input.addEventListener('change',()=>{const checked=input.checked;mutateShared(next=>{next.excluded=checked?[...new Set([...next.excluded,name])]:next.excluded.filter(n=>n!==name);});});
    const text=document.createElement('span');text.className='member-name';text.textContent=name;
    const prob=document.createElement('span');prob.className='member-prob';prob.textContent=excluded?'EXCLUDED':percent(pool.length);
    const remove=document.createElement('button');remove.type='button';remove.className='remove-member';remove.disabled=editLocked;remove.setAttribute('aria-label',`Remove ${name}`);remove.title='Remove graduated member';
    remove.innerHTML='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-9 0 1 14h10l1-14M10 10v7m4-7v7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    remove.addEventListener('click',()=>{
      if(busy||saving||!ready||!canEdit)return;
      pendingRemoval=name;$('removeMemberName').textContent=name;$('removeMemberError').textContent='';$('removeMemberDialog').showModal();
    });
    toggle.append(input,text);row.append(toggle,prob,remove);$('memberList').append(row);
  }
  if(!visible.length){const p=document.createElement('p');p.className='empty-history';p.textContent=state.names.length?'No matching members.':'No members yet. Add someone above.';$('memberList').append(p);}
  $('historyCount').textContent=state.history.length;
  $('clearHistory').disabled=busy||!state.history.length;
  $('history').replaceChildren();
  if(!state.history.length){const p=document.createElement('p');p.className='empty-history';p.textContent='Your first pick starts here.';$('history').append(p);}
  state.history.slice(0,4).forEach((entry,i)=>{
    const row=document.createElement('div');row.className='history-item';
    const name=document.createElement('span');const number=document.createElement('span');number.className='history-number';number.textContent=String(state.history.length-i).padStart(2,'0');name.append(number,document.createTextNode(entry.name));
    const time=document.createElement('time');time.dateTime=new Date(entry.time).toISOString();time.textContent=new Date(entry.time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});row.append(name,time);$('history').append(row);
  });
}
async function spin(){
  if(busy||saving||!ready)return;
  busy=true;render();
  try{adopt(await loadShared());}catch(error){busy=false;ready=false;syncProblem=error.message;render();return;}
  const pool=eligible();if(!pool.length){busy=false;render();return;}
  const name=pool[uniformIndex(pool.length)];
  render();document.querySelector('.picker-panel').classList.remove('picked');$('winner').classList.remove('winner-celebration');$('confetti').replaceChildren();$('slot').classList.add('spinning');$('resultLabel').textContent='PASSING THE MIC…';$('winnerSub').textContent=`${pool.length} people. ${percent(pool.length)} each.`;
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
    await rollNames(pool,name);
  }
  $('winner').textContent=name;$('winner').style.fontSize=name.length>26?'26px':'';
  $('resultLabel').textContent='YOUR NEXT MC IS';$('winnerSub').textContent='The mic is yours. See you at the next meeting!';
  $('slot').classList.remove('spinning');document.querySelector('.picker-panel').classList.add('picked');$('winner').classList.add('winner-celebration');
  state.history.unshift({name,time:Date.now()});state.history=state.history.slice(0,20);persist();busy=false;render();
  $('announcement').textContent=`The next MC is ${name}. Selected from ${pool.length} people, with equal probability.`;celebrate();
}
async function rollNames(pool,selected){
  const reel=$('nameReel');
  const rowHeight=88;
  const steps=44;
  const sequence=[$('winner').textContent];
  const offset=uniformIndex(pool.length);
  for(let i=1;i<steps;i++)sequence.push(pool[(offset+i)%pool.length]);
  sequence.push(selected);
  reel.replaceChildren(...sequence.map(name=>{
    const row=document.createElement('div');row.className='reel-row';row.textContent=name;
    if(name.length>26)row.classList.add('long-name');
    return row;
  }));
  $('winner').style.visibility='hidden';reel.hidden=false;
  const motion=reel.animate([
    {transform:'translateY(0)'},
    {transform:`translateY(-${steps*rowHeight}px)`}
  ],{duration:3900,easing:'cubic-bezier(0.12, 0.76, 0.15, 1)',fill:'forwards'});
  try{await motion.finished;}finally{reel.hidden=true;motion.cancel();reel.replaceChildren();$('winner').style.visibility='';}
}
function celebrate(){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const rect=$('winner').getBoundingClientRect();
  const centerX=rect.left+rect.width/2;
  const centerY=rect.top+rect.height/2;
  const colors=['#c4a8ff','#a4dfcc','#ffe09c','#f7a8d5','#ffffff','#97d7ff'];
  for(let i=0;i<96;i++){
    const bit=document.createElement('i');bit.className='confetti-piece';
    const side=i%2===0?-1:1;
    bit.style.left=`${centerX+side*Math.min(rect.width/2+12,180)}px`;
    bit.style.top=`${centerY+10}px`;
    bit.style.background=colors[i%colors.length];
    bit.style.width=`${5+Math.random()*5}px`;bit.style.height=`${5+Math.random()*8}px`;
    bit.style.borderRadius=i%4===0?'50%':'1px';
    $('confetti').append(bit);
    const vx=side*(50+Math.random()*260);
    const vy=-170-Math.random()*310;
    const rotation=Math.random()*900-450;
    const frames=Array.from({length:25},(_,j)=>{
      const t=j/24;
      return {transform:`translate(${vx*t}px, ${vy*t+720*t*t}px) rotate(${rotation*t}deg)`,opacity:t<0.65?1:Math.max(0,(1-t)/0.35)};
    });
    const motion=bit.animate(frames,{duration:2000+Math.random()*700,delay:Math.random()*140,easing:'linear',fill:'both'});
    motion.finished.then(()=>bit.remove(),()=>bit.remove());
  }
}
$('spin').addEventListener('click',spin);
$('search').addEventListener('input',render);
$('excludeMember').addEventListener('change',()=>{$('addExclusion').disabled=busy||saving||!ready||!canEdit||!$('excludeMember').value;});
$('excludeForm').addEventListener('submit',event=>{event.preventDefault();const name=$('excludeMember').value;if(!eligible().includes(name))return;mutateShared(next=>{next.excluded.push(name);});});
$('addMemberForm').addEventListener('submit',async event=>{
  event.preventDefault();
  const raw=$('newMember').value;const added=cleanNames(raw);const message=$('memberMessage');
  if(added.length!==1||raw.includes('\n')||added[0].length>150){message.textContent='Please enter one name, up to 150 characters.';return;}
  if(cleanNames([...state.names,added[0]].join('\n')).length===state.names.length){message.textContent='That member already exists. Uncheck their name to restore them if excluded.';return;}
  if(state.names.length>=1000){message.textContent='The member list is full (1,000 people).';return;}
  if(await mutateShared(next=>{next.names.push(added[0]);})){$('newMember').value='';$('search').value='';message.textContent=`${added[0]} added for everyone.`;render();}
});
$('includeAll').addEventListener('click',()=>mutateShared(next=>{next.excluded=[];}));
$('excludeAll').addEventListener('click',()=>mutateShared(next=>{next.excluded=[...next.names];}));
$('clearHistory').addEventListener('click',()=>{if(busy)return;state.history=[];persist();render();});
$('editRoster').addEventListener('click',()=>{$('rosterInput').value=state.names.join('\n');$('rosterError').textContent='';$('rosterDialog').showModal();});
for(const id of ['closeDialog','cancelEdit'])$(id).addEventListener('click',()=>$('rosterDialog').close());
$('rosterForm').addEventListener('submit',async event=>{
  event.preventDefault();const names=cleanNames($('rosterInput').value);
  if(!names.length||names.length>1000||names.some(n=>n.length>150)){$('rosterError').textContent='Use 1–1,000 names, up to 150 characters per name.';return;}
  if(await mutateShared(next=>{next.names=names;next.excluded=next.excluded.filter(n=>names.includes(n));}))$('rosterDialog').close();
  else $('rosterError').textContent=saveProblem||syncProblem;
});
$('cancelRemoveMember').addEventListener('click',()=>{$('removeMemberDialog').close();pendingRemoval=null;});
$('removeMemberDialog').addEventListener('cancel',()=>{pendingRemoval=null;});
$('confirmRemoveMember').addEventListener('click',async()=>{
  const name=pendingRemoval;if(!name||busy||saving||!ready||!canEdit)return;
  $('confirmRemoveMember').disabled=true;$('cancelRemoveMember').disabled=true;$('removeMemberError').textContent='';
  try{
    const removed=await mutateShared(next=>{next.names=next.names.filter(n=>n!==name);next.excluded=next.excluded.filter(n=>n!==name);});
    if(removed){pendingRemoval=null;$('removeMemberDialog').close();$('memberMessage').textContent=`${name} removed for everyone.`;$('announcement').textContent=`${name} was removed from the shared member and exclusion lists.`;}
    else $('removeMemberError').textContent=saveProblem||syncProblem||'Unable to remove this member. Please retry.';
  }finally{$('confirmRemoveMember').disabled=false;$('cancelRemoveMember').disabled=false;}
});
$('retrySync').addEventListener('click',async()=>{saveProblem='';try{canEdit=(await getSession()).canEdit;}catch{}await refreshShared();});
$('importLocal').addEventListener('click',async()=>{if(!legacyState)return;if(await mutateShared(next=>{next.names=[...legacyState.names];next.excluded=[...legacyState.excluded];})){localStorage.setItem('mc-picker-import-dismissed','yes');render();}});
$('dismissImport').addEventListener('click',()=>{localStorage.setItem('mc-picker-import-dismissed','yes');render();});
document.addEventListener('keydown',event=>{if(event.code!=='Space'||event.repeat||event.ctrlKey||event.metaKey||event.altKey||$('rosterDialog').open||$('removeMemberDialog').open||event.target.closest('input,textarea,button,a,[contenteditable]'))return;event.preventDefault();spin();});
render();
try{canEdit=(await getSession()).canEdit;}catch(error){syncProblem=error.message;}
await refreshShared();
setInterval(()=>{if(!document.hidden)refreshShared();},3000);
window.addEventListener('focus',()=>refreshShared());
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshShared();});
