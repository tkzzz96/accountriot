/** CSV cell escaping + spreadsheet formula-injection neutralization (cell values come from third-party listings). */
export function csvCell(v: unknown): string {
  let s = v == null ? "" : String(v);
  // Cells starting with = + - @ (or tab/CR) are evaluated as formulas by Excel/Sheets; plain phone numbers are fine.
  if (/^[=+\-@\t\r]/.test(s) && !/^\+?\d[\d\s().-]*$/.test(s)) s = `'${s}`;
  return s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r") ? `"${s.replace(/"/g, '""')}"` : s;
}
