// Plain text backups: each key page can save what it holds as a .txt file that opens
// anywhere. These are copies for reading; the site never loads them back.

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

// Today as 04 OCT 2026, for the file name and the first line.
export const backupStamp = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

// Rich notes saved as HTML, read back as plain lines.
export const htmlToLines = (html) => {
  const box = document.createElement("textarea");
  box.innerHTML = String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "");
  return box.value.replace(/\n{3,}/g, "\n\n").trim();
};

// Hands the lines to the browser as a download named "Finestate <page> backup <date>.txt".
export const downloadText = (page, lines) => {
  const blob = new Blob([lines.join("\r\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Finestate ${page} backup ${backupStamp()}.txt`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// Any saved record as indented plain lines: names written out in words, ids and screen
// settings left out, empty values skipped.
const words = (k) => String(k).replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
export const dumpLines = (value, skip = ["id", "ui"], depth = 0) => {
  const out = [];
  const pad = "  ".repeat(depth);
  const isEmpty = (v) => v == null || v === "" || (Array.isArray(v) && !v.length) || (typeof v === "object" && !Array.isArray(v) && !Object.keys(v).length);
  if (Array.isArray(value)) {
    value.forEach((item) => {
      if (item && typeof item === "object") {
        const flat = Object.entries(item).filter(([k, v]) => !skip.includes(k) && !isEmpty(v) && typeof v !== "object");
        const deep = Object.entries(item).filter(([k, v]) => !skip.includes(k) && !isEmpty(v) && typeof v === "object");
        out.push(`${pad}- ${flat.map(([k, v]) => `${words(k)}: ${v}`).join(" | ")}`);
        deep.forEach(([k, v]) => { out.push(`${pad}  ${words(k)}`); out.push(...dumpLines(v, skip, depth + 2)); });
      } else if (!isEmpty(item)) out.push(`${pad}- ${item}`);
    });
  } else if (value && typeof value === "object") {
    Object.entries(value).forEach(([k, v]) => {
      if (skip.includes(k) || isEmpty(v)) return;
      if (typeof v === "object") { out.push(`${pad}${words(k)}`); out.push(...dumpLines(v, skip, depth + 1)); }
      else out.push(`${pad}${words(k)}: ${v}`);
    });
  }
  return out;
};
