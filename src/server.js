import {database,initialize} from './db.js';
import {createApp} from './app.js';
import {createBot} from './bot.js';
import {boot,reporter} from './preflight.js';
import {STARTUP_TIMEOUT_MS} from './discord-connection.js';
import {listenHttp} from './startup-http.js';
import {createStartupDeadline} from './discord-retry.js';
const log=reporter();
let running,stopping=false;
const shutdown=new AbortController();
// The early HTTP listener remains unavailable until every check has passed.
const deadline=createStartupDeadline({timeoutMs:STARTUP_TIMEOUT_MS,onTimeout:()=>{log.line('BLOQUEADO','Tempo máximo de inicialização ativa (180s, sem contar pausas solicitadas pelo Discord) excedido. Aplicação NÃO liberada.');process.exit(1);}});
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,async()=>{
 if(stopping)return;stopping=true;deadline.clear();shutdown.abort();
 setTimeout(()=>process.exit(0),10000).unref();
 if(running){running.server.close();try{await running.bot.stop();await running.pool.end();}finally{process.exit(0);}}
});
try{
 running=await boot({makePool:database,initialize,makeBot:createBot,makeApp:createApp,log,
  listen:listenHttp,startupDeadline:deadline,signal:shutdown.signal});
 deadline.clear();
}catch{deadline.clear();process.exit(stopping?0:1);}
