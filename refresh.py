"""
War Room data refresh script.

Re-pulls live prices for XAU/USD, BTC/USD, S&P 500, DXY, recomputes returns/volatility/
correlations/drawdowns, and writes the result to /home/user/workspace/warroom/site/market_data.json.

Designed to be invoked by the daily cron. The cron task itself calls finance_quotes and
finance_ohlcv_histories, downloads the CSVs, then runs this script.

Inputs expected in /home/user/workspace/warroom/finance_data/:
  xauusd.csv, btcusd.csv, gspc.csv, dxy.csv  (each: date,close)

Output: /home/user/workspace/warroom/site/market_data.json
"""
import pandas as pd
import numpy as np
import json
from pathlib import Path

DATA = Path("/home/user/workspace/warroom/finance_data")
OUT  = Path("/home/user/workspace/warroom/site/market_data.json")

def load(name, col="close"):
    df = pd.read_csv(DATA / f"{name}.csv")
    dcol = [c for c in df.columns if c.lower() in ("date", "datetime", "timestamp")][0]
    df[dcol] = pd.to_datetime(df[dcol])
    df = df.sort_values(dcol).reset_index(drop=True).rename(columns={dcol: "date"})
    return df[["date", col]].rename(columns={col: name})


def vol(series, days):
    s = series.iloc[-days:].pct_change().dropna()
    return float(s.std() * np.sqrt(252) * 100)


def maxdd(series):
    roll_max = series.cummax()
    dd = (series - roll_max) / roll_max
    return float(dd.min() * 100)


def main():
    xau = load("xauusd"); btc = load("btcusd")
    spx = load("gspc");   dxy = load("dxy")
    df = (
        xau.merge(btc, on="date", how="outer")
           .merge(spx, on="date", how="outer")
           .merge(dxy, on="date", how="outer")
           .sort_values("date")
           .set_index("date").ffill().reset_index().dropna()
    )

    latest = df.iloc[-1]

    # Returns
    windows = {"1m":30, "3m":90, "ytd":None, "1y":365, "5y":365*5, "10y":365*10}
    returns = {}
    for label, days in windows.items():
        if label == "ytd":
            start = df[df["date"].dt.year == latest["date"].year].iloc[0]
        else:
            target = latest["date"] - pd.Timedelta(days=days)
            start = df[df["date"] >= target].iloc[0]
        returns[label] = {sym: float((latest[sym]-start[sym])/start[sym]*100) for sym in ("xauusd","btcusd","gspc")}
        returns[label]["start_date"] = str(start["date"].date())

    vols = {}
    for w_label, w_days in [("30d",30), ("90d",90), ("1y",252)]:
        vols[w_label] = {sym: vol(df[sym], w_days) for sym in ("xauusd","btcusd","gspc")}

    recent = df.iloc[-252:]
    ret = recent[["xauusd","btcusd","gspc","dxy"]].pct_change().dropna()
    corr = ret.corr().round(3).to_dict()

    dd5y = df.iloc[-252*5:]
    mdd = {sym: maxdd(dd5y[sym]) for sym in ("xauusd","btcusd","gspc")}

    peaks = {
        "xauusd": {"value": float(df["xauusd"].max()), "date": str(df.loc[df["xauusd"].idxmax(), "date"].date())},
        "btcusd": {"value": float(df["btcusd"].max()), "date": str(df.loc[df["btcusd"].idxmax(), "date"].date())},
    }
    dist = {sym: float((latest[sym]-peaks[sym]["value"])/peaks[sym]["value"]*100) for sym in ("xauusd","btcusd")}

    weekly = df.set_index("date").resample("W-FRI").last().dropna().reset_index()
    series = {
        "date": [d.strftime("%Y-%m-%d") for d in weekly["date"]],
        "xauusd": weekly["xauusd"].round(2).tolist(),
        "btcusd": weekly["btcusd"].round(2).tolist(),
        "gspc":   weekly["gspc"].round(2).tolist(),
        "dxy":    weekly["dxy"].round(2).tolist(),
    }

    # Default 'latest' values come from the last OHLCV close.
    latest_values = {sym: float(latest[sym]) for sym in ("xauusd","btcusd","gspc","dxy")}
    as_of_str = str(latest["date"].date())
    quote_timestamp = None

    # Optional intraday override: if the cron writes /finance_data/latest_quotes.json with
    # real-time quotes from finance_quotes, use those for 'latest' and set as_of to TODAY.
    # Format: {"as_of": "YYYY-MM-DD", "timestamp": "<ISO>", "xauusd": <float>, "btcusd": <float>, ...}
    overrides_path = DATA / "latest_quotes.json"
    if overrides_path.exists():
        try:
            o = json.loads(overrides_path.read_text())
            for sym in ("xauusd","btcusd","gspc","dxy"):
                if sym in o and o[sym] is not None:
                    latest_values[sym] = float(o[sym])
            if "as_of" in o:
                as_of_str = o["as_of"]
            quote_timestamp = o.get("timestamp")
            print(f"[override] applied latest_quotes.json (as_of={as_of_str}, ts={quote_timestamp})")
        except Exception as e:
            print(f"[warn] could not apply latest_quotes.json: {e}")

    out = {
        "as_of": as_of_str,
        "quote_timestamp": quote_timestamp,
        "latest": latest_values,
        "returns": returns,
        "volatility": vols,
        "correlations_1y": corr,
        "max_drawdown_5y": mdd,
        "all_time_high": peaks,
        "from_ath": dist,
        "series_weekly": series,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, indent=2))
    print(f"Wrote {OUT}")
    print(f"as_of: {out['as_of']}  XAU ${out['latest']['xauusd']:.2f}  BTC ${out['latest']['btcusd']:.2f}")
    return out


if __name__ == "__main__":
    main()
