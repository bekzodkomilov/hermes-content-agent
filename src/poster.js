import jpeg from 'jpeg-js';
import font from './assets/font.js';
export function cleanTitle(text) {
 const first=String(text||'').split('\n')[0].replace(/[#*_`]/g,'').trim();
 const clean=[...first].filter(c=>font[c]).join('').trim();
 return clean && clean.length<=52?clean:'MENYUGA YANGI NAFAS';
}
export function composePoster(bytes,title) {
 const src=jpeg.decode(bytes,{useTArray:true,maxResolutionInMP:3,maxMemoryUsageInMB:80});
 // Separate brand and headline bands never cover the product photograph.
 const width=src.width, top=Math.round(width*.10), bottom=Math.round(width*.24),height=src.height+top+bottom;
 const data=new Uint8Array(width*height*4);
 const ink=[12,40,35],paper=[255,247,223],gold=[228,175,72];
 function rect(x,y,w,h,color){
  for(let yy=Math.max(0,Math.floor(y));yy<Math.min(height,Math.ceil(y+h));yy++)
   for(let xx=Math.max(0,Math.floor(x));xx<Math.min(width,Math.ceil(x+w));xx++){
    const i=(yy*width+xx)*4;data[i]=color[0];data[i+1]=color[1];data[i+2]=color[2];data[i+3]=255;
   }
 }
 rect(0,0,width,height,ink);data.set(src.data,top*width*4);
 function measure(text,size){return [...text].reduce((n,c)=>n+(font[c]?.a||0),0)*size/80;}
 function text(value,x,y,size,color){
  const scale=size/80;
  for(const c of value){const g=font[c];if(!g)continue;
   for(let i=0;i<g.r.length;i+=3)rect(x+(g.x+g.r[i+1])*scale,y+(g.y+g.r[i])*scale,g.r[i+2]*scale,Math.max(1,scale),color);
   x+=g.a*scale;
  }
 }
 const margin=width*.055;
 text('HERMES HORECA',margin,top*.23,width*.030,paper);
 rect(width-margin-width*.08,top*.48,width*.08,width*.006,gold);
 title=cleanTitle(title).toUpperCase();
 let size=width*.062,lines=[];
 const words=title.split(/\s+/);let line='';
 for(const word of words){if(line && measure(line+' '+word,size)>width-2*margin){lines.push(line);line=word;}else line=line?line+' '+word:word;}
 if(line)lines.push(line);
 if(lines.length>2){lines=[title];size=Math.min(size,(width-2*margin)/measure(title,80)*80);}
 for(const line of lines)if(measure(line,size)>width-2*margin)size=Math.min(size,(width-2*margin)/measure(line,80)*80);
 const y=top+src.height;
 rect(margin,y+bottom*.12,width*.12,width*.006,gold);
 lines.forEach((line,i)=>text(line,margin,y+bottom*.23+i*size*1.18,size,paper));
 return new Blob([jpeg.encode({width,height,data},90).data],{type:'image/jpeg'});
}
