import {composePoster,cleanTitle} from './poster.js';
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
 form.set('width','1024');form.set('height','1024');
 const title=cleanTitle(d.caption||d.facts);
 const variants=[
  'Warm editorial food photograph: dark walnut table, charcoal slate serving board, rich warm blurred restaurant background, dramatic side light, warm gold highlights.',
  'Bold modern product campaign: saturated cobalt blue backdrop with subtle tonal depth, clean sculptural platform, directional shadows, orange accents.',
  'Premium magazine food cover: deep forest green background, dark natural stone tabletop, warm spotlight, restrained warm highlights.'
 ];
 const seed=[...(d.id||'')].reduce((n,c)=>n+c.charCodeAt(0),Number(d.revision)||0);
 const style=variants[seed%variants.length];
 form.set('prompt',`Premium editorial food advertising PHOTOGRAPH, no typography. ${style} Product facts: ${d.facts}. Large appetizing hero product, realistic food texture, dimensional highlights and shallow depth of field. Deliberate composition and sophisticated depth. Keep the whole product in frame with space around it. Use only ingredients supported by facts; do not add extra patties, bun layers, fillings or side dishes. ABSOLUTELY NO TEXT, letters, words, logos, symbols, watermarks, labels, signage, menus or graphics anywhere. ${d.source?'Use input_image_0 only as food reference, preserving product shape, color and filling. Ignore all text, logos, packaging labels, catalog graphics and phone interface in the reference.':'Create an illustrative product photograph based on the facts.'} Image must be entirely photographic. All typography will be added later by a separate layout engine.`);

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
 return composePoster(Buffer.from(result.image,'base64'),title);
}
