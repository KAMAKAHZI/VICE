'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const slice=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
function run(src,globals){const c=vm.createContext({console,Date,...globals});vm.runInContext(src,c);return c;}
test('Call row authenticates identity from database columns, not payload claims',()=>{
 let received;const c=run(slice('  function receiveCallRow(', '  async function handleCallSignal('),{S:{user:{id:'recipient'}},handleCallSignal:async p=>{received=p},toast(){}});
 c.receiveCallRow({sender_id:'actual',peer_id:'recipient',created_at:new Date().toISOString(),text:'VICE_CALL_V1:'+JSON.stringify({kind:'offer',callId:'123',from:'forged',to:'other'})});
 assert.equal(received.from,'actual');assert.equal(received.to,'recipient');
});
test('Call row rejects expired signals and another recipient',()=>{
 let calls=0;const c=run(slice('  function receiveCallRow(', '  async function handleCallSignal('),{S:{user:{id:'recipient'}},handleCallSignal:async()=>{calls++},toast(){}});
 const row={sender_id:'sender',peer_id:'recipient',created_at:'2000-01-01',text:'VICE_CALL_V1:'+JSON.stringify({kind:'offer',callId:'123'})};c.receiveCallRow(row);c.receiveCallRow({...row,peer_id:'other',created_at:new Date().toISOString()});assert.equal(calls,0);
});
test('Call signaling persists privately and reports database failure',async()=>{
 let record,cleared=false;const c=run(slice('  function signal(', '  function receiveCallRow('),{S:{user:{id:'me'},profile:{name:'Me'}},uuid:()=> 'message-id',currentCall:{id:'call'},persist:async(table,row)=>{record={table,row};throw Error('denied')},toast(){},cleanup(){cleared=true},paintCallOverlay(){}});
 assert.equal(await c.signal({kind:'offer',to:'peer',callId:'call'}),false);assert.equal(record.table,'dm_messages');assert.equal(record.row.peer_id,'peer');assert.equal(cleared,true);
});
function videoContext(acquire){
 const track={stop(){this.stopped=true},kind:'video'},stream={getTracks:()=>[track],getVideoTracks:()=>[track]};
 const sender={last:null,async replaceTrack(t){this.last=t}};
 const pc={connectionState:'connected',getTransceivers:()=>[{receiver:{track:{kind:'video'}},sender}]};
 const call={id:'call'};
 const c=run(slice('  let mediaBusy=false;', '  function signal('),{pc,currentCall:call,navigator:{mediaDevices:{getUserMedia:acquire||(async()=>stream),getDisplayMedia:async()=>stream}},paintCallOverlay(){}});
 return {c,track,stream,sender,call};
}
test('Camera starts, then stops tracks and clears sender',async()=>{
 const {c,track,sender,call}=videoContext();await c.toggleVideoSource('camera');assert.equal(sender.last,track);assert.equal(call.videoKind,'camera');await c.toggleVideoSource('camera');assert.equal(sender.last,null);assert.equal(track.stopped,true);assert.equal(call.videoStream,null);
});
test('Screen sharing uses display-media track and handles browser stop',async()=>{
 const {c,track,sender,call}=videoContext();await c.toggleVideoSource('screen');assert.equal(call.videoKind,'screen');track.onended();assert.equal(sender.last,null);assert.equal(call.videoKind,null);
});
test('Permission response after call cancellation stops acquired media',async()=>{
 let finish;const {c,track,stream,sender}=videoContext(()=>new Promise(r=>finish=r));const p=c.toggleVideoSource('camera');c.currentCall=null;finish(stream);await p;assert.equal(track.stopped,true);assert.equal(sender.last,null);
});
test('Media permission denial leaves existing call unchanged',async()=>{
 const {c,call}=videoContext(async()=>{throw Error('Permission denied')});await assert.rejects(c.toggleVideoSource('camera'),/Permission denied/);assert.equal(call.videoStream,undefined);
});
