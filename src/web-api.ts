import type { DesktopAPI, Settings, CalendarEvent } from './types';
export const nativeDesktop = !!window.shipone;
const base = location.hostname === '127.0.0.1' ? 'http://127.0.0.1:4174' : 'https://shipone-oba-2026-itgoblin.creamclover.chatgpt.site';
const usage = () => { try { return JSON.parse(localStorage.getItem('shipone-api-usage')||'{}'); } catch {return {};} };
async function request(path:string,input?:unknown) {
  const r=await fetch(base+'/api/'+path,{method:input?'POST':'GET',headers:input?{'Content-Type':'application/json'}:undefined,body:input?JSON.stringify(input):undefined,signal:AbortSignal.timeout(55000)});
  const data=await r.json();if(!r.ok) throw new Error(data.error||'서버 연결을 확인해주세요.');
  if(data.usage){const u=usage();localStorage.setItem('shipone-api-usage',JSON.stringify({requests:(u.requests||0)+1,inputTokens:(u.inputTokens||0)+(data.usage.input_tokens||0),outputTokens:(u.outputTokens||0)+(data.usage.output_tokens||0)}));}
  return data;
}
function pick(accept:string):Promise<File|null> {return new Promise(resolve=>{const i=document.createElement('input');i.type='file';i.accept=accept;i.onchange=()=>resolve(i.files?.[0]||null);i.oncancel=()=>resolve(null);i.click();});}
const unavailable=async()=>{throw new Error('웹 계정 연결은 준비 중입니다. 직접 입력 또는 일정 JSON 가져오기를 이용해주세요.');};
if(!nativeDesktop) window.shipone={
  load:async()=>JSON.parse(localStorage.getItem('shipone-workspace-v1')||'null'),
  save:async s=>{localStorage.setItem('shipone-workspace-v1',JSON.stringify(s));},
  settings:async()=>{const s=await request('status');return {...s,keySource:'environment',hasNotion:false,hasGoogle:false,notionSource:'',googleClientId:'',secureStorage:false,requests:0,inputTokens:0,outputTokens:0,...usage()} as Settings;},
  configure:unavailable,
  plan:async input=>(await request('plan',input)).result,
  replan:async input=>(await request('replan',input)).result,
  notion:unavailable,googleConnect:unavailable,calendar:unavailable,
  readFile:async()=>{const f=await pick('.txt,.md,.html,.json,.csv');if(!f)return null;if(f.size>1000000)throw new Error('1MB 이하의 파일을 선택해주세요.');const bytes=await f.arrayBuffer();const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');let text=new TextDecoder().decode(bytes);if(/\.html?$/i.test(f.name)){const d=new DOMParser().parseFromString(text,'text/html');d.querySelectorAll('script,style').forEach(n=>n.remove());text=d.body.textContent||'';}return {kind:'file',label:f.name,text,hash,checkedAt:new Date().toISOString()};},
  importCalendar:async()=>{const f=await pick('.json');if(!f)return null;if(f.size>1000000)throw new Error('1MB 이하의 파일을 선택해주세요.');const events=JSON.parse(await f.text());if(!Array.isArray(events)||events.length>250||events.some(e=>!e.title||!Number.isFinite(+new Date(e.start))||!Number.isFinite(+new Date(e.end))||+new Date(e.end)<=+new Date(e.start)))throw new Error('title, start, end가 있는 일정 배열이 필요합니다.');return events.map(e=>({...e,id:crypto.randomUUID(),source:'import'})) as CalendarEvent[];},
  verifyUrl:async()=>{throw new Error('브라우저 버전에서는 URL의 본문을 복사해 텍스트로 검증해주세요.');},
  exportReceipt:async text=>{const u=URL.createObjectURL(new Blob([text],{type:'text/markdown;charset=utf-8'}));const a=document.createElement('a');a.href=u;a.download='ShipOne-receipt.md';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);return true;},
  notify:async()=>{},openExternal:async url=>{window.open(url,'_blank','noopener,noreferrer');}
} satisfies DesktopAPI;
