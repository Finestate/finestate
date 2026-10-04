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
