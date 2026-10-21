const ASSETS = /*__ASSETS__*/ {};
const DEFAULT_NAMES = /*__DEFAULT_NAMES__*/ [];
const PUBLIC_ORIGIN = 'https://ichi131.github.io';
const PUBLIC_URL = 'https://ichi131.github.io/mc-picker/';

function reply(request, value, status = 200) {
  const origin = request.headers.get('Origin');
  const headers = new Headers({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff'});
  if (origin === PUBLIC_ORIGIN || origin === new URL(request.url).origin) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  return new Response(status === 204 ? null : JSON.stringify(value), {status,headers});
}
async function signature(value, secret) {
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signed=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signed),byte=>byte.toString(16).padStart(2,'0')).join('');
}
async function editorToken(env) {
  const payload=`${Math.floor(Date.now()/1000)+86400}.${crypto.randomUUID()}`;
  return `${payload}.${await signature(payload,env.MC_SESSION_SECRET)}`;
}
async function canEdit(request,env){
  if(!env.MC_SESSION_SECRET)return false;
  const token=request.headers.get('Authorization')?.replace(/^Bearer /,'')||'';
  const parts=token.split('.');if(parts.length!==3||!/^\d+$/.test(parts[0])||Number(parts[0])<Date.now()/1000)return false;
  const expected=await signature(parts.slice(0,2).join('.'),env.MC_SESSION_SECRET);
  if(expected.length!==parts[2].length)return false;
  let diff=0;for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^parts[2].charCodeAt(i);
  return diff===0;
}
function normalizedState(input) {
  if (!input || !Array.isArray(input.names) || !input.names.length || input.names.length>1000 || !Array.isArray(input.excluded) || input.excluded.length>1000) throw new Error('Use 1–1,000 members.');
  const simplify = name => name.normalize('NFKC').replace(/\([^)]*\)/g,'').replace(/\s+/g,' ').trim();
  const names=[];const seen=new Set();
  for(const value of input.names){
    if(typeof value!=='string'||value.length>300)throw new Error('Invalid member name.');
    const name=simplify(value);if(!name||name.length>150)throw new Error('Use names up to 150 characters.');
    const key=name.toLowerCase();if(!seen.has(key)){seen.add(key);names.push(name);}
  }
  const canonical=new Map(names.map(n=>[n.toLowerCase(),n]));
  const excluded=[];
  for(const value of input.excluded){
    if(typeof value!=='string')throw new Error('Invalid exclusion.');
    const name=canonical.get(simplify(value).toLowerCase());
    if(!name)throw new Error('An excluded member is missing from the member list.');
    if(!excluded.includes(name))excluded.push(name);
  }
  return {names,excluded};
}
async function readState(db) {
  let row=await db.prepare('SELECT data, revision, updated_at FROM shared_state WHERE id = 1').first();
  if(!row){
    await db.prepare('INSERT OR IGNORE INTO shared_state (id, data, revision, updated_at) VALUES (1, ?, 0, ?)').bind(JSON.stringify({names:DEFAULT_NAMES,excluded:[]}),Date.now()).run();
    row=await db.prepare('SELECT data, revision, updated_at FROM shared_state WHERE id = 1').first();
  }
  return {...JSON.parse(row.data),revision:row.revision,updatedAt:row.updated_at};
}
export default {
  async fetch(request, env) {
    const url=new URL(request.url);
    if(url.pathname==='/api/state') {
      if(request.method==='OPTIONS')return reply(request,null,204);
      try {
        // Primary-session reads keep polls current immediately after a successful write.
        const db=env.DB.withSession ? env.DB.withSession('first-primary') : env.DB;
        if(request.method==='GET')return reply(request,await readState(db));
        if(request.method!=='PUT')return reply(request,{error:'Method not allowed.'},405);
        if(!await canEdit(request,env))return reply(request,{error:'Your edit session expired. Refresh the page and try again.'},401);
        if(![PUBLIC_ORIGIN,url.origin].includes(request.headers.get('Origin')))return reply(request,{error:'Edits must come from the MC Picker page.'},403);
        if(!request.headers.get('Content-Type')?.includes('application/json'))return reply(request,{error:'Expected JSON.'},415);
        if(Number(request.headers.get('Content-Length'))>300000)return reply(request,{error:'List is too large.'},413);
        const text=await request.text();if(text.length>300000)return reply(request,{error:'List is too large.'},413);
        let input;let state;
        try{input=JSON.parse(text);state=normalizedState(input);}catch(error){return reply(request,{error:error.message||'Invalid list.'},400);}
        if(!Number.isSafeInteger(input.revision)||input.revision<0)return reply(request,{error:'Missing list revision.'},400);
        await readState(db);
        const updated=await db.prepare('UPDATE shared_state SET data = ?, revision = revision + 1, updated_at = ? WHERE id = 1 AND revision = ? RETURNING data, revision, updated_at').bind(JSON.stringify(state),Date.now(),input.revision).first();
        if(!updated)return reply(request,{error:'The list changed in another window. The latest list has been loaded; please try again.',state:await readState(db)},409);
        return reply(request,{...JSON.parse(updated.data),revision:updated.revision,updatedAt:updated.updated_at});
      }catch{return reply(request,{error:'Shared list is temporarily unavailable. Please retry.'},503);}
    }
    if(url.pathname==='/api/session' && request.method==='GET'){
      if(!env.MC_SESSION_SECRET)return reply(request,{error:'Shared editing is temporarily unavailable.'},503);
      return reply(request,{canEdit:true,token:await editorToken(env)});
    }
    if(url.pathname==='/')return Response.redirect(PUBLIC_URL,302);
    const asset=ASSETS[url.pathname==='/manage' || url.pathname==='/manage/' ? '/index.html' : url.pathname];
    if(asset && request.method==='GET')return new Response(asset.body,{headers:{'Content-Type':asset.type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
    return reply(request,{error:'Not found.'},404);
  }
};
