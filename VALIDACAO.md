# Validação — atualização de inicialização e assistente

## 29/09/2026 — aliança RYUKETSU

- Título, apresentação, convite e acolhimento do embed atualizados para RYUKETSU. O blueprint usa o convite informado pelo usuário: `https://discord.gg/2xQgZQ3ZMV`.
- A chave `HYDRA_INVITE_URL` foi preservada por compatibilidade; o valor também deve ser atualizado no Environment do serviço Render existente.
- **17 testes direcionados aprovados, zero falhas**: aliança, tema dos embeds e recuperação dos painéis. A publicação encontra a mensagem antiga da HYDRA NO KAI, edita seu conteúdo para RYUKETSU e mantém o novo convite, sem criar outra mensagem.
- Validação local com Discord simulado. Nenhuma publicação no Discord ou implantação no Render foi executada nesta alteração.

## 29/09/2026 — publicação pelo painel e respostas dos botões

- Suíte completa: `node --test --test-concurrency=2`, **287 testes aprovados, zero falhas**. Sintaxe dos seis arquivos de produção alterados conferida.
- A publicação web agora retorna HTTP 202 após registrar `publish-panels`, sem esperar a API do Discord. Pedidos repetidos enquanto há uma publicação pendente usam o mesmo job. A fila só marca Concluído após publicação e auditoria; falhas preservam o pedido e o motivo. Administrador e Sub líder continuam autorizados, com Origin/CSRF e sessão exigidos.
- Verificação do destino das interações também antes da publicação: um Interactions Endpoint URL configurado gera orientação segura na operação, sem imprimir sua URL. Mensagens existentes do próprio bot continuam sendo editadas, e mensagens de outro bot não são modificadas.
- Bot e histórico mostra nome/ID do bot, ativação, último clique recebido e links das mensagens registradas nas divisões. Não expõe o token da interação ou conteúdo do pacote. Há registro separado do evento bruto INTERACTION_CREATE para distinguir chegada ao Gateway e conversão na biblioteca.
- Teste com o caminho real `InteractionCreate` do discord.js e transporte simulado confirma que Verificar e Denunciar abrem modais imediatamente, sem consultas ao banco. Também cobre resposta privada durante inicialização, comando desconhecido e callback expirado sem uma segunda tentativa inútil.
- Callbacks recusados por HTTP 429 deixam de aguardar e repetir uma interação cujo prazo inicial já expirou. O tratamento da consulta inicial `/gateway/bot` e sua recuperação continuam preservados.
- Leituras do painel com prazo de 20 segundos, cancelamento ao trocar de categoria, proteção contra resposta antiga e mensagem útil para HTML de manutenção. Formulários bloqueiam envios concorrentes e falhas de rede em operações de escrita não provocam reenvio automático.
- Edge real, com API simulada: publicação gera um único POST, fecha a confirmação, mostra número do job e estado pendente, botão Atualizar funciona; sem erros JavaScript ou transbordamento no celular de 390 px. Prévia com dados fictícios em `../EXEMPLOS/estado-bot.png`.

Limite: o usuário informou ausência de eventos nos logs ao clicar. Os testes locais confirmam o funcionamento quando o evento chega, mas não comprovam por que o Discord real não o entregou à instância Render. Após publicar esta versão, teste a mensagem pelos links do painel e confira a identidade do bot/recebimento. Nenhum deploy, clique na conta real ou alteração no Developer Portal foi executado.

---

## 28/09/2026 — recuperação do HTTP 429 no Render

- Suíte completa: `node --test --test-concurrency=2`, **272 testes aprovados, zero falhas**. Sintaxe dos sete módulos de produção alterados conferida.
- O prazo de 1734 segundos fornecido no log equivale a 28 minutos e 54 segundos. O erro classificado contém apenas código seguro e prazo numérico; a inicialização descarta o Client que falhou e aguarda o prazo inteiro antes de criar outro. Banco, migração e porta são preservados.
- Quinze testes do novo módulo de recuperação: esperas de 1714/1734 segundos com relógio simulado, limites repetidos, objeto novo por tentativa, erros não recuperáveis, duração inválida, cancelamento e timers longos sem overflow. O limite global de 180 segundos pausa durante o cooldown e retoma somente o saldo restante.
- Durante a recuperação conhecida, `/health` responde 200 com `ready:false` apenas se o banco ainda responde. `/ready`, painel, login e todas as operações permanecem 503. Falha do banco volta a tornar o health check indisponível. O instalador usa a mesma espera com verificação do processo, sem banco.
- Integração com PGlite e dois Clients: 429, espera, nova conexão, mesma porta, migração única e ativação única. O bot não inicia a fila antes da conexão e validação reais. O Client anterior nunca é reutilizado, pois discord.js o destrói após o login falhar.
- Cancelamento antes/durante o login e durante a espera remove listeners e timers. SIGTERM/SIGINT são registrados antes do boot para permitir encerrar também uma pausa longa.
- Esta recuperação substitui o encerramento imediato após 429 descrito na validação anterior. Falhas definitivas continuam encerrando a aplicação; somente 429 com prazo válido recebe nova tentativa.

Testes locais com Discord simulado. Nenhum token real foi lido, nenhuma mensagem foi enviada e nenhum deploy foi executado. O prazo é respeitado enquanto o processo permanece ativo; um encerramento pela hospedagem ou reinício manual exige nova inicialização e consulta do prazo ao Discord. O escopo externo do limite (bot, rota ou IP) não pode ser determinado apenas pelo log fornecido.

---

## 28/09/2026 — porta do Render e consulta inicial ao Gateway

- Suíte completa após a última correção: `node --test --test-concurrency=2`, **248 testes aprovados, zero falhas**. Sintaxe dos sete módulos de produção alterados e do novo teste de transporte conferida.
- Porta `PORT` aberta em `0.0.0.0` após validar as variáveis. Enquanto os testes obrigatórios estão pendentes, todas as rotas, inclusive `/health`, `/ready`, painel e login, respondem 503. A mesma porta passa a atender o aplicativo somente depois da validação e ativação do bot. Falhas fecham a porta e preservam o encerramento com código 1.
- Aplicativo e instalador compartilham esse comportamento. O Render deve usar Health Check Path `/health`, como já definido em `render.yaml` e agora destacado no tutorial para serviços criados manualmente.
- A consulta inicial `/gateway/bot` tem prazo total de 15 segundos, incluindo a leitura do corpo. O transporte padrão da biblioteca encerrava seu timer nos cabeçalhos. As demais rotas continuam usando o transporte original. O limite global da conexão permanece em 90 segundos.
- Respostas 401, 403, 429 e falhas de rede recebem diagnósticos específicos. Um limite de requisições no Gateway não provoca uma espera silenciosa longa. Logs distinguem API, WebSocket, HELLO e READY sem imprimir debug bruto, tokens ou conteúdo de respostas.
- Reproduzido e corrigido um erro adicional no descarte de respostas HTTP de erro: o stream real do Undici emitia `AbortError` sem tratamento ao ser destruído. O teste usa o transporte instalado com MockAgent, sem rede externa.
- Integrações cobrem migração SQL real em PGlite, banco preservado após falha, porta acessível enquanto o login Discord está pendente, indisponibilidade das operações antes da prontidão e fechamento da porta após falha.
- Consulta pública a `https://ijf.onrender.com/ready` em 28/09/2026: a primeira consulta respondeu `200 {"status":"ready"}`; uma nova consulta retornou a página do Render **Service Suspended**, informando suspensão pelo proprietário. A primeira resposta não confirma a versão do deploy. Será necessário reativar o serviço no Render para validar a nova publicação.

Validação local, com PostgreSQL embarcado e Discord simulado. Nenhum token real foi consultado, nenhuma mensagem foi enviada e nenhum deploy foi executado. A resposta pública atual de suspensão impede validar a conexão real da nova versão no Render.

---

## 28/09/2026 — cadastro e portal dos membros

- Suíte completa: `node --test --test-concurrency=2`, **217 testes aprovados, zero falhas**.
- Vinte e três testes novos de cadastro por IFJ, confirmação enviada somente ao Discord registrado, proteção de senhas/códigos/sessões, expiração, cinco tentativas, reenvio, duplicidades, Origin/CSRF e isolamento das contas de moderação.
- Nome vem do IFJ e acompanha atualizações. Exclusão ou troca do Discord revoga o acesso anterior; troca pela API permite novo cadastro do titular. A criação da conta não concede cargos ou permissões de equipe.
- Edge real com API simulada: cadastro com zeros iniciais, confirmação de senha, falha de envio, código incorreto, confirmação, login, logout, sessão existente, nome tratado como texto e recuperação após falha de consulta depois da confirmação.
- Desktop 1365 px e celular 390 px conferidos, sem erros JavaScript nem transbordamento horizontal. Boas-vindas mostra o nome oficial, a mensagem solicitada e Sair; nenhuma categoria da moderação.
- Prévia com dados fictícios: `../EXEMPLOS/portal-membro.png` e `../EXEMPLOS/cadastro-membro-mobile.png`.
- Sintaxe do novo módulo de autenticação, bot, API e JavaScript do portal aprovada. As novas tabelas estão incluídas no preflight e na migração transacional.

Validação local com PGlite e Discord simulado. Nenhum cadastro real, mensagem privada real ou deploy foi executado. Publique a pasta `projeto` completa para disponibilizar o portal e criar as novas tabelas automaticamente.

---

## 28/09/2026 — inicialização conjunta do banco e Discord

- Suíte completa: `node --test --test-concurrency=2`, **194 testes aprovados, zero falhas**.
- Nove testes do banco: criação do primeiro administrador com senha utilizável, rollback quando falta configuração inicial, atualização de esquema antigo preservando IFJ/credenciais/denúncia, repetição sem duplicar sincronizações, dados incompatíveis preservados, limites locais à transação, ordem do bloqueio de migração, descarte da conexão após rollback falhar e diagnóstico sem dados privados.
- Três testes de integração executam `boot`, migrações e verificações SQL reais em PGlite, usando o Client do Discord com login simulado. O caso de sucesso abre HTTP local e recebe `200 {"status":"ready"}`. Cancelamento de migração e erro de intents permanecem distintos e impedem abertura do servidor.
- Vinte testes da conexão Discord, incluindo relógio simulado com prontidão aos 40 segundos, além do antigo prazo de 35 segundos.
- Limites do banco: 60 segundos por instrução SQL durante a migração, 15 segundos para bloqueios e 75 segundos por chamada do cliente. `SET LOCAL` restaura os limites normais ao concluir ou desfazer a transação. Um bloqueio transacional serializa inicializadores desta versão.
- Falha de rollback não substitui a causa original. Registros informam etapa e SQLSTATE sem expor senhas, URLs privadas ou conteúdo dos cadastros.
- Botões, tribunal, Sub líder, tutorial, acesso da equipe e High member com Equipe continuam aprovados na suíte completa. Sintaxe de `db.js` e `preflight.js` conferida.

Limite da validação: PGlite é PostgreSQL embarcado, não a instância Supabase do usuário; transporte e permissões do Discord são simulados. A configuração real de rede, pooler, dados antigos e intents no serviço Render não foi acessada. O aviso genérico fornecido não revela qual SQLSTATE ocorreu em produção; esta versão corrige os defeitos encontrados no código e fornece a etapa/código se houver um problema externo ou dados incompatíveis no novo deploy.

---

## 27/09/2026 — timeout na conexão Discord

- Suíte completa executada: `node --test --test-concurrency=2`, **181 testes aprovados, zero falhas**.
- Dezenove testes da conexão: evento de prontidão, estado `isReady`, login ainda pendente, reconexão transitória, erros definitivos do Gateway, HTTP 401 com código de API zero, limites de requisições, timeout, limpeza de timers/listeners e ausência de segredos nos logs.
- Integração com `createBot.start` validada usando o Client real com transporte simulado; `BOT_ENABLED=false` continua dispensando o login.
- Bot e instalador compartilham a rotina de conexão. Espera Discord ajustada de 35 para 90 segundos e limite global de ambos para 180 segundos. Erros `shardError` de autenticação e intents agora produzem orientação específica imediatamente.
- Sintaxe de `discord-connection.js`, `bot.js`, `server.js` e `setup-server.js` conferida. README e tutorial atualizados com os novos prazos e instruções de publicação.

Validação local, com banco e transporte Discord simulados. O log fornecido comprova o timeout da versão anterior, mas não identifica sozinho sua causa externa. Não foi feito deploy nem acesso à instância Render; os novos registros de conexão permitem identificar a etapa caso a falha persista após publicar.

---

## 27/09/2026 — botões, Sub líder, tutorial e High member

- Suíte completa executada com processos isolados: `node --test --test-concurrency=2`, **162 testes aprovados, zero falhas**.
- Nove regressões dos botões: abertura imediata dos modais, confirmação/cancelamento na mensagem original, intervalos independentes por divisão/token, ticket preservado se a resposta expira, recuperação da mensagem e botão após rollback, ID de fechamento inválido, autorização de administrador Discord e fechamento sem duplicar jobs.
- Startup identifica um Interactions Endpoint URL que desvia cliques do Gateway. Logs registram chegada de interação, estado do bot e reconexões, sem token ou conteúdo enviado no formulário.
- Nove testes da patente Sub líder: acesso completo, IFJs de terceiros, gestão de equipe, `/warn`, tribunal, migração e tutorial persistente com autenticação e CSRF. Treze testes da interface para Meu Discord, navegação, tutorial por patente e acesso completo do Sub líder.
- High member recebe Equipe nas duas divisões; testadas remoção por rebaixamento/revogação e preservação de cargos não gerenciados.
- Edge headless real com API simulada: tutorial Sub líder no desktop, dez categorias administrativas, seletor de nova patente, tutorial concluído sem reaparecer no reload; tutorial e vínculo obrigatório de moderador/recrutador em tela de 390 px. Sem erros JavaScript ou transbordamento horizontal.
- Capturas com contas fictícias: `../EXEMPLOS/boas-vindas-sublider.png` e `../EXEMPLOS/boas-vindas-moderador-mobile.png`.

Não foi fornecido endereço ou acesso à instância Render. O timeout geral relatado não foi reproduzido no servidor publicado; os defeitos locais foram corrigidos e foram adicionadas verificações e registros para identificar se os cliques chegam ao bot. Nenhum deploy, clique em bot de produção ou mudança em contas Discord reais foi realizado.

---

## 27/09/2026 — tribunal, Meu Discord e embeds

- Suíte completa: `node --test --test-concurrency=2`, **135 testes aprovados, zero falhas**.
- Sintaxe dos módulos de tribunal, API, bot e painel aprovada.
- Tribunal: 16 testes do módulo e 7 de integração API/bot com PGlite e Discord simulado. Validados autenticação, patente, CSRF, vínculo confirmado, identidade original, migração repetida, criação única, permissões privadas, convites, erros e nova tentativa, recuperação após falha, encerramento e preservação do canal.
- Fechamento bloqueia mensagens, threads, gerenciamento de mensagens e webhooks dos participantes comuns. Administradores nativos do Discord mantêm suas permissões.
- Meu Discord: seis testes de regressão para estado confirmado, troca opcional, navegação, primeiro vínculo obrigatório e respostas atrasadas.
- Embeds: serialização, campos de até 1.024 caracteres, orçamento total de 6.000 caracteres, preservação do texto integral em anexo, identidade e atualização dos painéis existentes.
- Navegador Edge real em modo headless, com API simulada: fluxo de abrir/concluir tribunal; Discord confirmado; troca opcional; navegação por categorias; confirmação inicial do moderador. Desktop 1440 px e celular 390 px, sem erros JavaScript e sem transbordamento horizontal.
- Capturas locais em `../EXEMPLOS/tribunal-painel.png`, `../EXEMPLOS/tribunal-mobile.png` e `../EXEMPLOS/discord-confirmado.png`, com dados fictícios.

Não houve implantação nem envio para servidores Discord reais. A migração e a atualização dos painéis permanentes serão executadas ao iniciar esta versão no ambiente configurado.

---

Verificado em 20/09/2026.

- `npm test`: 25 testes aprovados, sem falhas.
- `npm run check`: sintaxe dos módulos de entrada, bot e painel aprovada.
- Processo real com configuração inválida: encerrou com código 1, sem anunciar servidor pronto e sem imprimir o segredo usado no teste.
- Testes de falha em sistema, conexão PostgreSQL, esquema, escrita/leitura, login Discord e permissões: nenhum abriu o listener HTTP; recursos criados foram encerrados.
- Sucesso: listener aberto somente após os testes, fila ativada por último.
- BOT_ENABLED=false: Discord explicitamente dispensado, apenas painel iniciado.
- PostgreSQL embarcado (PGlite): leitura/escrita com rollback deixou zero registros de teste.
- Checks Discord usam simulação: hierarquia e tipo incorreto de canal foram rejeitados sem publicar mensagens.
- Chromium: assistente percorreu 29 etapas, validou URL inválida, realizou 30 gravações por um handle de arquivo simulado, gerou download com conteúdo compatível com o parser .env do Node e importou os valores novamente.
- Assistente: falha de escrita e navegador sem seletor de arquivos tratados sem alegar salvamento. Layout móvel conferido sem transbordamento horizontal.
- O nome do download pode ser ajustado pelo navegador (ex.: env.txt); o aplicativo orienta renomear para .env. A gravação direta depende do seletor e da permissão do navegador real.

Os 10 testes anteriores de autenticação, permissões, IFJ, denúncias, filas e tickets continuam aprovados.

Não executado: conexão aos servidores Discord reais do usuário, implantação Render/Supabase ou diálogo nativo de gravação do sistema operacional. São necessários seus tokens, banco e IDs para essas verificações. O preflight real roda automaticamente quando você iniciar o projeto configurado.


Atualização Caçados/Guerras/carteiras: 84 testes automatizados aprovados. Navegador: upload real de arquivo local, prévia, criação de quatro jobs (dois caçados e duas guerras), viewport de 390 pixels sem overflow e sem erros JavaScript. PNGs dos dois tipos renderizados e inspecionados. Discord e banco de produção não acessados.
