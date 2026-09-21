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
  assert.ok(summaryStart >= 0 && summaryStart < detailsStart);
});
