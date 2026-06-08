# Gold vs Bitcoin War Room

Live dashboard at [gold-vs-bitcoin-war-room.pages.dev](https://gold-vs-bitcoin-war-room.pages.dev)

Static site comparing Gold and Bitcoin as stores of value — live prices,
supply doctrine, sovereign holdings, household allocations, debasement context,
and a time-machine calculator.

## Auto-refresh

Market data is refreshed via a scheduled task at 9 AM ET weekdays. The
`market_data.json` file is committed automatically — Cloudflare Pages
redeploys from the latest commit on `main`.

## Files

- `index.html` — site shell, all panels
- `app.js` — interactive logic, charts, snapshot cards
- `market_data.json` — live prices, returns, volatility, correlations
- `context_data.json` — central banks, households, supply, scoreboard, debasement

## Sources

- Perplexity Finance (prices)
- World Gold Council, FRED, BLS, Treasury (macro)
- Bitbo / CoinGlass (BTC ETF AUM)
