// The bank sends you back here after the approval. Nothing is done with the code on
// this open address; it goes straight on to the Monthly page, where the signed-in
// admin's own session finishes the connection.
export default function handler(req, res) {
  const code = String(req.query?.code || "");
  const state = String(req.query?.state || "");
  const error = String(req.query?.error || "");
  const q = new URLSearchParams(error ? { bankerror: error } : { bankcode: code, bankstate: state });
  res.writeHead(302, { Location: `/?${q.toString()}#costs/monthly` });
  res.end();
}
