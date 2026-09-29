import {tx,enqueue,audit} from './db.js';

// The web request only records intent. Discord can take minutes to lift a rate
// limit, so publication must outlive a browser connection or reverse proxy timeout.
export async function requestPanelPublication(pool,actor){
 return tx(pool,async c=>{
  await c.query("SELECT pg_advisory_xact_lock(hashtext('publish-panels'))");
  const existing=(await c.query("SELECT id FROM jobs WHERE kind='publish-panels' AND status='pending' ORDER BY id LIMIT 1")).rows[0];
  if(existing)return {ok:true,jobId:existing.id,status:'pending',message:'A atualização já está na fila. Acompanhe a operação em Bot e histórico.'};
  const jobId=await enqueue(c,'publish-panels',{actor:String(actor)});
  await audit(c,actor,'Atualização dos painéis Discord solicitada',{jobId});
  return {ok:true,jobId,status:'pending',message:'Atualização colocada na fila. Aguarde a operação aparecer como Concluído antes de testar os botões.'};
 });
}
