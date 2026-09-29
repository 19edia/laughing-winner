import {createServer} from 'node:http';

// Expose a port to the hosting platform without exposing an uninitialized app.
export function createStartupGate(){
 let app=null,status='starting',retryAt=0,recoveryHealth=null;
 return {
  async handler(req,res){
   if(app)return app(req,res);
   const retryAfter=Math.max(1,Math.ceil((retryAt-Date.now())/1000));
   let code=503,health=false;
   // A known, timed Discord cooldown is recoverable without restarting this
   // process. Only liveness becomes available; readiness and all operations stay blocked.
   if(recoveryHealth&&req.url?.split('?')[0]==='/health'&&['GET','HEAD'].includes(req.method)){
    const checkHealth=recoveryHealth;
    try{await checkHealth();if(recoveryHealth===checkHealth){code=200;health=true;}}catch{/* Database failure is not healthy recovery. */}
   }
   res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Retry-After':String(retryAt?retryAfter:5),'X-Content-Type-Options':'nosniff'});
   const message=status==='waiting_discord'?'O Discord pediu uma pausa. A conexão será tentada automaticamente após o prazo.':status==='connecting_discord'?'Reconectando ao Discord. O painel será liberado após as verificações.':status==='starting'?'O serviço está iniciando. Aguarde a conclusão das verificações.':'O serviço está temporariamente indisponível.';
   res.end(JSON.stringify({status,message,...(recoveryHealth?{ok:health,ready:false,retryAfter:retryAt?retryAfter:0}:{})}));
  },
  waitForDiscord({retryAt:nextRetryAt},checkHealth=async()=>{}){status='waiting_discord';retryAt=nextRetryAt;recoveryHealth=checkHealth;},
  resumeDiscord(){if(recoveryHealth){status='connecting_discord';retryAt=0;}},
  activate(handler){if(typeof handler!=='function')throw new TypeError('Aplicação HTTP inválida.');app=handler;},
  fail(){app=null;status='unavailable';retryAt=0;recoveryHealth=null;}
 };
}

export function listenHttp(handler,port){
 return new Promise((resolve,reject)=>{
  const server=createServer(handler);
  server.once('error',reject);
  server.listen(port,'0.0.0.0',()=>{server.off('error',reject);resolve(server);});
 });
}
