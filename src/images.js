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
export async function reserveGeneration(env) {
 if(!env.AI) throw new Error('AI binding missing');
 // Hard cap applies across manual, scheduled and regeneration attempts.
 await sql(env,'CREATE TABLE IF NOT EXISTS ai_usage(day TEXT PRIMARY KEY, attempts INTEGER NOT NULL)').run();
 const day=new Date().toISOString().slice(0,10);
 const slot=await sql(env,'INSERT INTO ai_usage(day,attempts) VALUES(?,1) ON CONFLICT(day) DO UPDATE SET attempts=attempts+1 WHERE attempts<5 RETURNING attempts',day).first();
 if(!slot) {const e=new Error('Daily cap');e.code='DAILY_CAP';throw e;}
}
export async function createImage(env,d,reserved=false) {
 if(!reserved)await reserveGeneration(env);
 const form=new FormData();
 form.set('width','1024');form.set('height','1280');
 const rawTitle=(d.caption||d.facts).split('\n')[0].replace(/[#*_`]/g,'').trim();
 const title=rawTitle.length<=42?rawTitle:'MENYUGA YANGI NAFAS';
 const variants=[
  'Warm editorial food photograph: dark walnut table, charcoal slate serving board, rich warm blurred restaurant background, dramatic side light, orange-gold headline band.',
  'Bold modern product campaign: saturated cobalt blue backdrop with subtle tonal depth, clean sculptural platform, directional shadows, orange accent and ivory typography.',
  'Premium magazine food cover: deep forest green background, dark natural stone tabletop, warm spotlight, elegant cream headline and restrained gold accents.'
 ];
 const seed=[...(d.id||'')].reduce((n,c)=>n+c.charCodeAt(0),Number(d.revision)||0);
 const style=variants[seed%variants.length];
 form.set('prompt',`Design a finished premium foodservice advertising POSTER, vertical 4:5, with art-directed photography and typography. ${style} Product facts: ${d.facts}. Make the product a large appetizing hero occupying the middle 65 percent, with realistic texture, dimensional highlights and shallow depth of field. Compose with visual hierarchy, deliberate asymmetry, depth and sophisticated negative space. Use only ingredients supported by facts; do not add extra patties, bun layers, fillings, packaging or side dishes. Place a small clean typographic brand label 'HERMES HORECA' at top left; no invented emblem. At bottom place one bold, perfectly legible short headline exactly '${title}', in a clean condensed sans-serif with strong contrast; keep generous margins and do not cover the food. No other text, prices, badges, numbers, watermarks or competitor branding. ${d.source?'Use input_image_0 as product reference, preserving product shape, color, filling and packaging. If it is a screenshot, use only the food, never the phone UI or catalog layout.':'Create an illustrative product photograph based on the facts.'} Output only the final advertising artwork, no phone frame or mockup.`);

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
