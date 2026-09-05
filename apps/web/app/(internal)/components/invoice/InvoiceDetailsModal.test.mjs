import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(
  path.join(directory, "InvoiceDetailsModal.jsx"),
  "utf8",
);

test("payment proof is displayed inline without view or download actions", () => {
  assert.match(source, /downloadPaymentProof\(\{ proofId: proof\.proofId \}\)/);
  assert.match(source, /<img[\s\S]*src=\{preview\.url\}/);
  assert.match(source, /<iframe[\s\S]*src=\{preview\.url\}/);
  assert.match(source, /Loading payment proof/);
  assert.doesNotMatch(source, />\s*Download\s*</);
  assert.doesNotMatch(source, />\s*View\s*</);
});
