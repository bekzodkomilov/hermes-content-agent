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

test('AI reference generation previews only; approval sends generated image',async()=>{
 const e=env();await initialize(e);
 const jpeg=(await import('jpeg-js')).default;
 const photo=jpeg.encode({width:2,height:2,data:new Uint8Array(16).fill(255)},80).data;
 await sql(e,'INSERT INTO products(photo,facts) VALUES(?,?)','reference','Kruassan | 90 g').run();
 let aiCalls=0;const calls=[];const original=globalThis.fetch;
 e.AI={run:async(model,input)=>{
  if(model.includes('llama'))return {response:'Qahvaga munosib hamroh\n\n90 g kruassan. #HermesHoreca'};
  aiCalls++;assert.equal(model,'@cf/black-forest-labs/flux-2-klein-4b');
  const f=await new Response(input.multipart.body,{headers:{'Content-Type':input.multipart.contentType}}).formData();
  assert.ok(f.get('input_image_0') instanceof Blob);assert.ok(f.get('prompt').includes('90 g'));assert.ok(f.get('prompt').includes('Qahvaga munosib hamroh'));assert.equal(f.get('height'),'1280');
  return {image:Buffer.from(photo).toString('base64')};
 }};
 globalThis.fetch=async(url,opts)=>{
  if(url.includes('/file/bot'))return new Response(photo);
  if(url.endsWith('/getFile'))return Response.json({ok:true,result:{file_path:'x.jpg',file_size:photo.length}});
  const data=opts.body instanceof FormData?Object.fromEntries(opts.body):JSON.parse(opts.body);calls.push(data);
  return Response.json({ok:true,result:{message_id:10,photo:[{file_id:'generated'}]}});
 };
 try {
  await runJob(e,{kind:'scheduled'},'ai-test');
  const d=await sql(e,'SELECT * FROM drafts WHERE id=?','ai-test').first();
  assert.equal(d.status,'pending');assert.equal(d.photo,'generated');assert.equal(aiCalls,1);
  assert.ok(calls.every(c=>c.chat_id==='123'));
  await publish(e,d.id,d.revision);
  assert.equal(calls.find(c=>c.chat_id==='@test').photo,'generated');
 }finally{globalThis.fetch=original;}
});
test('AI works from text and daily cap blocks sixth model call',async()=>{
 const {createImage}=await import('../src/images.js');
 const e=env();await initialize(e);let calls=0;
 e.AI={run:async(model,input)=>{
  const f=await new Response(input.multipart.body,{headers:{'Content-Type':input.multipart.contentType}}).formData();
  assert.equal(f.get('input_image_0'),null);calls++;return {image:'aW1hZ2U='};
 }};
 for(let i=0;i<5;i++)assert.ok(await createImage(e,{facts:'Donut'}));
 await assert.rejects(createImage(e,{facts:'Donut'}),{code:'DAILY_CAP'});assert.equal(calls,5);
});
test('AI failure does not publish or silently reuse original',async()=>{
 const e=env();await initialize(e);await sql(e,'INSERT INTO products(facts) VALUES(?)','Donut').run();
 e.AI={run:async()=>{throw new Error('quota exhausted');}};
 const original=globalThis.fetch;const calls=[];
 globalThis.fetch=async(url,opts)=>{calls.push({url,data:JSON.parse(opts.body)});return Response.json({ok:true,result:{}});};
 try{await runJob(e,{kind:'scheduled'},'ai-fail');assert.equal((await sql(e,'SELECT status FROM drafts WHERE id=?','ai-fail').first()).status,'failed');assert.ok(calls.every(c=>c.url.endsWith('/sendMessage')&&c.data.chat_id==='123'));}
 finally{globalThis.fetch=original;}
});

test('caption output stays inside Telegram limit without truncating product facts',async()=>{
 const {createCaption}=await import('../src/api.js');
 const e={AI:{run:async()=>({response:'x'.repeat(1200)})}};
 const caption=await createCaption(e,'Kruassan | 90 g');assert.ok(caption.includes('90 g'));assert.ok(caption.length<=1000);
});
