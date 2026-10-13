'use strict';
/** VICE LINK — hardened, read-only MT5 exporter and SMTP worker.
 * Bind to loopback behind HTTPS/WSS reverse proxy; never publish plaintext WS.
 * SOURCE INTEGRITY: no broker account is called independently verified by this service.
 */
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {WebSocketServer}=require('ws');
const {Mt5Bridge}=require('./mt5-bridge');
const {Mailer}=require('./mailer');
const config=JSON.parse(fs.readFileSync(path.join(__dirname,'config.json'),'utf8'));
const PORT=Number(process.env.VICE_LINK_PORT||config.port||9000);
const BIND=String(process.env.VICE_LINK_BIND||config.bind||'127.0.0.1');
const RATE=Math.min(100,Number(config.request_rate_per_second)||30);
const MAXMSG=Math.min(65536,Number(config.max_message_bytes)||65536);
const MAXMEM=(Number(config.max_memory_mb)||500)*1024*1024;
const TOKEN=process.env.VICE_LINK_TOKEN||'';
if(!TOKEN||TOKEN.length<32)throw Error('Set VICE_LINK_TOKEN to a random secret of at least 32 characters');
const pairing=process.env.VICE_LINK_PAIRING_CODE||String(crypto.randomInt(100000,1000000));
const pairDeadline=Date.now()+600000;
const metrics={connections:0,messages:0,authFailures:0,bridgeErrors:0,start:Date.now()};
const mt5=new Mt5Bridge(config),mailer=new Mailer(config);
function constantTimeMatch(a,b){
 const x=crypto.createHash('sha256').update(String(a||'')).digest();
 const y=crypto.createHash('sha256').update(String(b||'')).digest();
 return crypto.timingSafeEqual(x,y);
}
const wsServer=new WebSocketServer({noServer:true,maxPayload:MAXMSG,perMessageDeflate:false});
const conns=new Set();
const server=http.createServer((req,res)=>{
 const u=new URL(req.url||'/',`http://${BIND}:${PORT}`);
 const send=(status,body,contentType='application/json')=>{
   res.writeHead(status,{'Content-Type':contentType,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(body);
 };
 if(u.pathname==='/health'){
   const healthy=process.memoryUsage().rss<MAXMEM;
   return send(healthy?200:503,JSON.stringify({service:'vice-link',status:healthy?'RUNNING':'DEGRADED',mt5:mt5.state.online?'TERMINAL_EXPORT_CURRENT':'UNVERIFIED',email:mailer.enabled?'SMTP_CONFIGURED':'DISABLED',uptime_seconds:Math.floor((Date.now()-metrics.start)/1000)}));
 }
 if(u.pathname==='/metrics'){
   // Network firewall + loopback protection required; no bearer token exposed here.
   if(req.socket.remoteAddress!=='127.0.0.1'&&req.socket.remoteAddress!=='::1'&&req.socket.remoteAddress!=='::ffff:127.0.0.1')return send(403,'forbidden','text/plain');
   const body=[`vice_link_active_connections ${conns.size}`,`vice_link_messages_total ${metrics.messages}`,
    `vice_link_failed_auth_total ${metrics.authFailures}`,`vice_link_errors_total ${metrics.bridgeErrors}`,
    `vice_link_rss_bytes ${process.memoryUsage().rss}`].join('\n')+'\n';
   return send(200,body,'text/plain; version=0.0.4');
 }
 send(404,JSON.stringify({error:'NOT_FOUND'}));
});
server.on('upgrade',(req,socket,head)=>{
 if(req.url!=='/ws'&&req.url!=='/')return socket.destroy();
 // Enforce TLS at the reverse proxy and use WSS for remote access.
 if(process.memoryUsage().rss>=MAXMEM)return socket.destroy();
 wsServer.handleUpgrade(req,socket,head,ws=>wsServer.emit('connection',ws,req));
});
const send=(ws,obj)=>{if(ws.readyState===1)ws.send(JSON.stringify(obj));};
function reply(ws,m,payload){send(ws,{...payload,id:m.id});}
wsServer.on('connection',(ws,req)=>{
 metrics.connections++;conns.add(ws);
 ws.authenticated=false;ws.msgCount=0;ws.windowAt=Date.now();ws.isAlive=true;ws.pairFails=0;
 ws.on('pong',()=>ws.isAlive=true);
 ws.on('close',()=>conns.delete(ws));
 ws.on('message',async raw=>{
   metrics.messages++;
   try{
     if(Date.now()-ws.windowAt>=1000){ws.windowAt=Date.now();ws.msgCount=0;}
     if(++ws.msgCount>RATE)throw Error('Request rate exceeded');
     if(raw.length>MAXMSG)throw Error('Frame too large');
     let m;try{m=JSON.parse(raw.toString('utf8'));}catch(_){throw Error('Invalid JSON');}
     if(!m||typeof m!=='object'||typeof m.t!=='string')throw Error('Invalid command');
     if(!ws.authenticated){
       if(m.t==='auth'){
         if(!constantTimeMatch(m.token,TOKEN)){metrics.authFailures++;send(ws,{t:'error',re:'auth',msg:'Invalid bridge token'});return;}
         ws.authenticated=true;send(ws,{t:'authed',admin:true,device:'VICE LINK · LOCAL READ-ONLY'});return;
       }
       if(m.t==='pair'){
         if(Date.now()>pairDeadline||!constantTimeMatch(m.code,pairing)){
           metrics.authFailures++;if(++ws.pairFails>=5)ws.close(1008,'Pairing blocked');
           else send(ws,{t:'error',re:'auth',msg:'Invalid or expired pairing code'});return;
         }
         ws.authenticated=true;send(ws,{t:'paired',admin:true,token:TOKEN,device:'VICE LINK · LOCAL READ-ONLY'});return;
       }
       send(ws,{t:'error',re:'auth',msg:'Authentication required'});return;
     }
     switch(m.t){
       case 'sources':send(ws,{t:'sources',list:mt5.sources()});return;
       case 'symbols':{
         const source=mt5.sources().find(s=>s.id===m.src);
         send(ws,{t:'symbols',src:m.src,list:source?.symbols||[]});return;
       }
       case 'history':{
         const bars=mt5.bars(String(m.src||''),String(m.s||''),String(m.tf||''),m.n);
         reply(ws,m,{t:'history',src:m.src,s:m.s,tf:m.tf,digits:5,bars});return;
       }
       case 'portfolio':send(ws,mt5.portfolio());return;
       case 'mt5-verify':reply(ws,m,{t:'mt5-verify',...mt5.verify(m.account?.server,m.account?.login)});return;
       case 'audit':send(ws,{t:'audit',status:'READ_ONLY',realBrokerVerification:false,
         terminalAt:mt5.state.lastUpdated,warning:mt5.state.error||''});return;
       case 'admin':send(ws,{t:'admin',status:'RUNNING',sources:mt5.sources().length,
         email:mailer.enabled?'SMTP_CONFIGURED':'DISABLED'});return;
       case 'sub':case 'unsub':send(ws,{t:'subscription',src:m.src,s:m.s,tf:m.tf,status:'MANUAL_SNAPSHOT'});return;
       case 'ping':send(ws,{t:'pong',at:new Date().toISOString()});return;
       default:throw Error('Command not allowed on read-only bridge');
     }
   }catch(e){metrics.bridgeErrors++;send(ws,{t:'error',id:(()=>{try{return JSON.parse(raw.toString('utf8')).id;}catch(_){return null;}})(),msg:String(e.message).slice(0,120)});}
 });
});
const heartbeat=setInterval(()=>{
 for(const c of conns){if(!c.isAlive){c.terminate();continue;}c.isAlive=false;c.ping();}
},30000);heartbeat.unref();
const refreshTimer=setInterval(()=>mt5.refresh().catch(()=>{metrics.bridgeErrors++;}),Math.max(1000,Number(config.tick_poll_ms)||1000));
const mailTimer=setInterval(()=>mailer.run().catch(()=>{metrics.bridgeErrors++;}),Math.max(5000,Number(config.email_poll_ms)||5000));
mt5.refresh().catch(()=>{});mailer.run().catch(()=>{});
server.listen(PORT,BIND,()=>{
 process.stdout.write(JSON.stringify({event:'vice_link_started',bind:BIND,port:PORT,
  pairing_code:pairing,pairing_expires_in_seconds:600,mt5_status:'UNVERIFIED_UNTIL_TERMINAL_EXPORT'})+'\n');
});
function shutdown(){clearInterval(heartbeat);clearInterval(refreshTimer);clearInterval(mailTimer);
 for(const c of conns)c.close(1001,'Server stopping');wsServer.close();server.close(()=>process.exit(0));
 setTimeout(()=>process.exit(1),10000).unref();}
process.once('SIGTERM',shutdown);process.once('SIGINT',shutdown);
