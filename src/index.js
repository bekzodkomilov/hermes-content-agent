import {WorkflowEntrypoint} from 'cloudflare:workers';
import {initialize} from './store.js';
import {runJob,allowed} from './bot.js';
import {telegram,say} from './api.js';
const headers={'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const reply=(text,status=200)=>new Response(text,{status,headers});
async function secretMatches(a,b) {
 if(!a||!b) return false;
 const enc=new TextEncoder();
 const [x,y]=await Promise.all([a,b].map(s=>crypto.subtle.digest('SHA-256',enc.encode(s))));
 const xx=new Uint8Array(x), yy=new Uint8Array(y); let v=0;
 for(let i=0;i<xx.length;i++) v|=xx[i]^yy[i];
 return v===0;
}
async function enqueue(env,id,params) {
 try { await env.CONTENT_WORKFLOW.create({id,params}); }
 catch(error) {
  // Only acknowledge if the same durable workflow really exists.
  try { const existing=await env.CONTENT_WORKFLOW.get(id); await existing.status(); }
  catch { throw error; }
 }
}
const setupPage=`<!doctype html><html lang="uz"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hermes botni ulash</title><style>body{font:18px system-ui;max-width:600px;margin:60px auto;padding:24px;background:#f7f9f9;color:#163c40}input,button{box-sizing:border-box;width:100%;padding:14px;font:inherit;margin:10px 0}button{background:#12676d;color:white;border:0;border-radius:8px}</style><h1>Hermes botni ulash</h1><p>Cloudflare Settings → Variables and Secrets bo‘limidagi kalitlarni avval kiriting. Keyin shu yerga SETUP_SECRET qiymatini yozing.</p><form method="post" action="/setup"><label>Ulash paroli<input type="password" name="secret" required autocomplete="off" minlength="32"></label><button>Telegram bilan ulash</button></form><p>Bu amal bazani tayyorlaydi va bot webhookini shu serverga ulaydi.</p></html>`;
export default {
 async fetch(request,env) {
  const url=new URL(request.url);
  if(request.method==='GET'&&url.pathname==='/') return reply('Hermes Content Agent. Sozlash: /setup');
  if(request.method==='GET'&&url.pathname==='/health') return reply('ok · typeset-v6');
  if(url.pathname==='/setup') {
   if(request.method==='GET') return new Response(setupPage,{headers:{...headers,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"}});
   if(request.method!=='POST') return reply('Method not allowed',405);
   if(request.headers.get('Origin')!==url.origin) return reply('Forbidden',403);
   if(Number(request.headers.get('Content-Length')||0)>4096) return reply('Too large',413);
   const form=await request.formData();
   if(!env.SETUP_SECRET || env.SETUP_SECRET.length<32 || !await secretMatches(String(form.get('secret')||''),env.SETUP_SECRET)) return reply('Ulash paroli noto‘g‘ri.',403);
   if(!env.TELEGRAM_BOT_TOKEN || !/^[A-Za-z0-9_-]{32,256}$/.test(env.WEBHOOK_SECRET||'')) return reply('TELEGRAM_BOT_TOKEN va WEBHOOK_SECRET ni to‘ldiring.',400);
   try {
    const bot=await telegram(env,'getMe',{});
    if(bot.username?.toLowerCase()!=='hermeshorecabot') return reply('Token @HermesHorecabot uchun emas. Tokenni tekshiring.',400);
    const member=await telegram(env,'getChatMember',{chat_id:env.CHANNEL_ID,user_id:bot.id});
    if(member.status!=='creator'&&!(member.status==='administrator'&&member.can_post_messages)) return reply('Botga kanalda Post Messages huquqini yoqing.',400);
    await initialize(env);
    await telegram(env,'setWebhook',{url:`${url.origin}/telegram`,secret_token:env.WEBHOOK_SECRET,allowed_updates:['message','callback_query'],drop_pending_updates:false});
    return reply('Ulandi. @HermesHorecabot ga /id yuboring. Chiqqan raqamni Cloudflare’da ADMIN_USER_ID qilib kiriting. /start yuboring, mahsulotni /add orqali saqlang va /auto bilan sinang. API kaliti kerak emas.');
   } catch { return reply('Ulashda xato. Bot tokeni, kanal huquqi va D1 bindingni tekshiring.',502); }
  }
  if(url.pathname!=='/telegram'||request.method!=='POST') return reply('Not found',404);
  if(!await secretMatches(request.headers.get('X-Telegram-Bot-Api-Secret-Token'),env.WEBHOOK_SECRET)) return reply('Forbidden',403);
  if(Number(request.headers.get('Content-Length')||0)>100000) return reply('Too large',413);
  let u; try { u=await request.json(); } catch { return reply('Invalid JSON',400); }
  if(!Number.isSafeInteger(u.update_id)) return reply('Invalid update',400);
  // Anyone can retrieve ONLY their own ID; this never gives them admin rights.
  if(u.message?.chat?.type==='private' && u.message?.text==='/id' && u.message.from?.id===u.message.chat.id) {
   try { await telegram(env,'sendMessage',{chat_id:u.message.chat.id,text:`Telegram ID: ${u.message.from.id}`}); }
   catch { return reply('Retry',503); }
   return reply('ok');
  }
  if(!allowed(env,u)) return reply('ok');
  try { await enqueue(env,`u-${u.update_id}`,{kind:'telegram',update:u}); }
  catch { return reply('Retry',503); }
  return reply('ok');
 },
 async scheduled(event,env,ctx) {
  if(!env.ADMIN_USER_ID || !env.TELEGRAM_BOT_TOKEN) return;
  const day=new Date(event.scheduledTime).toISOString().slice(0,10);
  ctx.waitUntil(enqueue(env,`schedule-${day}`,{kind:'scheduled'}));
 }
};
export class ContentWorkflow extends WorkflowEntrypoint {
 async run(event,step) {
  return step.do('process-once',{retries:{limit:0,delay:'1 second'},timeout:'15 minutes'},async()=>{
   try { await runJob(this.env,event.payload,event.instanceId); }
   catch {
    // Do not log tokens, URLs containing tokens, uploaded images or provider bodies.
    console.error('Hermes job failed',event.instanceId);
    if(this.env.ADMIN_USER_ID) await say(this.env,`⚠️ Vazifa ${event.instanceId} tugamadi. /drafts orqali tekshiring. Zarur bo‘lsa qayta buyruq yuboring.`).catch(()=>{});
    throw new Error('Hermes job failed; inspect draft status');
   }
   return {completed:true};
  });
 }
}
