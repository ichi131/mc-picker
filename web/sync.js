export const API_ORIGIN = 'https://mc-picker.wangyichi131.chatgpt.site';
const api = location.pathname.startsWith('/manage') ? location.origin : API_ORIGIN;
let editToken='';
export async function loadShared(){
  const response=await fetch(`${api}/api/state`,{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new Error('Unable to load the shared list. Please retry.');
  return response.json();
}
export async function saveShared(state,revision,retried=false){
  if(!editToken)await getSession();
  const response=await fetch(`${api}/api/state`,{method:'PUT',credentials:'omit',headers:{'Content-Type':'application/json','Authorization':`Bearer ${editToken}`},body:JSON.stringify({...state,revision}),signal:AbortSignal.timeout(15000)});
  if(response.status===401 && !retried){await getSession();return saveShared(state,revision,true);}
  const data=await response.json();
  if(!response.ok){const error=new Error(data.error||'Unable to save the shared list.');error.latestState=data.state;throw error;}
  return data;
}
export async function getSession(){
  const response=await fetch(`${api}/api/session`,{credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new Error('Unable to check edit access.');
  const session=await response.json();editToken=session.token;return session;
}
