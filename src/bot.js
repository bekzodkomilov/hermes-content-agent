import {createImage} from './images.js';
import {sql,claimJob,claimDraft,newDraft} from './store.js';
import {telegram,say,buttons,preview,createCaption,sendDraft} from './api.js';
export function allowed(env,u) {
 const m=u.message || u.callback_query?.message;
 const from=u.callback_query?.from || u.message?.from;
 return Boolean(env.ADMIN_USER_ID && String(from?.id)===String(env.ADMIN_USER_ID) && m?.chat?.type==='private' && String(m.chat.id)===String(env.ADMIN_USER_ID));
}
export async function publish(env,id,rev) {
 const d=await claimDraft(env,id,rev,'publishing');
 if(!d) return false;
 // Persist the claim BEFORE the network call. A crash or timeout never auto-resends.
 try {
  const r=await sendDraft(env,env.CHANNEL_ID,d);
  await sql(env,"UPDATE drafts SET status='published',message_id=? WHERE id=?",r.message_id,id).run();
 } catch {
  await sql(env,"UPDATE drafts SET status='uncertain' WHERE id=?",id).run();
  await say(env,`⚠️ ${id}: yuborish natijasi noma’lum. Kanalni tekshiring. Dublikat bo‘lmasligi uchun avtomatik qayta yuborilmaydi.`);
  return false;
 }
 await say(env,`✅ ${id}: kanalga yuborildi.`);
 return true;
}
async function generate(env,d) {
 try {
  const caption=await createCaption(env,d.facts);
  const photo=await createImage(env,d);
  const form=new FormData();
  form.set('chat_id',env.ADMIN_USER_ID);form.set('photo',photo,'hermes.jpg');form.set('caption',caption);
  const sent=await telegram(env,'sendPhoto',form);
  const file=sent.photo?.at(-1)?.file_id;
  if(!file)throw new Error('No Telegram photo ID');
  await sql(env,"UPDATE drafts SET photo=?,caption=?,status='pending' WHERE id=? AND status='generating'",file,caption,d.id).run();
  await say(env,`Loyiha ${d.id} · v${d.revision}\nTekshirib, tasdiqlang.`,{reply_markup:buttons(d)});
 } catch(error) {
  await sql(env,"UPDATE drafts SET status='failed' WHERE id=? AND status='generating'",d.id).run();
  if(error.code==='DAILY_CAP')return say(env,'Bugungi 5 ta rasm yaratish limiti tugadi. Limit Toshkent vaqti bilan 05:00 da yangilanadi.');
  await say(env,`⚠️ ${d.id}: AI rasmni tayyorlash yoki ko‘rsatishda xato. /drafts orqali holatni tekshiring. Yangi urinish uchun mahsulotni qayta yuboring.`);
 }
}
async function auto(env,id) {
 const p=await sql(env,'SELECT * FROM products ORDER BY used,id LIMIT 1').first();
 if(!p) return say(env,'Avtomatik post uchun katalog bo‘sh. Mahsulot rasmini «/add Mahsulot nomi | tavsif» izohi bilan yuboring.');
 await sql(env,'UPDATE products SET used=? WHERE id=?',Date.now(),p.id).run();
 await generate(env,await newDraft(env,id,p.photo,p.facts));
}
async function callback(env,c) {
 await telegram(env,'answerCallbackQuery',{callback_query_id:c.id}).catch(()=>{});
 const [action,id,r]=String(c.data||'').split(':'); const rev=Number(r);
 if(!/^[a-z0-9-]{1,48}$/.test(id||'') || !Number.isSafeInteger(rev)) return;
 if(action==='ok') {
  if(!await publish(env,id,rev)) await say(env,'Bu tugma eskirgan yoki loyiha allaqachon ko‘rib chiqilgan. /drafts');
  return;
 }
 if(!['no','edit','regen'].includes(action)) return;
 const d=await claimDraft(env,id,rev,action==='no'?'rejected':action==='edit'?'editing':'generating');
 if(!d) return say(env,'Bu tugma eskirgan. /drafts');
 if(action==='no') return say(env,'Loyiha rad etildi.');
 if(action==='edit') {
  const old=await sql(env,'SELECT * FROM sessions WHERE admin=?',env.ADMIN_USER_ID).first();
  if(old) await sql(env,"UPDATE drafts SET status='pending' WHERE id=? AND revision=? AND status='editing'",old.draft,old.revision).run();
  await sql(env,'INSERT OR REPLACE INTO sessions(admin,draft,revision) VALUES(?,?,?)',env.ADMIN_USER_ID,id,rev).run();
  return say(env,'Yangi tayyor matnni yuboring (1000 belgigacha). Bekor qilish: /cancel');
 }
 await sql(env,'UPDATE drafts SET revision=revision+1 WHERE id=?',id).run();
 await generate(env,{...d,revision:rev+1});
}
const HELP=`Hermes kontent yordamchisi\n\nAI rasm rejimi. Rasm + izoh yuboring — mahsulot asosida yangi reklama rasmi yarataman. Matn berilgan faktlardan tuziladi. Kuniga 5 ta urinish. AI rasmini tasdiqlashdan oldin mahsulotga mosligini tekshiring.\n/add Nomi | aniq tavsif — rasm izohida yozing, katalogga saqlanadi.\n/new Mahsulot va tavsif — tavsifdan yangi AI rasm.\n/auto — katalogdan post.\n/products — katalog\n/remove ID — katalogdan o‘chirish\n/drafts — oxirgi loyihalar\n/show ID — loyihani ko‘rsatish\n/cancel — matn tahririni bekor qilish\n/id — Telegram ID\n\nDushanba va payshanba 10:00 (Toshkent) post tayyorlayman. Faqat tasdiqlasangiz kanalga yuboraman.`;
async function message(env,m,id) {
 const t=(m.text||m.caption||'').trim();
 if(t==='/start'||t==='/help') return say(env,HELP);
 if(t==='/id') return say(env,`Telegram ID: ${m.from.id}`);
 if(t==='/cancel') {
  const s=await sql(env,'SELECT * FROM sessions WHERE admin=?',env.ADMIN_USER_ID).first();
  if(s) {
   await sql(env,"UPDATE drafts SET status='pending' WHERE id=? AND revision=? AND status='editing'",s.draft,s.revision).run();
   await sql(env,'DELETE FROM sessions WHERE admin=?',env.ADMIN_USER_ID).run();
  }
  return say(env,'Tahrir bekor qilindi. /drafts');
 }
 if(t==='/products') {
  const {results}=await sql(env,'SELECT id,facts FROM products ORDER BY id LIMIT 30').all();
  return say(env,results.map(p=>`${p.id}. ${p.facts.slice(0,100)}`).join('\n')||'Katalog bo‘sh. /help');
 }
 if(/^\/remove \d+$/.test(t)) {
  await sql(env,'DELETE FROM products WHERE id=?',Number(t.split(' ')[1])).run();
  return say(env,'Katalogdan o‘chirildi.');
 }
 if(t==='/drafts') {
  const {results}=await sql(env,'SELECT id,status,revision FROM drafts ORDER BY created DESC LIMIT 15').all();
  return say(env,results.map(d=>`${d.id} · ${d.status} · v${d.revision}\n/show ${d.id}`).join('\n')||'Loyihalar yo‘q.');
 }
 if(t.startsWith('/show ')) {
  const d=await sql(env,'SELECT * FROM drafts WHERE id=?',t.slice(6).trim()).first();
  if(d?.status==='pending') return preview(env,d);
  return say(env,`Holat: ${d?.status||'topilmadi'}. publishing/uncertain bo‘lsa avval kanalni tekshiring. generating uzoq vaqt qolsa yangi urinishni qo‘lda boshlang.`);
 }
 if(t==='/auto') return auto(env,id);
 const s=await sql(env,'SELECT * FROM sessions WHERE admin=?',env.ADMIN_USER_ID).first();
 if(s) {
  if(!m.text || t.startsWith('/') || t.length>1000) return say(env,'Oddiy tayyor matn yuboring, 1000 belgigacha; yoki /cancel.');
  const d=await sql(env,"UPDATE drafts SET caption=?,revision=revision+1,status='pending' WHERE id=? AND revision=? AND status='editing' RETURNING *",t,s.draft,s.revision).first();
  await sql(env,'DELETE FROM sessions WHERE admin=?',env.ADMIN_USER_ID).run();
  if(d) return preview(env,d);
  return say(env,'Tahrir eskirgan. /drafts');
 }
 const photo=m.photo?.filter(p=>p.width<=480 && p.height<=480).at(-1)?.file_id || m.photo?.at(-1)?.file_id;
 if(t.startsWith('/add ')) {
  const facts=t.slice(5).trim();
  if(!facts||facts.length>900) return say(env,'Mahsulot ma’lumotlari 1–900 belgi bo‘lsin.');
  await sql(env,'INSERT INTO products(photo,facts) VALUES(?,?)',photo||null,facts).run();
  return say(env,'✅ Katalogga saqlandi. /auto bilan sinab ko‘ring.');
 }
 if(photo||t.startsWith('/new ')) {
  const facts=t.replace(/^\/new\s+/,'').trim();
  if(!facts) return say(env,'Rasmni mahsulot nomi va tavsifini izohga yozib qayta yuboring.');
  if(facts.length>900) return say(env,'Tavsif 900 belgidan oshmasin.');
  await say(env,'AI rasm va post tayyorlanyapti. Biroz kuting.');
  return generate(env,await newDraft(env,id,photo,facts));
 }
 return say(env,'Mahsulot rasmini izoh bilan yuboring yoki /help.');
}
export async function runJob(env,p,id) {
 if(p.kind!=='scheduled'&&!allowed(env,p.update)) return;
 if(!env.ADMIN_USER_ID) return;
 if(!await claimJob(env,id)) return;
 if(p.kind==='scheduled') return auto(env,id);
 if(p.update.callback_query) return callback(env,p.update.callback_query);
 return message(env,p.update.message,id);
}
