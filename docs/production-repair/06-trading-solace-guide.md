# VICE4X / Trading and SOLACE

Revision 2026-10-18 · Browser adaptation of supplied VICESYSTEM SOLACE v10.6

Open Markets → System settings. Auto uses 1,000 bars; Scalp 250, Intraday 500 and Swing 2,000 by default. Mode lookbacks, Tighten/Hold, wick-proof/any-wick handling, accepted-break closes and ATR thresholds, retests, oscillator mode and smoothing, internal arming, necklines, stops and minimum reward/risk are configurable and saved on the device.

The supplied v10.6 defaults supersede the older v5 zigzag calculation. Wick-proof structure waits for two consecutive closes beyond a level or a decisive 0.5 ATR close. Internal arming follows the selected zone exit/retest/touch rule and disarms across a close through its level. The inside plan enters at the internal pivot and targets the opposite macro pole. Insufficient reward/risk plans are hidden when that setting is enabled.

Signals and levels use closed standard OHLC bars. Forming bars are displayed but do not move committed indicator state. Historical panning selects the snapshot available at that point. Lines begin at their recorded availability and extend right; fractals remain attached to their originating candle. This deliberately prevents a newly accepted level being projected into the earlier available history. That causal drawing choice can differ from Pine's back-anchored current-level line.

Use identical provider, symbol, timeframe, settings and history when comparing charts. The 12 deterministic browser-engine checks pass; an independent TradingView numerical comparison and MetaEditor native compilation have not been performed. A perfectly identical platform result is not certified. The additional historical v5 engine remains in source for existing lab contracts; Markets uses the new v10.6 adaptation. Native source files can be downloaded only by the authenticated KAHZI account from the private source vault.

KAHZI can enable Personal Analysis in VICEBOT. This persists a server-authorized preference and opens the personal analysis workflow. It does not submit broker orders. Live automation requires installing/testing the supplied EA in MT5, the intended broker account, operator-approved risk parameters and execution authorization. The web MetaApi connector remains read-only.

Drag the chart body to pan time and price, the right axis to scale price, and the bottom axis to scale time. Mouse-wheel and touch pinch zoom are supported. Reset view restores automatic scaling. Provider outages display unavailable data; practice candles are explicitly simulated. Market prices, analytical plans and historical performance do not guarantee execution or results.
