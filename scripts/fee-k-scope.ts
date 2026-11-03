// =============================================================================
// Fee K Types scope — fill the saved table's empty scope from the draft
// =============================================================================
//   npm run feek:scope              dry run (default): which types would change
//   npm run feek:scope -- --apply   write data/fee-k-types.json
//
// Contracts read only the SAVED table once an admin has saved it, so scope text
// added to the draft (fee-k-types-draft.ts) never reaches them by itself. This
// copies it over for rows whose four scope fields are all empty; a row with any
// scope text is left alone. --apply first copies the file to
// fee-k-types.json.bak-<timestamp>. Same as typing it in Settings → Firm → Fee
// K Types, without the audit entry.
// =============================================================================

import fs from "node:fs";
import path from "node:path";
import { SCOPE_FIELDS, feeKTypeLookup, feeKTypesSaved, fillEmptyScope, initFeeKTypes, loadFeeKTypes, saveFeeKTypes } from "../apps/api/src/fee-k-types.js";
import { DRAFT_FEE_K_TYPES } from "../apps/api/src/fee-k-types-draft.js";

const apply = process.argv.includes("--apply");
const dataDir = path.resolve("data");
initFeeKTypes(dataDir);
const file = path.join(dataDir, "fee-k-types.json");

if (!feeKTypesSaved()) {
  console.log("No saved table (data/fee-k-types.json): contracts already use the draft's scope. Nothing to do.");
  process.exit(0);
}
const saved = loadFeeKTypes();
if (!saved.length) {
  console.error("data/fee-k-types.json is empty or unreadable — refusing to write over it.");
  process.exit(1);
}

const { rows, filled } = fillEmptyScope(saved, DRAFT_FEE_K_TYPES);
const inSaved = feeKTypeLookup(saved);
const notSaved = DRAFT_FEE_K_TYPES.filter((r) => r.services && !inSaved(r.feeKType)).map((r) => r.feeKType);
const stillEmpty = rows.filter((r) => SCOPE_FIELDS.every((k) => !r[k])).map((r) => r.feeKType);

console.log(`${filled.length} type(s) ${apply ? "filled" : "would be filled"}:`);
for (const t of filled) console.log(`  + ${t}`);
if (stillEmpty.length) console.log(`Still without scope (${stillEmpty.length}): ${stillEmpty.join(" · ")}`);
if (notSaved.length) console.log(`In the draft but not in the saved table (add them in Settings): ${notSaved.join(" · ")}`);

if (!apply) {
  console.log("\nDry run — nothing written. Re-run with --apply to write.");
} else if (filled.length) {
  const backup = `${file}.bak-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  fs.copyFileSync(file, backup);
  saveFeeKTypes(rows);
  console.log(`\nWrote ${file} (backup: ${path.basename(backup)}).`);
}
