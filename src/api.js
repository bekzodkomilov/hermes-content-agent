export async function telegram(env,method,data) {
 const multipart=data instanceof FormData;
 const res=await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`,{
  method:'POST', headers:multipart?{}:{'Content-Type':'application/json'},
  body:multipart?data:JSON.stringify(data), signal:AbortSignal.timeout(60000)
 });
 const json=await res.json();
 if(!res.ok || !json.ok) throw new Error(`Telegram ${method} failed (${res.status}; ${json.error_code||0})`);
 return json.result;
}
export const say=(env,text,extras={})=>telegram(env,'sendMessage',{chat_id:env.ADMIN_USER_ID,text,...extras});
export function buttons(d) {
 const b=(text,action)=>({text,callback_data:`${action}:${d.id}:${d.revision}`});
 return {inline_keyboard:[[b('✅ Tasdiqlash','ok'),b('❌ Rad etish','no')],[b('✏️ Matnni o‘zgartirish','edit'),b('🔄 Shablon matni','regen')]]};
}
export async function preview(env,d) {
 await sendDraft(env,env.ADMIN_USER_ID,d);
 await say(env,`Loyiha ${d.id} · v${d.revision}\nTekshirib, tasdiqlang.`,{reply_markup:buttons(d)});
}
export async function createCaption(env,facts) {
 const text=String(facts||'').trim().replace(/\s*\|\s*/g,'\n');
 if(!text || text.length>900) throw new Error('Product facts must be 1–900 characters');
 return `Hermes Horeca\n\n${text}\n\n#HermesHoreca`;
}
export function sendDraft(env,chatId,d) {
 return d.photo
  ? telegram(env,'sendPhoto',{chat_id:chatId,photo:d.photo,caption:d.caption})
  : telegram(env,'sendMessage',{chat_id:chatId,text:d.caption});
}
