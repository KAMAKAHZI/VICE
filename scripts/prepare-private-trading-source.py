#!/usr/bin/env python3
"""Prepare founder-supplied sources for private Supabase deployment, not public assets."""
import argparse,base64,hashlib,json
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--source-dir',type=Path,required=True);p.add_argument('--output',type=Path,required=True);args=p.parse_args()
files=[('VICEBOT_SOLACE_V27_60_FINAL.mq5','VICEBOT_SOLACE_V27_60_FINAL.mq5','MT5 Expert Advisor · v27.60'),('VICEBOT_SOLACE_Basket.mq5','VICEBOT_SOLACE_Basket.mq5','MT5 basket engine · v1.00'),('ViceBasketEngine.mqh','ViceBasketEngine.mqh','MT5 basket include'),('System .txt','VICESYSTEM_SOLACE_v10_6.pine','TradingView Pine v6 · v10.6')]
rows=[]
for source,name,description in files:
 data=(args.source_dir/source).read_bytes();rows.append(dict(name=name,description=description,size=len(data),sha256=hashlib.sha256(data).hexdigest(),base64=base64.b64encode(data).decode()))
args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text('export const release = '+json.dumps(rows)+';\n')
manifest=[{k:v for k,v in row.items() if k!='base64'} for row in rows]
print(json.dumps(manifest,indent=2))
