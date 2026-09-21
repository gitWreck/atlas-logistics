import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(
  path.join(directory, "TripDrawerFooter.jsx"),
  "utf8",
);

test("manifest footer details can be collapsed without hiding the summary", () => {
  assert.match(
    source,
    /const \[showDetails, setShowDetails\] = useState\(true\)/,
  );
  assert.match(source, /aria-expanded=\{showDetails\}/);
  assert.match(source, /aria-controls="trip-manifest-details"/);
  assert.match(source, /showDetails \? "Hide details" : "Show details"/);
  assert.match(source, /id="trip-manifest-details"/);
  assert.match(source, /\{showDetails && \([\s\S]*Lock Manifest/);

  const detailsStart = source.indexOf("{showDetails && (");
  const summaryStart = source.indexOf("Manifest</span>");
  const toggleStart = source.indexOf('aria-controls="trip-manifest-details"');
  const invoicesStart = source.indexOf('className="font-bold">Invoices:');
  assert.ok(summaryStart >= 0 && summaryStart < detailsStart);
  assert.ok(summaryStart < toggleStart && toggleStart < invoicesStart);
  assert.match(source, /sm:grid-cols-\[1fr_auto_1fr\]/);
});
