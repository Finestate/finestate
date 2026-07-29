// Investing "Tools" – calculators mirrored exactly from the HEIE Planning FP tab.
// Percentages are entered as whole numbers (e.g. 12 = 12%); compute divides by 100.

// --- formatting helpers ---
const m0 = (n) =>
  Number.isFinite(n) ? "USD " + Math.round(n).toLocaleString("en-US") : "–";
const m2 = (n) =>
  Number.isFinite(n)
    ? "USD " +
      n.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "–";
const pRatio = (n) => (Number.isFinite(n) ? (n * 100).toFixed(2) + "%" : "–"); // decimal ratio -> %
const x2 = (n) => (Number.isFinite(n) ? n.toFixed(2) : "–");
const xX = (n) => (Number.isFinite(n) ? n.toFixed(2) + "x" : "–");

// --- date helpers ---
const daysBetween = (a, b) =>
  Math.round((new Date(b) - new Date(a)) / 86400000);
const addDays = (iso, d) => {
  const dt = new Date(iso);
  dt.setDate(dt.getDate() + d);
  return dt;
};
const fmtDate = (dt) =>
  dt instanceof Date && !isNaN(dt)
    ? dt.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "–";

// Excel FV(rate, nper, pmt, pv): returns future value (pmt & pv as positive amounts)
const excelFV = (rate, nper, pmt, pv) =>
  rate === 0
    ? pv + pmt * nper
    : pv * Math.pow(1 + rate, nper) +
      (pmt * (Math.pow(1 + rate, nper) - 1)) / rate;

// Calculation details (shown behind the ℹ️ icon on each ratio).
export const RATIO_FORMULAS = {
  "gross-margin": "(Revenue − COGS) ÷ Revenue",
  "operating-margin": "Operating income (EBIT) ÷ Revenue",
  "net-profit-margin": "Net profit ÷ Revenue",
  roe: "Net income ÷ Shareholders' equity",
  roa: "Net income ÷ Total assets",
  roic: "NOPAT ÷ Invested capital",
  "current-ratio": "Current assets ÷ Current liabilities",
  "quick-ratio": "(Current assets − Inventory − Prepaid) ÷ Current liabilities",
  de: "Total debt ÷ Shareholders' equity",
  icr: "EBIT ÷ Interest expense",
  "debt-ebitda": "Total debt ÷ EBITDA",
  "asset-turnover": "Net sales ÷ Average total assets  ·  avg = (beginning + ending) ÷ 2",
  "inventory-turnover": "COGS ÷ Average inventory  ·  avg = (beginning + ending) ÷ 2",
  "receivables-turnover": "Net credit sales ÷ Average receivables  ·  avg = (beginning + ending) ÷ 2",
  eps: "(Net income − Preferred dividends) ÷ Weighted-avg shares",
  pe: "Price ÷ EPS  ·  EPS = (Net income − Preferred div) ÷ Shares",
  peg: "P/E ÷ (EPS growth %)  ·  growth = (Expected EPS − EPS) ÷ EPS",
  pb: "Price ÷ Book value/share  ·  BVPS = (Assets − Liabilities) ÷ Shares",
  ps: "Market cap ÷ Total revenue",
  "div-yield": "Dividend/share ÷ Price  ·  DPS = Total dividends ÷ Shares",
  "fcf-yield": "(Operating CF − Capex) ÷ Market cap",
  "ev-ebitda": "EV ÷ EBITDA  ·  EV = Market cap + Total debt − Cash  ·  EBITDA = Net income + Interest + Taxes + Depreciation + Amortisation",
};

export const CALC_GROUPS = [
  {
    group: "Custom Calculations",
    calcs: [
      {
        id: "fv-annual",
        title: "Future Value – annual additions & annual compounding",
        fields: [
          { key: "PresentValue", label: "Present Value", type: "money" },
          { key: "Payment", label: "Payment", type: "money" },
          { key: "Years", label: "Years", type: "num" },
          { key: "Return", label: "Return", type: "pct" },
        ],
        defaults: { PresentValue: 900000, Payment: 0, Years: 4, Return: 12 },
        compute: (v) => {
          const r = v.Return / 100;
          const ti = v.PresentValue + v.Payment * v.Years;
          const fv = excelFV(r, v.Years, v.Payment, v.PresentValue);
          return [
            { label: "Total Investment", value: m0(ti) },
            { label: "Future Value", value: m0(fv) },
          ];
        },
      },
      {
        id: "fv-quarterly",
        title: "Future Value – quarterly additions & quarterly compounding",
        fields: [
          { key: "PresentValue", label: "Present Value", type: "money" },
          { key: "Payment", label: "Payment (per quarter)", type: "money" },
          { key: "Years", label: "Years", type: "num" },
          { key: "Return", label: "Return", type: "pct" },
        ],
        defaults: { PresentValue: 150000, Payment: 0, Years: 30, Return: 13 },
        compute: (v) => {
          const r = v.Return / 100 / 4;
          const n = v.Years * 4;
          const ti = v.PresentValue + v.Payment * n;
          const fv = excelFV(r, n, v.Payment, v.PresentValue);
          return [
            { label: "Total Investment", value: m0(ti) },
            { label: "Future Value", value: m0(fv) },
          ];
        },
      },
      {
        id: "cagr",
        title: "CAGR (Compound Annual Growth Rate)",
        fields: [
          { key: "Beginning", label: "Beginning Value", type: "money" },
          { key: "Ending", label: "Ending Value", type: "money" },
          { key: "Years", label: "Number of Years", type: "num" },
        ],
        defaults: { Beginning: 647500, Ending: 4500000, Years: 10 },
        compute: (v) => [
          {
            label: "CAGR",
            value: pRatio(Math.pow(v.Ending / v.Beginning, 1 / v.Years) - 1),
          },
        ],
      },
      {
        id: "cagr-period",
        title: "CAGR from % change over an exact time period",
        fields: [
          { key: "StartDate", label: "Start Date", type: "date" },
          { key: "EndDate", label: "End Date", type: "date" },
          { key: "PercentageChange", label: "Percentage Change", type: "pct" },
        ],
        defaults: {
          StartDate: "2026-01-01",
          EndDate: "2026-12-31",
          PercentageChange: 250,
        },
        compute: (v) => {
          const d = daysBetween(v.StartDate, v.EndDate);
          const cagr = Math.pow(1 + v.PercentageChange / 100, 365 / d) - 1;
          return [{ label: "CAGR", value: pRatio(cagr) }];
        },
      },
      {
        id: "pct-change",
        title: "Percentage Change (holding period return)",
        fields: [
          { key: "Starting", label: "Starting Value", type: "money" },
          { key: "NewValue", label: "New Value", type: "money" },
        ],
        defaults: { Starting: 82.04, NewValue: 110 },
        compute: (v) => [
          {
            label: "Holding Period Return",
            value: pRatio((v.NewValue - v.Starting) / v.Starting),
          },
        ],
      },
      {
        id: "pct-change-value",
        title: "Percentage Change – value change",
        fields: [
          { key: "Starting", label: "Starting Value", type: "money" },
          { key: "PercentageChange", label: "Percentage Change", type: "pct" },
        ],
        defaults: { Starting: 80, PercentageChange: 35 },
        compute: (v) => [
          {
            label: "Value Change",
            value: m2(v.Starting * (1 + v.PercentageChange / 100)),
          },
        ],
      },
      {
        id: "rule-72",
        title: "Rule of 72 (time to double)",
        fields: [
          { key: "Figure", label: "Figure", type: "num" },
          { key: "RateOfReturn", label: "Rate of Return", type: "pct" },
        ],
        defaults: { Figure: 72, RateOfReturn: 45 },
        compute: (v) => [
          { label: "Years to Double", value: x2(v.Figure / v.RateOfReturn) },
        ],
      },
      {
        id: "future-price-mktcap",
        title: "Future stock price – market cap scenario",
        fields: [
          { key: "MarketCap", label: "Market Cap (000)", type: "money" },
          { key: "CurrentStockPrice", label: "Current Stock Price", type: "money" },
          { key: "FutureMarketCap", label: "Future Market Cap (000)", type: "money" },
          { key: "TotalShares", label: "Total Shares (held)", type: "num" },
        ],
        defaults: {
          MarketCap: 193000000,
          CurrentStockPrice: 93,
          FutureMarketCap: 2000000000,
          TotalShares: 8450,
        },
        compute: (v) => {
          const fp = (v.FutureMarketCap / v.MarketCap) * v.CurrentStockPrice;
          return [
            { label: "Future Stock Price", value: m2(fp) },
            { label: "Total Value of Holdings", value: m0(v.TotalShares * fp) },
          ];
        },
      },
      {
        id: "future-price-growth",
        title: "Stock future price at a specified growth rate",
        fields: [
          { key: "CurrentStockPrice", label: "Current Stock Price", type: "money" },
          { key: "AnnualGrowthRate", label: "Annual Growth Rate", type: "pct" },
          { key: "Years", label: "Number of Years", type: "num" },
          { key: "TotalShares", label: "Total Shares (held)", type: "num" },
        ],
        defaults: {
          CurrentStockPrice: 95,
          AnnualGrowthRate: 35,
          Years: 5,
          TotalShares: 8450,
        },
        compute: (v) => {
          const fp =
            v.CurrentStockPrice * Math.pow(1 + v.AnnualGrowthRate / 100, v.Years);
          return [
            { label: "Future Stock Price", value: m2(fp) },
            { label: "Total Value of Holdings", value: m0(v.TotalShares * fp) },
          ];
        },
      },
      {
        id: "holding-scenario",
        title: "Stock holding scenario – gain target & holding period",
        fields: [
          { key: "Shares", label: "Shares", type: "num" },
          { key: "PurchasePrice", label: "Purchase Price", type: "money" },
          { key: "PurchaseDate", label: "Purchase Date", type: "date" },
          { key: "GainTarget", label: "Gain Target", type: "pct" },
          { key: "HoldingPeriodDays", label: "Holding Period (days)", type: "num" },
          { key: "CurrentStockPrice", label: "Current Stock Price", type: "money" },
        ],
        defaults: {
          Shares: 80,
          PurchasePrice: 293.185,
          PurchaseDate: "2025-09-25",
          GainTarget: 10,
          HoldingPeriodDays: 5,
          CurrentStockPrice: 323,
        },
        compute: (v) => {
          const totalPurchase = v.Shares * v.PurchasePrice;
          const sellTarget = v.PurchasePrice * (1 + v.GainTarget / 100);
          const currentTotal = v.Shares * v.CurrentStockPrice;
          const gain = currentTotal - totalPurchase;
          const pctGain = v.CurrentStockPrice / v.PurchasePrice - 1;
          return [
            { label: "Total Purchase Value", value: m2(totalPurchase) },
            { label: "Sell Target (price)", value: m2(sellTarget) },
            { label: "Sell Date", value: fmtDate(addDays(v.PurchaseDate, v.HoldingPeriodDays)) },
            { label: "Current Total Value", value: m2(currentTotal) },
            { label: "Current Gain / Loss", value: m2(gain) },
            { label: "Current % Gain / Loss", value: pRatio(pctGain) },
          ];
        },
      },
    ],
  },
  {
    group: "Profitability Ratios",
    calcs: [
      {
        id: "gross-margin",
        title: "Gross Margin",
        blurb:
          "Revenue left after direct costs (COGS). High & stable = pricing power. Software 80–90%, retail 20–30%, autos 10–20%.",
        fields: [
          { key: "Revenue", label: "Revenue (000)", type: "money" },
          { key: "COGS", label: "COGS (000)", type: "money" },
        ],
        defaults: { Revenue: 10, COGS: 5 },
        compute: (v) => [
          { label: "Gross Margin", value: pRatio((v.Revenue - v.COGS) / v.Revenue) },
        ],
      },
      {
        id: "operating-margin",
        title: "Operating Margin",
        blurb:
          "Operating profit (EBIT) ÷ revenue. >20% strong, 10–20% healthy, <10% thin.",
        fields: [
          { key: "EBIT", label: "Op Income (EBIT) (000)", type: "money" },
          { key: "Revenue", label: "Revenue (000)", type: "money" },
        ],
        defaults: { EBIT: 20, Revenue: 50 },
        compute: (v) => [
          { label: "Operating Margin", value: pRatio(v.EBIT / v.Revenue) },
        ],
      },
      {
        id: "net-profit-margin",
        title: "Net Profit Margin",
        blurb:
          "Net profit ÷ revenue – profit after everything. Retail 2–5%, manufacturing 5–10%, tech 20%+.",
        fields: [
          { key: "NetProfit", label: "Net Profit (000)", type: "money" },
          { key: "Revenue", label: "Revenue (000)", type: "money" },
        ],
        defaults: { NetProfit: 75, Revenue: 500 },
        compute: (v) => [
          { label: "Net Profit Margin", value: pRatio(v.NetProfit / v.Revenue) },
        ],
      },
    ],
  },
  {
    group: "Return Ratios",
    calcs: [
      {
        id: "roe",
        title: "Return on Equity (ROE)",
        blurb:
          "Net income ÷ shareholders' equity. 10–20% healthy; >20% very efficient (or leveraged).",
        fields: [
          { key: "NetIncome", label: "Net Income (000)", type: "money" },
          { key: "ShEquity", label: "Sh Equity (000)", type: "money" },
        ],
        defaults: { NetIncome: 12626, ShEquity: 23630 },
        compute: (v) => [
          { label: "ROE", value: pRatio(v.NetIncome / v.ShEquity) },
        ],
      },
      {
        id: "roa",
        title: "Return on Assets (ROA)",
        blurb:
          "Net income ÷ total assets. Asset-light (software) high; asset-heavy (airlines/utilities) low. Ignores leverage.",
        fields: [
          { key: "NetIncome", label: "Net Income (000)", type: "money" },
          { key: "TotalAssets", label: "Total Assets (000)", type: "money" },
        ],
        defaults: { NetIncome: 1000, TotalAssets: 10000 },
        compute: (v) => [
          { label: "ROA", value: pRatio(v.NetIncome / v.TotalAssets) },
        ],
      },
      {
        id: "roic",
        title: "Return on Invested Capital (ROIC)",
        blurb:
          "NOPAT ÷ invested capital. Value is created only when ROIC exceeds the cost of capital (WACC).",
        fields: [
          { key: "NOPAT", label: "NOPAT (000)", type: "money" },
          { key: "InvestedCapital", label: "Invested Capital", type: "money" },
        ],
        defaults: { NOPAT: 10, InvestedCapital: 100 },
        compute: (v) => [
          { label: "ROIC", value: pRatio(v.NOPAT / v.InvestedCapital) },
        ],
      },
    ],
  },
  {
    group: "Liquidity Ratios",
    calcs: [
      {
        id: "current-ratio",
        title: "Current Ratio",
        blurb:
          "Current assets ÷ current liabilities. >1 good liquidity; very high may mean idle assets.",
        fields: [
          { key: "CurrentAssets", label: "Current Assets (000)", type: "money" },
          { key: "CurrentLiabilities", label: "Current Liabilities (000)", type: "money" },
        ],
        defaults: { CurrentAssets: 10, CurrentLiabilities: 1 },
        compute: (v) => [
          { label: "Current Ratio", value: x2(v.CurrentAssets / v.CurrentLiabilities) },
        ],
      },
      {
        id: "quick-ratio",
        title: "Quick Ratio (acid test)",
        blurb:
          "(Current assets − inventory − prepaid) ÷ current liabilities. ≥1 = strong near-term liquidity.",
        fields: [
          { key: "CurrentAssets", label: "Current Assets (000)", type: "money" },
          { key: "Inventory", label: "Inventory (000)", type: "money" },
          { key: "Prepaid", label: "Prepaid Expenses (000)", type: "money" },
          { key: "CurrentLiabilities", label: "Current Liabilities (000)", type: "money" },
        ],
        defaults: { CurrentAssets: 100, Inventory: 50, Prepaid: 30, CurrentLiabilities: 10 },
        compute: (v) => [
          {
            label: "Quick Ratio",
            value: x2((v.CurrentAssets - v.Inventory - v.Prepaid) / v.CurrentLiabilities),
          },
        ],
      },
    ],
  },
  {
    group: "Leverage & Solvency Ratios",
    calcs: [
      {
        id: "de",
        title: "Debt-to-Equity (D/E)",
        blurb:
          "Total debt ÷ equity. <1 conservative; >2 heavily leveraged. Varies a lot by industry.",
        fields: [
          { key: "TotalDebt", label: "Total Debt (000)", type: "money" },
          { key: "ShEquity", label: "Sh Equity (000)", type: "money" },
        ],
        defaults: { TotalDebt: 10, ShEquity: 8 },
        compute: (v) => [
          { label: "D/E Ratio", value: x2(v.TotalDebt / v.ShEquity) },
        ],
      },
      {
        id: "icr",
        title: "Interest Coverage (ICR)",
        blurb:
          "EBIT ÷ interest expense. >3 safe, 1.5–3 tight, <1 red flag.",
        fields: [
          { key: "EBIT", label: "EBIT (000)", type: "money" },
          { key: "InterestExpense", label: "Interest Expense (000)", type: "money" },
        ],
        defaults: { EBIT: 100, InterestExpense: 50 },
        compute: (v) => [
          { label: "Interest Coverage Ratio", value: x2(v.EBIT / v.InterestExpense) },
        ],
      },
      {
        id: "debt-ebitda",
        title: "Debt-to-EBITDA",
        blurb:
          "Total debt ÷ EBITDA = years to repay. <3 healthy, 4+ high, 6+ a red flag.",
        fields: [
          { key: "TotalDebt", label: "Total Debt (000)", type: "money" },
          { key: "EBITDA", label: "EBITDA (000)", type: "money" },
        ],
        defaults: { TotalDebt: 100, EBITDA: 50 },
        compute: (v) => [
          { label: "Debt-to-EBITDA", value: x2(v.TotalDebt / v.EBITDA) },
        ],
      },
    ],
  },
  {
    group: "Efficiency Ratios",
    calcs: [
      {
        id: "asset-turnover",
        title: "Asset Turnover",
        blurb:
          "Revenue ÷ average total assets. Asset-light high (1.5–3x+), capital-heavy low (0.4–1x).",
        fields: [
          { key: "NetSales", label: "Net Sales (Rev) (000)", type: "money" },
          { key: "BeginningAssets", label: "Beginning Assets (000)", type: "money" },
          { key: "EndingAssets", label: "Ending Assets (000)", type: "money" },
        ],
        defaults: { NetSales: 100, BeginningAssets: 100, EndingAssets: 75 },
        compute: (v) => {
          const avg = (v.BeginningAssets + v.EndingAssets) / 2;
          return [
            { label: "Average Total Assets", value: m2(avg) },
            { label: "Asset Turnover", value: x2(v.NetSales / avg) },
          ];
        },
      },
      {
        id: "inventory-turnover",
        title: "Inventory Turnover",
        blurb:
          "COGS ÷ average inventory = times inventory sells per period. Grocery/FMCG high; durables/jewelry low.",
        fields: [
          { key: "COGS", label: "COGS (000)", type: "money" },
          { key: "BeginningInventory", label: "Beginning Inventory (000)", type: "money" },
          { key: "EndingInventory", label: "Ending Inventory (000)", type: "money" },
        ],
        defaults: { COGS: 100, BeginningInventory: 50, EndingInventory: 50 },
        compute: (v) => {
          const avg = (v.BeginningInventory + v.EndingInventory) / 2;
          return [
            { label: "Average Inventory", value: m2(avg) },
            { label: "Inventory Turnover", value: x2(v.COGS / avg) },
          ];
        },
      },
      {
        id: "receivables-turnover",
        title: "Receivables Turnover",
        blurb:
          "Net credit sales ÷ average receivables = how many times/yr customers pay. Higher = faster collection.",
        fields: [
          { key: "NetCreditSales", label: "Net Credit Sales (000)", type: "money" },
          { key: "ARBeginning", label: "AR Beginning (000)", type: "money" },
          { key: "AREnd", label: "AR End (000)", type: "money" },
        ],
        defaults: { NetCreditSales: 300, ARBeginning: 50, AREnd: 50 },
        compute: (v) => {
          const avg = (v.ARBeginning + v.AREnd) / 2;
          return [
            { label: "Average AR", value: m2(avg) },
            { label: "Receivables Turnover", value: x2(v.NetCreditSales / avg) },
          ];
        },
      },
    ],
  },
  {
    group: "Valuation Ratios",
    calcs: [
      {
        id: "eps",
        title: "Earnings per Share (EPS)",
        blurb:
          "(Net income − preferred dividends) ÷ weighted-avg shares. Profit attributable to each share.",
        fields: [
          { key: "NetIncome", label: "Net Income (000)", type: "money" },
          { key: "PreferredDividends", label: "Preferred Dividends (000)", type: "money" },
          { key: "TotalSharesWA", label: "Total Shares WA (000)", type: "num" },
        ],
        defaults: { NetIncome: 100, PreferredDividends: 50, TotalSharesWA: 1000 },
        compute: (v) => [
          {
            label: "EPS",
            value: m2((v.NetIncome - v.PreferredDividends) / v.TotalSharesWA),
          },
        ],
      },
      {
        id: "pe",
        title: "Price-to-Earnings (P/E)",
        blurb:
          "Price ÷ EPS. 10–15 value, 15–25 average, 25+ growth. Compare within an industry.",
        fields: [
          { key: "CurrentStockPrice", label: "Current Stock Price", type: "money" },
          { key: "NetIncome", label: "Net Income (000)", type: "money" },
          { key: "PreferredDividends", label: "Preferred Dividends (000)", type: "money" },
          { key: "TotalSharesWA", label: "Total Shares WA (000)", type: "num" },
        ],
        defaults: {
          CurrentStockPrice: 10,
          NetIncome: 1000,
          PreferredDividends: 50,
          TotalSharesWA: 1000,
        },
        compute: (v) => {
          const eps = (v.NetIncome - v.PreferredDividends) / v.TotalSharesWA;
          return [
            { label: "EPS", value: m2(eps) },
            { label: "P/E", value: x2(v.CurrentStockPrice / eps) },
          ];
        },
      },
      {
        id: "peg",
        title: "PEG (P/E to Growth)",
        blurb:
          "P/E ÷ EPS growth. ~1 fair, <1 possibly undervalued, >1 possibly overpaying for growth.",
        fields: [
          { key: "CurrentStockPrice", label: "Current Stock Price", type: "money" },
          { key: "NetIncome", label: "Net Income (000)", type: "money" },
          { key: "PreferredDividends", label: "Preferred Dividends (000)", type: "money" },
          { key: "TotalSharesWA", label: "Total Shares WA (000)", type: "num" },
          { key: "ExpectedEPS", label: "Expected EPS", type: "money" },
        ],
        defaults: {
          CurrentStockPrice: 10,
          NetIncome: 1000,
          PreferredDividends: 100,
          TotalSharesWA: 2000,
          ExpectedEPS: 1,
        },
        compute: (v) => {
          const eps = (v.NetIncome - v.PreferredDividends) / v.TotalSharesWA;
          const pe = v.CurrentStockPrice / eps;
          const growth = (v.ExpectedEPS - eps) / eps;
          const peg = pe / (growth * 100);
          return [
            { label: "EPS", value: m2(eps) },
            { label: "P/E", value: x2(pe) },
            { label: "Earnings Growth Rate", value: pRatio(growth) },
            { label: "PEG", value: x2(peg) },
          ];
        },
      },
      {
        id: "pb",
        title: "Price-to-Book (P/B)",
        blurb:
          "Price ÷ book value/share. <1 may be undervalued; best for asset-heavy sectors (banks, RE).",
        fields: [
          { key: "CurrentStockPrice", label: "Current Stock Price", type: "money" },
          { key: "TotalAssets", label: "Total Assets (000)", type: "money" },
          { key: "TotalLiabilities", label: "Total Liabilities (000)", type: "money" },
          { key: "TotalShares", label: "Total Shares (000)", type: "num" },
        ],
        defaults: {
          CurrentStockPrice: 100,
          TotalAssets: 1000000,
          TotalLiabilities: 800000,
          TotalShares: 200000,
        },
        compute: (v) => {
          const bvps = (v.TotalAssets - v.TotalLiabilities) / v.TotalShares;
          return [
            { label: "Book Value per Share", value: m2(bvps) },
            { label: "P/B", value: x2(v.CurrentStockPrice / bvps) },
          ];
        },
      },
      {
        id: "ps",
        title: "Price-to-Sales (P/S)",
        blurb:
          "Market cap ÷ revenue. Useful for unprofitable/high-growth firms; ignores costs & debt.",
        fields: [
          { key: "MarketCap", label: "Market Cap (000)", type: "money" },
          { key: "TotalRevenue", label: "Total Revenue (000)", type: "money" },
        ],
        defaults: { MarketCap: 200000, TotalRevenue: 47000 },
        compute: (v) => [
          { label: "P/S", value: x2(v.MarketCap / v.TotalRevenue) },
        ],
      },
      {
        id: "div-yield",
        title: "Dividend Yield",
        blurb:
          "Annual dividend/share ÷ price. <2% low/growth, 2–4% moderate, >5% high (check it's covered).",
        fields: [
          { key: "TotalDivPaid", label: "Total Div Paid to Sh (000)", type: "money" },
          { key: "TotalShares", label: "Total Shares (000)", type: "num" },
          { key: "StockPrice", label: "Stock Price", type: "money" },
        ],
        defaults: { TotalDivPaid: 10000, TotalShares: 1000, StockPrice: 50 },
        compute: (v) => {
          const dps = v.TotalDivPaid / v.TotalShares;
          return [
            { label: "DPS", value: m2(dps) },
            { label: "Dividend Yield", value: pRatio(dps / v.StockPrice) },
          ];
        },
      },
      {
        id: "fcf-yield",
        title: "Free Cash Flow Yield",
        blurb:
          "(Operating CF − capex) ÷ market cap. Higher = strong cash generation or possible undervaluation.",
        fields: [
          { key: "OperatingCF", label: "Operating CF (000)", type: "money" },
          { key: "Capex", label: "Capex (000)", type: "money" },
          { key: "MarketCap", label: "Market Cap (000)", type: "money" },
        ],
        defaults: { OperatingCF: 100000, Capex: 1000, MarketCap: 900000 },
        compute: (v) => {
          const fcf = v.OperatingCF - v.Capex;
          return [
            { label: "Free Cash Flow", value: m0(fcf) },
            { label: "Free Cash Flow Yield", value: pRatio(fcf / v.MarketCap) },
          ];
        },
      },
      {
        id: "ev-ebitda",
        title: "EV / EBITDA",
        blurb:
          "Enterprise value ÷ EBITDA. <5x cheap, 5–10x typical mature, 10–15x quality, 15x+ expensive.",
        fields: [
          { key: "MarketCap", label: "Market Cap (000)", type: "money" },
          { key: "ShortTermDebt", label: "Short-term Debt (000)", type: "money" },
          { key: "LongTermDebt", label: "Long-term Debt (000)", type: "money" },
          { key: "Cash", label: "Cash & Equivalents (000)", type: "money" },
          { key: "NetIncome", label: "Net Income (000)", type: "money" },
          { key: "Interest", label: "Interest (000)", type: "money" },
          { key: "Taxes", label: "Taxes (000)", type: "money" },
          { key: "Depreciation", label: "Depreciation (000)", type: "money" },
          { key: "Amortisation", label: "Amortisation (000)", type: "money" },
        ],
        defaults: {
          MarketCap: 200000000,
          ShortTermDebt: 500000,
          LongTermDebt: 5000000,
          Cash: 10000000,
          NetIncome: 11000000,
          Interest: 1000,
          Taxes: 500,
          Depreciation: 200,
          Amortisation: 500,
        },
        compute: (v) => {
          const ev =
            v.MarketCap + v.ShortTermDebt + v.LongTermDebt - v.Cash;
          const ebitda =
            v.NetIncome + v.Interest + v.Taxes + v.Depreciation + v.Amortisation;
          return [
            { label: "Enterprise Value", value: m0(ev) },
            { label: "EBITDA", value: m0(ebitda) },
            { label: "EV / EBITDA", value: xX(ev / ebitda) },
          ];
        },
      },
    ],
  },
];
