const test=require('node:test');
const assert=require('node:assert/strict');
const {validateCandles,mergeCandles}=require('../vice-market-data-integrity.js');
const bar=(t,c)=>({t,o:c,h:c+1,l:c-1,c,v:1});
test('rejects invalid OHLC instead of drawing false prices',()=>assert.throws(()=>validateCandles([{...bar(1000,10),h:8}],60000,10000)));
test('detects stale prices',()=>assert.equal(validateCandles([bar(1000,10)],60000,500000).stale,true));
test('accepts fresh candles',()=>assert.equal(validateCandles([bar(480000,10)],60000,500000).stale,false));
test('merges updates by timestamp',()=>assert.deepEqual(mergeCandles([bar(1000,10)],[bar(1000,12),bar(2000,13)]).map(b=>b.c),[12,13]));
