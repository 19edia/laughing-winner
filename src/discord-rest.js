import {DefaultRestOptions} from 'discord.js';

const gatewayRoute=url=>/^https:\/\/discord\.com\/api\/v\d+\/gateway\/bot(?:\?.*)?$/.test(String(url));
const transportError=code=>Object.assign(new Error('Falha na consulta inicial ao Discord.'),{code});

// REST's standard timer stops at the response headers. The initial Gateway
// request needs a deadline covering its body as well, before login can proceed.
export function createGatewayRequest({makeRequest=DefaultRestOptions.makeRequest,timeoutMs=15000}={}){
 return async(url,init={})=>{
  if(!gatewayRoute(url))return makeRequest(url,init);
  const controller=new AbortController();let timer,rejectAborted;
  const aborted=new Promise((_resolve,reject)=>{rejectAborted=reject;});
  const cancel=()=>{rejectAborted(transportError('DISCORD_GATEWAY_HTTP_TIMEOUT'));controller.abort();};
  if(init.signal?.aborted)throw transportError('DISCORD_GATEWAY_HTTP_TIMEOUT');
  init.signal?.addEventListener('abort',cancel,{once:true});
  timer=setTimeout(cancel,timeoutMs);
  try{
   const request=(async()=>{
    const response=await makeRequest(url,{...init,signal:controller.signal});
    // Never parse or echo proxy error pages, which might be HTML. Preserve only
    // the HTTP status and numeric retry delay needed by the REST rate limiter.
    if(response.status>=400){
     const retry=response.headers.get('retry-after');
     const headers={'content-type':'application/json'};
     if(retry!==null&&/^\d+(?:\.\d+)?$/.test(retry))headers['retry-after']=retry;
     await response.body?.cancel?.().catch(()=>{});
     // Undici's Node stream emits AbortError when an unread body is destroyed.
     // Consume that expected cancellation so it cannot crash the process.
     response.body?.once?.('error',()=>{});
     response.body?.destroy?.();
     return new Response(JSON.stringify({message:'Discord Gateway HTTP error',code:response.status}),{status:response.status,headers});
    }
    const body=await response.arrayBuffer();
    if(response.status!==200||body.byteLength>1024*1024)throw transportError('DISCORD_GATEWAY_HTTP_FORMAT');
    let parsed;try{parsed=JSON.parse(new TextDecoder().decode(body));}catch{throw transportError('DISCORD_GATEWAY_HTTP_FORMAT');}
    if(typeof parsed?.url!=='string'||!parsed.url.startsWith('wss://')||!Number.isInteger(parsed.shards)||!parsed.session_start_limit)throw transportError('DISCORD_GATEWAY_HTTP_FORMAT');
    return new Response(body,{status:200,headers:{'content-type':'application/json'}});
   })();
   return await Promise.race([request,aborted]);
  }finally{clearTimeout(timer);init.signal?.removeEventListener('abort',cancel);}
 };
}

export function gatewayRestOptions(){
 // An interaction callback cannot survive a long retry: Discord invalidates it
 // after three seconds. Report a 429 once instead of replaying an expired click.
 return {makeRequest:createGatewayRequest(),rejectOnRateLimit:['/gateway/bot','/interactions/']};
}
