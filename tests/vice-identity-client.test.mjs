import test from "node:test";
import assert from "node:assert/strict";
import {ViceIdentityClient} from "../web/identity/vice-identity-client.mjs";
function mock(capabilities={passkeyRegistration:false,passkeyAuthentication:false,transactionAuthorization:false}){
 const calls=[];
 const sb={auth:{getSession:async()=>({data:{session:{access_token:"test-token"}}})},
 functions:{invoke:async(name,{body,headers})=>{calls.push({name,body,headers});return {data:capabilities};}}};
 return {client:new ViceIdentityClient(sb),calls};
}
test("enrollment fails closed when server not ready",async()=>{
 const {client,calls}=mock();
 await assert.rejects(client.enroll("iPhone"),/WEBAUTHN_VERIFIER_NOT_CONFIGURED/);
 assert.equal(calls.length,1);assert.equal(calls[0].body.operation,"capabilities");
});
test("proposal approval fails closed without transaction authorization capability",async()=>{
 const {client,calls}=mock({passkeyRegistration:true,passkeyAuthentication:true,transactionAuthorization:false});
 await assert.rejects(client.authorizeProposal({proposalId:"P-1",payloadHash:"abc",role:"CFO"}),/WEBAUTHN_VERIFIER_NOT_CONFIGURED/);
 assert.equal(calls.length,1);
});
test("invalid role rejected before network",async()=>{
 const {client,calls}=mock();
 await assert.rejects(client.authorizeProposal({proposalId:"P-1",payloadHash:"abc",role:"ADMIN"}),/Invalid authorization parameters/);
 assert.equal(calls.length,0);
});
test("missing session denies capability request",async()=>{
 const sb={auth:{getSession:async()=>({data:{session:null}})},functions:{invoke:async()=>{throw new Error("must not invoke");}}};
 await assert.rejects(new ViceIdentityClient(sb).capabilities(),/AUTH_REQUIRED/);
});
