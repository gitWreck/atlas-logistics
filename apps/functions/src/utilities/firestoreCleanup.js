"use strict";

const BATCH_SIZE = 400;

async function commitBatchDeletes(db, docRefs) {
  for (let i = 0; i < docRefs.length; i += BATCH_SIZE) {
    const chunk = docRefs.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    chunk.forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

async function deleteCollectionQuery(query) {
  const db = query.firestore;

  for (;;) {
    const snap = await query.limit(BATCH_SIZE).get();
    if (snap.empty) break;

    await commitBatchDeletes(
      db,
      snap.docs.map((doc) => doc.ref),
    );

    if (snap.size < BATCH_SIZE) break;
  }
}

async function deleteSubcollection(parentRef, subcollectionId) {
  await deleteCollectionQuery(parentRef.collection(subcollectionId));
}

module.exports = {
  BATCH_SIZE,
  commitBatchDeletes,
  deleteCollectionQuery,
  deleteSubcollection,
};
