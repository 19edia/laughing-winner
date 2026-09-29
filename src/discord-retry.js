const MAX_TIMER_MS=2147483647;
const PROGRESS_INTERVAL_MS=60000;

function abortError(){return Object.assign(new Error('A inicialização do Discord foi cancelada.'),{name:'AbortError',code:'ABORT_ERR'});}
function checkAbort(signal){if(signal?.aborted)throw abortError();}

function attemptStart(object,start,signal){
 if(!signal)return Promise.resolve().then(()=>start(object));
 return new Promise((resolve,reject)=>{
  let settled=false;
  const finish=(error)=>{if(settled)return;settled=true;signal.removeEventListener('abort',cancel);if(error)reject(error);else resolve();};
  const cancel=()=>finish(abortError());
  signal.addEventListener('abort',cancel,{once:true});
  if(signal.aborted){cancel();return;}
  try{Promise.resolve(start(object)).then(()=>finish(),finish);}catch(error){finish(error);}
 });
}

function waitForRetry(retryAfterMs,retryAt,{signal,report}){
 return new Promise((resolve,reject)=>{
  let timeout,progress,remaining=retryAfterMs,settled=false;
  const finish=(error)=>{
   if(settled)return;settled=true;clearTimeout(timeout);clearTimeout(progress);
   signal?.removeEventListener('abort',cancel);if(error)reject(error);else resolve();
  };
  const cancel=()=>finish(abortError());
  const arm=()=>{
   // Node truncates timers beyond 2^31-1 ms to 1 ms. Split unusually long
   // Retry-After values instead of accidentally retrying immediately.
   const chunk=Math.min(MAX_TIMER_MS,remaining);
   timeout=setTimeout(()=>{remaining-=chunk;if(remaining>0)arm();else finish();},chunk);
  };
  const progressTick=()=>{
   if(settled)return;
   report(Math.max(0,retryAt-Date.now()));
   progress=setTimeout(progressTick,PROGRESS_INTERVAL_MS);
  };
  signal?.addEventListener('abort',cancel,{once:true});
  if(signal?.aborted){cancel();return;}
  report(retryAfterMs);arm();progress=setTimeout(progressTick,PROGRESS_INTERVAL_MS);
 });
}

/** A destroyed Discord Client must never be reused for the next login. */
export async function startDiscordWithRetry({create,start,stop,onWait=()=>{},onResume=()=>{},log=console.info,signal}){
 let lastProgress=-Infinity;
 const report=remaining=>{
  const now=Date.now();if(now-lastProgress<PROGRESS_INTERVAL_MS)return;lastProgress=now;
  try{log(`[DISCORD][LIMITE] Aguardando liberação da API. Nova tentativa em pelo menos ${Math.ceil(remaining/1000)} segundos.`);}catch{/* Logging must not interrupt the cooldown. */}
 };
 while(true){
  checkAbort(signal);
  const object=create();
  try{
   await attemptStart(object,start,signal);checkAbort(signal);return object;
  }catch(error){
   // Keep the actual login error if cleanup also fails.
   try{await stop(object);}catch{/* The original error is the useful diagnostic. */}
   const delay=error?.retryAfterMs;
   if(signal?.aborted||error?.code!=='DISCORD_RATE_LIMITED'||typeof delay!=='number'||!Number.isFinite(delay)||delay<=0||Math.ceil(delay)>Number.MAX_SAFE_INTEGER-Date.now())throw error;
   const retryAfterMs=Math.ceil(delay),retryAt=Date.now()+retryAfterMs;
   try{
    await onWait({retryAfterMs,retryAt});
    await waitForRetry(retryAfterMs,retryAt,{signal,report});
   }finally{await onResume();}
  }
 }
}

/** Only time spent actively starting counts toward the startup deadline. */
export function createStartupDeadline({timeoutMs,onTimeout}){
 if(typeof timeoutMs!=='number'||!Number.isFinite(timeoutMs)||timeoutMs<0||timeoutMs>Number.MAX_SAFE_INTEGER)throw new TypeError('Prazo de inicialização inválido.');
 if(typeof onTimeout!=='function')throw new TypeError('A ação de tempo limite é obrigatória.');
 let remaining=Math.ceil(timeoutMs),startedAt,timer,active=false,finished=false;
 const arm=()=>{
  active=true;startedAt=Date.now();const chunk=Math.min(MAX_TIMER_MS,remaining);
  timer=setTimeout(()=>{
   remaining=Math.max(0,remaining-chunk);
   if(remaining>0){arm();return;}
   active=false;finished=true;onTimeout();
  },chunk);
 };
 arm();
 return {
  pause(){if(!active||finished)return;clearTimeout(timer);remaining=Math.max(0,remaining-Math.max(0,Date.now()-startedAt));active=false;},
  resume(){if(!active&&!finished)arm();},
  clear(){clearTimeout(timer);active=false;finished=true;}
 };
}
