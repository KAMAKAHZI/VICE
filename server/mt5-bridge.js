'use strict';
/** Read-only exporter reader. Must be supplied by the operator's ACTUAL MT5 terminal.
 * Without validated terminal snapshots it returns UNVERIFIED, NEVER mock live balances.
 * This adapter never accepts trading commands or broker credentials.
 */
const fs=require('node:fs/promises');
const path=require('node:path');
class Mt5Bridge {
  constructor(config){
    this.file=path.resolve(__dirname,config.mt5_snapshot_path||'./data/mt5-readonly-snapshot.json');
    this.maxBars=Math.min(Number(config.max_history_bars)||100000,100000);
    this.state={online:false,lastUpdated:null,error:'No terminal export has been validated',accounts:[],sources:[],series:{}};
  }
  async refresh(){
    try{
      const st=await fs.stat(this.file);
      if(st.size>24*1024*1024)throw Error('Terminal export exceeds 24 MB');
      const data=JSON.parse(await fs.readFile(this.file,'utf8'));
      if(!Array.isArray(data.accounts)||!Array.isArray(data.sources)||!data.series||typeof data.series!=='object')throw Error('Invalid terminal export schema');
      const at=new Date(data.terminal_generated_at||'');
      if(!Number.isFinite(+at)||Date.now()-at.getTime()>120000||at.getTime()>Date.now()+30000)throw Error('Terminal export stale or future-dated');
      for(const account of data.accounts){
        if(!account.server||!account.login||!['LIVE','DEMO'].includes(account.mode))throw Error('Invalid account identity');
        for(const key of ['equity','balance','margin'])if(account[key]!=null&&!Number.isFinite(Number(account[key])))throw Error('Non-finite broker balance');
      }
      const normalized={};
      for(const [key,arr] of Object.entries(data.series)){
        if(!/^[\w.\-]+\|[\w.\-/]+\|[\w.]+$/.test(key)||!Array.isArray(arr)||arr.length>this.maxBars)throw Error('Invalid bar series: '+key);
        let prev=0;
        normalized[key]=arr.map((b,i)=>{
          if(!Array.isArray(b)||b.length<5||!b.slice(0,5).every(Number.isFinite))throw Error('Invalid OHLC at '+i);
          if(b[0]<=prev||b[2]<Math.max(b[1],b[4])||b[3]>Math.min(b[1],b[4]))throw Error('Malformed OHLC at '+i);
          prev=b[0];return b.slice(0,5);
        });
      }
      this.state={online:true,lastUpdated:at.toISOString(),error:null,
        accounts:data.accounts.map(a=>({...a,realEquityVerified:false,source:'LOCAL_TERMINAL_EXPORT_NOT_INDEPENDENTLY_VERIFIED'})),
        sources:data.sources,series:normalized};
    }catch(e){
      this.state={online:false,lastUpdated:null,error:e.message,accounts:[],sources:[],series:{}};
    }
    return this.state;
  }
  sources(){return this.state.online?this.state.sources.map(s=>({...s,online:true})):[];}
  bars(src,sym,tf,n=3000){
    if(!this.state.online)throw Error('No current MT5 terminal export');
    const key=[src,sym,tf].join('|');
    const rows=this.state.series[key];if(!rows)throw Error('Symbol/timeframe is not present in terminal export');
    return rows.slice(-Math.min(this.maxBars,Math.max(1,Math.floor(Number(n)||3000))));
  }
  portfolio(){
    return {t:'portfolio',at:this.state.lastUpdated,verified:false,
      accounts:this.state.online?this.state.accounts:[],warning:'Read-only terminal export; not independent broker verification'};
  }
  verify(server,login){
    const a=this.state.accounts.find(a=>String(a.server)===String(server)&&String(a.login)===String(login));
    if(!a||!this.state.online)return {ok:false,msg:'Not found in a current terminal export'};
    return {ok:true,equity:a.equity,balance:a.balance,currency:a.currency,
      source:'LOCAL_TERMINAL_EXPORT',realEquityVerified:false};
  }
}
module.exports={Mt5Bridge};
