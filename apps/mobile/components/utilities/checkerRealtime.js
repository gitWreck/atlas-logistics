function applyFirestoreDocumentChanges(current = {}, changes = []) {
  const next = { ...(current || {}) };

  (Array.isArray(changes) ? changes : []).forEach((change) => {
    const docSnapshot = change?.doc;
    const id = String(docSnapshot?.id || "").trim();
    if (!id) return;

    if (change.type === "removed") {
      delete next[id];
      return;
    }

    const data =
      typeof docSnapshot.data === "function" ? docSnapshot.data() : {};
    next[id] = { id, ...(data || {}) };
  });

  return next;
}

module.exports = { applyFirestoreDocumentChanges };
