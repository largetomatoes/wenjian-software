import fallback from '@/updates/releases.json';
const source='https://largetomatoes.github.io/wenjian-web/updates/releases.json';
// Same public discovery data on an independent origin. No notebook or credentials.
export async function GET(){
 const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=300','Access-Control-Allow-Origin':'*'};
 try{
  const response=await fetch(source,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(4500)});
  if(!response.ok)throw Error('Source unavailable');
  const text=await response.text();if(text.length>4*1024*1024)throw Error('Index too large');
  const value=JSON.parse(text);if(value?.schema!==1||!Array.isArray(value.releases))throw Error('Invalid index');
  return new Response(text,{headers});
 }catch{return new Response(JSON.stringify(fallback),{headers:{...headers,'X-Wenjian-Update-Source':'bundled-fallback'}});}
}
