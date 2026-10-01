// ONE-OFF: the expense lines from the HEIE Planning sheet (FC tab), written into
// Supabase the first time the Monthly page opens, then taken out of the code again.
// Each line: description, payment source, amount. Frequency is left for you to set.
export const EXPENSES_SEED = [
  {
    name: "HOME-RELATED",
    rows: [
      ["Mortgage home one", "SP 61118196", "687.50"],
      ["Mortage home two", "SP 61118196", "433.34"],
      ["Haus- und Grundbesitzerverein", "SP 61118196", "110.00"],
      ["Gründstücksteuer house", "SP 61118196", "99.88"],
      ["Gründstücksteuer garage", "SP 61118196", "11.95"],
      ["Parking garage Hausgeld", "SP 61118196", "124.00"],
      ["Bezirkskaminkehrer", "SP 61118196", "70.00"],
      ["AWM garbage pickup", "SP 61118196", "85.41"],
      ["SWM Strom", "SP 61118196", "197.00"],
      ["SWM Gas", "SP 61118196", "272.00"],
      ["SWM Wasser", "SP 61118196", "95.00"],
      ["Münchner Stadtenwässerung (Schmutzwasser)", "SP 61118196", "364.00"],
      ["ARD Rundfunkgebühr", "Per invoice", "55.08"],
    ],
  },
  {
    name: "TELEPHONES AND IT",
    rows: [
      ["Spotify", "PayPal (SP MC)", "14.99"],
      ["Telekom Festnetz package", "SP 61118196", "79.00"],
      ["Telekom mobile contract ADI + SGI (0063-0467-0077)", "SP 61118196", "50.00"],
      ["Tchibo mobile contract SI", "SP 61118196", "9.99"],
      ["Tchibo mobile contract ASI", "SP 61118196", "9.99"],
    ],
  },
  {
    name: "CAR",
    rows: [
      ["Hyundai leasing", "SP 61118196", "440.00"],
      ["Hauptzollamt Kraftfahrzeugsteuer", "SP 61118196", "77.00"],
    ],
  },
  {
    name: "INSURANCES (NON-AUTO)",
    rows: [
      ["Ergo Rechtsschutzversicherung", "SP 61118196", "345.00"],
      ["TKK", "SP 61118196", "793.58"],
      ["VKB Gebäude-Brand-Versicherung", "SP 61118196", "207.16"],
      ["VKB Hausratversicherung mit Glas", "SP 61118196", "89.54"],
      ["VKB Haftpflilcht", "SP 61118196", "127.23"],
      ["ADAC Autombilclub", "SP 61118196", "104.00"],
      ["ADAC Auslands-Krankenschutz", "SP 61118196", "23.66"],
      ["ADAC Reiserücktritts-Versicherung", "SP 61118196", "96.15"],
    ],
  },
  {
    name: "FITNESS",
    rows: [
      ["RSG Group: McFIT membership", "SP 61118196", "24.90"],
      ["RSG Group: McFIT membership A", "SP 61118196", "29.50"],
      ["RSG Group: McFIT membership S", "SP 61118196", "24.90"],
      ["TSV Solln membership S", "SP 61118196", "120.00"],
    ],
  },
  {
    name: "STUDIES AND RELATED",
    rows: [
      ["MVG ticket A", "SP 61118196", "43.00"],
      ["MVG ticket S", "SP 61118196", "36.50"],
      ["Macromedia", "SP 61118196", "701.10"],
    ],
  },
  {
    name: "EXTRAS",
    rows: [
      ["DANZER tutoring", "SP 61118196", "0.00"],
    ],
  },
  {
    name: "S COVERING",
    rows: [
      ["Krankenversicherung für Katzen", "SSI account", "0.00"],
      ["SelfStorage MyPlace", "SSI account", "0.00"],
    ],
  },
];
