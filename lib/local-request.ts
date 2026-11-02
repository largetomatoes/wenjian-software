export async function localRequest(input:RequestInfo|URL,init:RequestInit={},timeout=8000):Promise<Response>{
 const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
 const aborted=()=>controller.abort(init.signal?.reason);init.signal?.addEventListener('abort',aborted,{once:true});
 if(init.signal?.aborted)aborted();
 try{timer=setTimeout(()=>controller.abort(Error('本地保存等待超时，提交结果尚待核对，草稿仍保留。')),timeout);return await fetch(input,{...init,signal:controller.signal});}
 finally{clearTimeout(timer);init.signal?.removeEventListener('abort',aborted);}
}
