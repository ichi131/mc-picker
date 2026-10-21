import { uniformIndex, cleanNames, simplifyName } from './random.mjs';
const defaults = ['Zhang Zimo','Chen Jianan','Pang Zi Haur','松浦 孝平','Zhou Wangjin','住田 龍宇一','二見 颯','Wang Yichi','Lee Jaeyoung','Zhu Kexin','加藤 利梓','福重 茜','馬越 亮','Zhang Yizhou','Kim Morris','石山 蒼大','岩田 宗真','冨田 直也','藤岡 登貴留アマル','松村 成真','北野 泰地','林 祥太郎','鳥丸 広翔','Anindita Mandal','Sarthak Giri'];
const $ = id => document.getElementById(id);
let state = {names:defaults.map(simplifyName), excluded:[], history:[], schemaVersion:3};
try {
  const saved = JSON.parse(localStorage.getItem('lab-mc-picker-v1'));
  if (saved && Array.isArray(saved.names) && saved.names.length && saved.names.length <= 1000 && saved.names.every(n => typeof n === 'string')) {
    const names = cleanNames(saved.names.join('\n'));
    if(names.length) {
      const history=Array.isArray(saved.history) ? saved.history.filter(h => h && typeof h.name === 'string' && Number.isFinite(h.time)).map(h=>({...h,name:simplifyName(h.name)})).slice(0,20) : [];
      const excluded=Array.isArray(saved.excluded) ? saved.excluded.filter(n=>typeof n==='string').map(simplifyName).filter(n=>names.includes(n)) : [];
      state={names, history, excluded:[...new Set(excluded)], schemaVersion:3};
    }
  }
} catch {}
let busy = false;
const eligible = () => state.names.filter(name => !state.excluded.includes(name));
const percent = n => n ? `${(100/n).toLocaleString('en-US',{maximumFractionDigits:2})}%` : '—';
function persist(){try{localStorage.setItem('lab-mc-picker-v1',JSON.stringify(state));}catch{document.querySelector('.saved-note').textContent='Session only';}}
function render(){
  const pool=eligible();
  $('eligibleCount').textContent=pool.length;
  $('chance').textContent=percent(pool.length);
  $('excludedCount').textContent=state.excluded.length;
  $('poolBadge').textContent=`${pool.length} in the pool`;
  $('spin').disabled=busy||!pool.length;
  $('spinText').textContent=busy?'Finding your next MC…':pool.length?'Pick the next MC':'Include someone to pick';
  $('includeAll').disabled=busy||!state.excluded.length;
  $('excludeAll').disabled=busy||state.excluded.length===state.names.length;
  $('editRoster').disabled=busy;
  $('newMember').disabled=busy;
  $('addMember').disabled=busy;
  $('excludedListCount').textContent=state.excluded.length;
  const select=$('excludeMember');const previousSelection=select.value;
  select.replaceChildren(new Option(pool.length?'Choose a member…':'Everyone is excluded',''));
  for(const name of pool)select.add(new Option(name,name));
  if(pool.includes(previousSelection))select.value=previousSelection;
  select.disabled=busy||!pool.length;
  $('addExclusion').disabled=busy||!select.value;
  $('excludedList').replaceChildren();
  for(const name of state.excluded){
    const chip=document.createElement('button');chip.type='button';chip.className='excluded-chip';chip.disabled=busy;chip.setAttribute('aria-label',`Restore ${name}`);
    const text=document.createElement('span');text.textContent=name;
    const close=document.createElement('span');close.textContent='×';close.className='chip-close';close.setAttribute('aria-hidden','true');chip.append(text,close);
    chip.addEventListener('click',()=>{if(busy)return;state.excluded=state.excluded.filter(n=>n!==name);persist();render();});
    $('excludedList').append(chip);
  }
  if(!state.excluded.length){const p=document.createElement('p');p.className='empty-history';p.textContent='No exclusions. Everyone is in the pool.';$('excludedList').append(p);}
  const query=$('search').value.trim().toLocaleLowerCase();
  const visible=state.names.filter(name=>name.toLocaleLowerCase().includes(query));
  $('listCount').textContent=query?`${visible.length} OF ${state.names.length} MEMBERS`:`${state.names.length} MEMBERS`;
  $('memberList').replaceChildren();
  for (const name of visible){
    const excluded=state.excluded.includes(name);
    const row=document.createElement('label');row.className=`member-row${excluded?' excluded':''}`;
    const input=document.createElement('input');input.type='checkbox';input.checked=excluded;input.disabled=busy;input.setAttribute('aria-label',`Exclude ${name}`);
    input.addEventListener('change',()=>{if(busy)return;state.excluded=input.checked?[...state.excluded,name]:state.excluded.filter(n=>n!==name);persist();render();});
    const text=document.createElement('span');text.className='member-name';text.textContent=name;
    const prob=document.createElement('span');prob.className='member-prob';prob.textContent=excluded?'EXCLUDED':percent(pool.length);
    row.append(input,text,prob);$('memberList').append(row);
  }
  if(!visible.length){const p=document.createElement('p');p.className='empty-history';p.textContent='No matching members.';$('memberList').append(p);}
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
  if(busy)return;
  const pool=eligible();if(!pool.length)return;
  const name=pool[uniformIndex(pool.length)];
  busy=true;render();document.querySelector('.picker-panel').classList.remove('picked');$('winner').classList.remove('winner-celebration');$('confetti').replaceChildren();$('slot').classList.add('spinning');$('resultLabel').textContent='PASSING THE MIC…';$('winnerSub').textContent=`${pool.length} people. ${percent(pool.length)} each.`;
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
$('excludeMember').addEventListener('change',()=>{$('addExclusion').disabled=busy||!$('excludeMember').value;});
$('excludeForm').addEventListener('submit',event=>{event.preventDefault();const name=$('excludeMember').value;if(busy||!eligible().includes(name))return;state.excluded.push(name);persist();render();});
$('addMemberForm').addEventListener('submit',event=>{
  event.preventDefault();if(busy)return;
  const raw=$('newMember').value;
  const added=cleanNames(raw);
  const message=$('memberMessage');
  if(added.length!==1||raw.includes('\n')||added[0].length>150){message.textContent='Please enter one name, up to 150 characters.';return;}
  if(cleanNames([...state.names,added[0]].join('\n')).length===state.names.length){message.textContent='That member already exists. Uncheck their name to restore them if excluded.';return;}
  if(state.names.length>=1000){message.textContent='The member list is full (1,000 people).';return;}
  state.names.push(added[0]);$('newMember').value='';$('search').value='';persist();render();message.textContent=`${added[0]} added to the pool.`;
});
$('includeAll').addEventListener('click',()=>{if(busy)return;state.excluded=[];persist();render();});
$('excludeAll').addEventListener('click',()=>{if(busy)return;state.excluded=[...state.names];persist();render();});
$('clearHistory').addEventListener('click',()=>{if(busy)return;state.history=[];persist();render();});
$('editRoster').addEventListener('click',()=>{$('rosterInput').value=state.names.join('\n');$('rosterError').textContent='';$('rosterDialog').showModal();});
for(const id of ['closeDialog','cancelEdit'])$(id).addEventListener('click',()=>$('rosterDialog').close());
$('rosterForm').addEventListener('submit',event=>{event.preventDefault();const names=cleanNames($('rosterInput').value);if(!names.length||names.length>1000||names.some(n=>n.length>150)){$('rosterError').textContent='Use 1–1,000 names, up to 150 characters per name.';return;}state.names=names;state.excluded=state.excluded.filter(n=>names.includes(n));persist();render();$('rosterDialog').close();});
document.addEventListener('keydown',event=>{if(event.code!=='Space'||event.repeat||event.ctrlKey||event.metaKey||event.altKey||$('rosterDialog').open||event.target.closest('input,textarea,button,a,[contenteditable]'))return;event.preventDefault();spin();});
persist();render();
