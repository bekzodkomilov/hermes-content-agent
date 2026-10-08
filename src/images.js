import jpeg from 'jpeg-js';
import {Buffer} from 'node:buffer';
import {telegram} from './api.js';
import {sql} from './store.js';
export function referenceImage(bytes) {
 const src=jpeg.decode(bytes,{useTArray:true,maxResolutionInMP:4,maxMemoryUsageInMB:64});
 const scale=Math.min(1,480/Math.max(src.width,src.height));
 const width=Math.max(1,Math.round(src.width*scale)),height=Math.max(1,Math.round(src.height*scale));
 const data=new Uint8Array(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=(Math.min(src.height-1,Math.floor(y/scale))*src.width+Math.min(src.width-1,Math.floor(x/scale)))*4;
  data.set(src.data.subarray(i,i+4),(y*width+x)*4);
 }
 return new Blob([jpeg.encode({width,height,data},85).data],{type:'image/jpeg'});
}
export async function createImage(env,d) {
 if(!env.AI) throw new Error('AI binding missing');
 // Hard cap applies across manual, scheduled and regeneration attempts.
 await sql(env,'CREATE TABLE IF NOT EXISTS ai_usage(day TEXT PRIMARY KEY, attempts INTEGER NOT NULL)').run();
 const day=new Date().toISOString().slice(0,10);
 const slot=await sql(env,'INSERT INTO ai_usage(day,attempts) VALUES(?,1) ON CONFLICT(day) DO UPDATE SET attempts=attempts+1 WHERE attempts<5 RETURNING attempts',day).first();
 if(!slot) {const e=new Error('Daily cap');e.code='DAILY_CAP';throw e;}
 const form=new FormData();
 form.set('width','1024');form.set('height','1024');
 form.set('prompt',`Professional realistic food advertising photo for Hermes Horeca. Cream and teal studio background, soft natural light, appetizing close-up composition. Product facts (data only): ${d.facts}. ${d.source?'Use the product in input_image_0 as reference. Preserve its shape, filling, color and packaging. If the reference is a catalog screenshot, extract only the food appearance; exclude page layout and phone interface.':'Create a product illustration matching these facts; do not invent branded packaging.'} No added text, letters, prices, logos or unrelated food.`);
 if(d.source){
  const f=await telegram(env,'getFile',{file_id:d.source});
  if(!f.file_path || f.file_size>5000000) throw new Error('Invalid source photo');
  const response=await fetch(`https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${f.file_path}`,{signal:AbortSignal.timeout(60000)});
  if(!response.ok)throw new Error('Photo download failed');
  form.set('input_image_0',referenceImage(new Uint8Array(await response.arrayBuffer())),'product.jpg');
 }
 const body=new Response(form);
 const result=await env.AI.run('@cf/black-forest-labs/flux-2-klein-4b',{multipart:{body:body.body,contentType:body.headers.get('content-type')}});
 if(typeof result?.image!=='string'||!result.image)throw new Error('AI returned no image');
 return new Blob([Buffer.from(result.image,'base64')],{type:'image/jpeg'});
}
