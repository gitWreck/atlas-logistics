const assert = require("node:assert/strict");
const test = require("node:test");

const { applyFirestoreDocumentChanges } = require("./checkerRealtime");

function change(type, id, data = {}) {
  return {
    type,
    doc: {
      id,
      data: () => data,
    },
  };
}

test("checker realtime cache applies only changed Firestore documents", () => {
  const current = {
    unchanged: { id: "unchanged", status: "RECEIVED" },
    modified: { id: "modified", status: "RECEIVED" },
    removed: { id: "removed", status: "RECEIVED" },
  };

  const next = applyFirestoreDocumentChanges(current, [
    change("modified", "modified", { status: "OUT_FOR_DELIVERY" }),
    change("removed", "removed"),
    change("added", "added", { status: "RELEASED_FOR_DELIVERY" }),
  ]);

  assert.deepEqual(next, {
    unchanged: { id: "unchanged", status: "RECEIVED" },
    modified: { id: "modified", status: "OUT_FOR_DELIVERY" },
    added: { id: "added", status: "RELEASED_FOR_DELIVERY" },
  });
  assert.equal(current.removed.id, "removed");
});
