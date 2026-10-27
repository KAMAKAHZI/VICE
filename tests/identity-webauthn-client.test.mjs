import test from "node:test";
import assert from "node:assert/strict";
import {registerPasskey,authenticatePasskey} from "../web/identity/webauthn-client.mjs";
test("registration fails closed when verifier disabled",async()=>{
 await assert.rejects(registerPasskey({}, {passkeyRegistration:false}),/WEBAUTHN_UNAVAILABLE|WEBAUTHN_VERIFIER_NOT_CONFIGURED/);
});
test("authentication fails closed when verifier disabled",async()=>{
 await assert.rejects(authenticatePasskey({}, {passkeyAuthentication:false}),/WEBAUTHN_UNAVAILABLE|WEBAUTHN_VERIFIER_NOT_CONFIGURED/);
});
test("transaction authorization cannot use ordinary login capability",async()=>{
 await assert.rejects(authenticatePasskey({}, {passkeyAuthentication:true,transactionAuthorization:false},{transaction:true}),/WEBAUTHN_UNAVAILABLE|WEBAUTHN_VERIFIER_NOT_CONFIGURED/);
});
