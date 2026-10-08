import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {initialize,claimJob,newDraft,claimDraft,sql} from '../src/store.js';
import {allowed,publish,runJob} from '../src/bot.js';
function env() {
 const db=new DatabaseSync(':memory:');
 const wrap=(q,args=[])=>({bind:(...v)=>wrap(q,v),
  first:async()=>db.prepare(q).get(...args)||null,
  all:async()=>({results:db.prepare(q).all(...args)}),
  run:async()=>({meta:{changes:Number(db.prepare(q).run(...args).changes)}})});
 return {DB:{prepare:q=>wrap(q),batch:async ss=>Promise.all(ss.map(s=>s.run()))},ADMIN_USER_ID:'123',CHANNEL_ID:'@test',TELEGRAM_BOT_TOKEN:'fake'};
}
async function pending(e) {
 await initialize(e); await newDraft(e,'u-1','source','Product');
 await sql(e,"UPDATE drafts SET status='pending',caption='Approved caption',photo='image-file' WHERE id='u-1'").run();
}
test('only configured admin in own private chat is authorized',()=>{
 const e=env();
 assert.equal(allowed(e,{message:{from:{id:123},chat:{id:123,type:'private'}}}),true);
 assert.equal(allowed(e,{message:{from:{id:124},chat:{id:124,type:'private'}}}),false);
 assert.equal(allowed(e,{message:{from:{id:123},chat:{id:-1,type:'group'}}}),false);
 assert.equal(allowed(e,{callback_query:{from:{id:124},message:{chat:{id:123,type:'private'}}}}),false);
});
test('duplicate jobs persistently deduplicated',async()=>{
 const e=env(); await initialize(e);
 assert.equal(await claimJob(e,'u-99'),true); assert.equal(await claimJob(e,'u-99'),false);
});
test('stale revision cannot claim; edit and approval cannot both claim',async()=>{
 const e=env(); await pending(e);
 assert.equal(await claimDraft(e,'u-1',2,'publishing'),null);
 assert.ok(await claimDraft(e,'u-1',1,'editing'));
 assert.equal(await claimDraft(e,'u-1',1,'publishing'),null);
});
test('double approval sends exactly once and same approved content',async()=>{
 const e=env(); await pending(e); const calls=[]; const original=globalThis.fetch;
 globalThis.fetch=async(url,opts)=>{calls.push({url,data:JSON.parse(opts.body)});return Response.json({ok:true,result:{message_id:9}});};
 try {
  await Promise.all([publish(e,'u-1',1),publish(e,'u-1',1)]);
  const sends=calls.filter(c=>c.url.endsWith('/sendPhoto'));
  assert.equal(sends.length,1); assert.equal(sends[0].data.caption,'Approved caption'); assert.equal(sends[0].data.photo,'image-file');
  assert.equal((await sql(e,"SELECT status FROM drafts WHERE id='u-1'").first()).status,'published');
 } finally {globalThis.fetch=original;}
});
test('ambiguous Telegram failure is not automatically resent',async()=>{
 const e=env(); await pending(e);let count=0; const original=globalThis.fetch;
 globalThis.fetch=async(url)=>{if(url.endsWith('/sendPhoto')){count++;throw new Error('connection lost');}return Response.json({ok:true,result:{}});};
 try {await publish(e,'u-1',1);await publish(e,'u-1',1);assert.equal(count,1);assert.equal((await sql(e,"SELECT status FROM drafts WHERE id='u-1'").first()).status,'uncertain');}
 finally {globalThis.fetch=original;}
});
test('unauthorized job cannot write database or call provider',async()=>{
 await runJob({ADMIN_USER_ID:'123',DB:{prepare:()=>{throw new Error('Must not touch DB');}}},{kind:'telegram',update:{message:{from:{id:9},chat:{id:9,type:'private'}}}},'u-8');
});
