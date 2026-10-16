# VICE OS / Trading and SOLACE Guide

Internal engineering • 2026-10-16 UTC • 1.3.8.0-IRU-CERTIFICATES

Choose the instrument and timeframe before loading provider data. Yahoo proxy validates timestamp and OHLC relationships. Failed live requests clear the chart and show UNAVAILABLE; they never generate replacement candles. Imported and explicitly selected practice datasets remain separate sources. A production EURUSD hourly Yahoo request returned 526 candles at 2026-10-15T19:03:33Z; this proves that request only, not every instrument or current feed availability.

Drag within the chart to pan horizontally and vertically. Drag the right price axis vertically to change the price span, or the bottom time axis horizontally to change the visible candle count. The mouse wheel zooms around the cursor; Shift+wheel scales prices; horizontal trackpad scrolling pans time. Two-finger pinch changes time and price scales. Pointer capture keeps a drag inside the chart until release. The candle-count preference persists; an instrument/timeframe change resets the manual price range.

Focus the chart for keyboard controls: left/right arrows pan time, up/down arrows pan prices, plus/minus zoom, and zero resets. Reset view restores automatic price scaling and latest candles. Double-click restores automatic price scaling.

SOLACE retains its existing macro F0/F100, confirmed pivot, structural invalidation, internal range and trade geometry implementation. Confirmed five-right-candle fractals now retain both pivot and confirmation indices across the full loaded history. Visible markers use the current viewport coordinates; the previous last-200-pivot rendering limit is removed. White high dots and blue low dots appear only after confirmation. Prefix-invariance and known-swing tests check that later candles do not change already confirmed fractals. These tests do not certify the complete signal methodology, profitability or nine-position execution.

The requested K=1000/D=9 configurable slowing, complete MTF entry qualification and execution/backtesting assumptions still need dedicated acceptance coverage. Broker connection, live equity and order execution remain separately gated. No trades were placed or broker passwords obtained during repair.

Reference performance is not guaranteed. Validate spread, commission, slippage and risk controls in an authorized broker test environment before enabling automation.
