 "use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = admin.firestore;
const { requireRole, updatedBy } = require("../utilities/helpers");
const { writePackageActionLog } = require("../utilities/packageLogger");
const { writeShipmentEvent } = require("../tracking/writeShipmentEvent");
const {
  resolveEventTypeForScannerStatus,
} = require("../tracking/eventTypes");
const { extractTripEventContext } = require("../tracking/tripEventContext");
const { deriveMasterShipmentStatus, computePackageBreakdown } = require("./shipmentStatus");
const {
  PACKAGE_STATUS,
  ODIONGAN_WAREHOUSE,
  derivePackageStatusFromQuantities,
  resolveLinehaulLoadedStatus,
  resolveDeliveryVehicleLoadedStatus,
  resolveHubUnloadStatus,
} = require("./packageStatus");
const { normalizeQty } = require("../utilities/packageHelpers");
const { tryAutoCompleteTrip } = require("../trips/autoCompleteTrip");
const { assertCanUnloadAtHub } = require("../trips/manifestStatus");
const {
  assertCustodyStructuralEditAllowed,
  assertCustodyScanStatusAllowed,
} = require("../trips/manifestLockGuard");
const {
  packageLinkedToTrip,
  evaluatePackageLinehaulLoad,
} = require("./tripPackageOperations");
const {
  sendAutomaticShipmentLifecycleNotification,
  CUSTOMER_NOTIFICATION_TYPES,
} = require("../notifications/customerNotificationService");
const {
  SEMAPHORE_API_KEY,
  SEMAPHORE_SENDER_NAME,
} = require("../../shared/sms-service");
const { defineSecret } = require("firebase-functions/params");

const SMTP_EMAIL = defineSecret("SMTP_EMAIL");
const SMTP_PASSWORD = defineSecret("SMTP_PASSWORD");

function wasShipmentOutForDelivery(status = "") {
  const normalized = String(status || "").toUpperCase();
  return (
    normalized === "OUT_FOR_DELIVERY" ||
    normalized === "PARTIALLY_OUT_FOR_DELIVERY"
  );
}

function wasShipmentDelivered(status = "") {
  const normalized = String(status || "").toUpperCase();
  return normalized === "DELIVERED" || normalized === "COMPLETED";
}

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.updateShipmentPackages = onCall(
  {
    region: "asia-southeast1",
    maxInstances: 10,
    secrets: [SEMAPHORE_API_KEY, SEMAPHORE_SENDER_NAME, SMTP_EMAIL, SMTP_PASSWORD],
  },
  async (req) => {
    await requireRole(db, req, ["admin", "manager", "checker"]);

    const authUid = req.auth?.uid;
    if (!authUid) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }
    // const actor = updatedBy(req);
    const { name, uid, role, usercode } = updatedBy(req);
    const actorUid = authUid || uid;

    const {
      shipmentId,
      packages: newPackagesArray, // full replace from web modal
      packageIds, // scanner-targeted packageIds / trackingNumbers
      newStatus, // RECEIVED | LOADED | DELIVERED | MISSING | DAMAGED
      manualQty, // partial qty for grouped package rows
      remarks,
      location,
      scanAction,
      tripId: scannerTripId,
      notify = false,
      notificationChannels = null,
      notifySms,
      notifyEmail,
      notifyPush,
    } = req.data || {};

    if (!shipmentId || typeof shipmentId !== "string") {
      throw new HttpsError("invalid-argument", "Missing shipmentId.");
    }

    const isScannerUpdate = Array.isArray(packageIds) && packageIds.length > 0;
    const isModalReplace = Array.isArray(newPackagesArray);

    if (!isScannerUpdate && !isModalReplace) {
      throw new HttpsError(
        "invalid-argument",
        "Provide either packageIds for scanner update or packages for full replace.",
      );
    }

    if (isScannerUpdate && !newStatus) {
      throw new HttpsError(
        "invalid-argument",
        "newStatus is required for scanner updates.",
      );
    }

    const allowedStatuses = [
      "RECEIVED",
      "LOADED",
      "OUT_FOR_DELIVERY",
      "DELIVERED",
      "MISSING",
      "DAMAGED",
    ];
    if (isScannerUpdate && !allowedStatuses.includes(newStatus)) {
      throw new HttpsError(
        "invalid-argument",
        `Invalid newStatus: ${newStatus}`,
      );
    }
    if (
      isScannerUpdate &&
      String(newStatus).toUpperCase() === "LOADED" &&
      !(typeof scannerTripId === "string" && scannerTripId.trim())
    ) {
      throw new HttpsError(
        "failed-precondition",
        "Trip is required before loading. Open a trip manifest, then scan packages.",
      );
    }

    const shipmentRef = db.collection("shipments").doc(shipmentId);

    let pendingEvent = null;
    let completedTripId = null;
    let shouldTryAutoCompleteTrip = false;
    let outForDeliveryNotificationContext = null;
    let deliveredNotificationContext = null;

    await db.runTransaction(async (tx) => {
      // -----------------------------
      // 1. READS FIRST
      // -----------------------------
      const shipmentSnap = await tx.get(shipmentRef);
      if (!shipmentSnap.exists) {
        throw new HttpsError("not-found", "Shipment not found.");
      }

      const oldData = shipmentSnap.data() || {};
      const oldPackages = Array.isArray(oldData.packages)
        ? oldData.packages
        : [];

      const normalizedScannerTripId =
        typeof scannerTripId === "string" && scannerTripId.trim()
          ? scannerTripId.trim()
          : null;
      const shipmentTripId = oldData.currentTripId || null;

      const resolveTripContext = async (candidateTripId) => {
        if (!candidateTripId) return null;

        const candidateTripRef = db
          .collection("truck_trips")
          .doc(candidateTripId);
        const candidateTripShipmentRef = candidateTripRef
          .collection("trip_shipments")
          .doc(shipmentId);
        const [candidateTripSnap, candidateTripShipmentSnap] =
          await Promise.all([
            tx.get(candidateTripRef),
            tx.get(candidateTripShipmentRef),
          ]);

        if (!candidateTripSnap.exists) return null;

        return {
          tripId: candidateTripId,
          tripRef: candidateTripRef,
          tripShipmentRef: candidateTripShipmentRef,
          tripSnap: candidateTripSnap,
          tripShipmentSnap: candidateTripShipmentSnap,
        };
      };

      let tripContext =
        (await resolveTripContext(normalizedScannerTripId)) ||
        (await resolveTripContext(shipmentTripId));

      if (
        !isScannerUpdate &&
        normalizedScannerTripId &&
        shipmentTripId &&
        normalizedScannerTripId !== shipmentTripId &&
        tripContext?.tripId === normalizedScannerTripId &&
        !tripContext.tripShipmentSnap.exists
      ) {
        const onShipmentTripRef = db
          .collection("truck_trips")
          .doc(shipmentTripId)
          .collection("trip_shipments")
          .doc(shipmentId);
        const onShipmentTripSnap = await tx.get(onShipmentTripRef);

        if (onShipmentTripSnap.exists) {
          throw new HttpsError(
            "failed-precondition",
            "This shipment belongs to a different trip. Open the correct trip before scanning.",
          );
        }
      }

      let tripId = tripContext?.tripId || null;
      let tripRef = tripContext?.tripRef || null;
      let tripShipmentRef = tripContext?.tripShipmentRef || null;
      let tripShipmentSnap = tripContext?.tripShipmentSnap || null;
      let tripSnap = tripContext?.tripSnap || null;
      const tripData = tripSnap?.exists ? tripSnap.data() || {} : {};

      if (isModalReplace) {
        assertCustodyStructuralEditAllowed(oldData, tripData);
      } else if (isScannerUpdate) {
        assertCustodyScanStatusAllowed(oldData, tripData, newStatus);
      }

      if (tripId && tripRef && tripShipmentRef && !tripShipmentSnap?.exists) {
        tx.set(tripShipmentRef, {
          trackingShipmentId: shipmentId,
          shipmentId: oldData.shipmentId || null,
          route:
            (oldData.originCode || "?") +
            " -> " +
            (oldData.destinationCode || "?"),
          totalItems: 0,
          pendingCount: 0,
          loadedCount: 0,
          deliveredCount: 0,
          receivedCount: 0,
          missingCount: 0,
          damagedCount: 0,
          sender: oldData.sender || null,
          recipient: oldData.recipient || null,
          packageBarcodes: [],
          createdAt: FieldValue.serverTimestamp(),
          createdBy: uid,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: name,
          updatedRole: role,
          status: oldData.status || "ASSIGNED",
        });
        tripShipmentSnap = {
          exists: true,
          data: () => ({
            status: oldData.status || "ASSIGNED",
            totalItems: 0,
            pendingCount: 0,
            loadedCount: 0,
            deliveredCount: 0,
            receivedCount: 0,
            missingCount: 0,
            damagedCount: 0,
          }),
        };
      }

      const tripType = String(tripData.tripType || "").toUpperCase();
      const isDeliveryTrip = tripType === "DELIVERY";
      const normalizedScanAction = String(scanAction || "").toUpperCase();
      const isLoadingAction =
        normalizedScanAction === "LOAD" || normalizedScanAction === "LOADING";
      const isOffloadingAction =
        normalizedScanAction === "UNLOAD" ||
        normalizedScanAction === "OFFLOADING" ||
        normalizedScanAction === "OFFLOAD";

      if (isScannerUpdate && isOffloadingAction && tripSnap?.exists) {
        assertCanUnloadAtHub(tripData, tripId);
      }
      const oldShipmentStatus = String(oldData.status || "").toUpperCase();
      const oldTripShipmentStatus = String(
        tripShipmentSnap?.exists ? tripShipmentSnap.data()?.status || "" : "",
      ).toUpperCase();
      const shouldPromoteReadyForDelivery =
        isDeliveryTrip &&
        isLoadingAction &&
        newStatus === "LOADED" &&
        (oldShipmentStatus === "READY_FOR_DELIVERY" ||
          oldTripShipmentStatus === "READY_FOR_DELIVERY");
      const wasOutForDelivery =
        oldShipmentStatus === "OUT_FOR_DELIVERY" ||
        oldTripShipmentStatus === "OUT_FOR_DELIVERY";

      // -----------------------------
      // 2. HELPERS
      // -----------------------------
      const nowIso = new Date().toISOString();
      const nowServer = FieldValue.serverTimestamp();

      const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
      const getPackageIdentity = (pkg = {}) =>
        String(pkg.packageId || pkg.trackingNumber || "").trim();
      const normalizeTargetId = (id = "") =>
        String(id || "").trim().toUpperCase();
      const packageMatchesTarget = (pkg = {}, targetedIdSet, status) => {
        const packageId = normalizeTargetId(pkg.packageId || "");
        const trackingNumber = normalizeTargetId(pkg.trackingNumber || "");

        // Deliver only the exact piece label (packageId). trackingNumber can
        // duplicate the master shipment code on legacy rows and would match twice.
        if (String(status || "").toUpperCase() === "DELIVERED") {
          if (packageId) return targetedIdSet.has(packageId);
          return trackingNumber ? targetedIdSet.has(trackingNumber) : false;
        }

        const identities = [pkg.packageId, pkg.trackingNumber]
          .filter((value) => typeof value === "string" && value.trim())
          .map((value) => normalizeTargetId(value));
        return identities.some((id) => targetedIdSet.has(id));
      };
      const normalizePackage = (pkg = {}) => {
        const quantity = Math.max(normalizeQty(pkg.quantity, 1), 1);
        const loadedQty = clamp(normalizeQty(pkg.loadedQty, 0), 0, quantity);
        const receivedQty = clamp(
          normalizeQty(pkg.receivedQty, 0),
          0,
          quantity,
        );
        const missingQty = clamp(normalizeQty(pkg.missingQty, 0), 0, quantity);
        const damagedQty = clamp(normalizeQty(pkg.damagedQty, 0), 0, quantity);

        return {
          ...pkg,
          quantity,
          loadedQty,
          receivedQty,
          missingQty,
          damagedQty,
        };
      };

      const isHubReceive =
        isOffloadingAction && newStatus === "RECEIVED" && !isDeliveryTrip;
      const derivePackageStatus = (pkg) =>
        derivePackageStatusFromQuantities(pkg, { isDeliveryTrip, isHubReceive });

      const sumTotalQty = (pkgs) =>
        pkgs.reduce(
          (sum, p) => sum + Math.max(normalizeQty(p.quantity, 1), 1),
          0,
        );

      const sumLoadedQty = (pkgs) =>
        pkgs.reduce(
          (sum, p) =>
            sum +
            clamp(
              normalizeQty(p.loadedQty, 0),
              0,
              Math.max(normalizeQty(p.quantity, 1), 1),
            ),
          0,
        );

      const sumReceivedQty = (pkgs) =>
        pkgs.reduce((sum, p) => {
          const quantity = Math.max(normalizeQty(p.quantity, 1), 1);
          const status = String(p.status || "").toUpperCase();
          if (["DELIVERED", "COMPLETED"].includes(status)) {
            return sum + quantity;
          }
          if (
            [
              "ARRIVED_AT_ODIONGAN",
              "AVAILABLE_AT_ODIONGAN_WAREHOUSE",
              "RELEASED_FOR_DELIVERY",
              "READY_FOR_DELIVERY",
            ].includes(status)
          ) {
            return sum + quantity;
          }
          return (
            sum +
            clamp(
              normalizeQty(p.receivedQty, 0),
              0,
              quantity,
            )
          );
        }, 0);

      const sumMissingQty = (pkgs) =>
        pkgs.reduce(
          (sum, p) =>
            sum +
            clamp(
              normalizeQty(p.missingQty, 0),
              0,
              Math.max(normalizeQty(p.quantity, 1), 1),
            ),
          0,
        );

      const sumDamagedQty = (pkgs) =>
        pkgs.reduce(
          (sum, p) =>
            sum +
            clamp(
              normalizeQty(p.damagedQty, 0),
              0,
              Math.max(normalizeQty(p.quantity, 1), 1),
            ),
          0,
        );

      const oldNormalizedPackages = oldPackages.map((pkg) => {
        const normalized = normalizePackage(pkg);
        return {
          ...normalized,
          status: derivePackageStatus(normalized),
        };
      });

      const nextPackageId = (sourcePkg = {}, existingPackages = []) => {
        const shipmentCode = oldData.shipmentId || shipmentId;
        const usedIds = new Set(
          existingPackages
            .map((pkg) => getPackageIdentity(pkg))
            .filter(Boolean),
        );

        let nextSequence =
          existingPackages.reduce((max, pkg) => {
            const seq = Number(pkg.sequence);
            return Number.isFinite(seq) ? Math.max(max, seq) : max;
          }, 0) + 1;

        let candidate = `${shipmentCode}-${String(nextSequence).padStart(2, "0")}`;
        while (usedIds.has(candidate)) {
          nextSequence += 1;
          candidate = `${shipmentCode}-${String(nextSequence).padStart(2, "0")}`;
        }

        return {
          packageId: candidate,
          trackingNumber: candidate,
          sequence: nextSequence,
          parentPackageId:
            sourcePkg.parentPackageId || sourcePkg.packageId || null,
        };
      };

      // -----------------------------
      // 3. BUILD FINAL PACKAGE ARRAY
      // -----------------------------
      let finalPackages = [];

      if (isScannerUpdate) {
        const targetedIds = packageIds
          .filter((id) => typeof id === "string" && id.trim())
          .map((id) => id.trim());
        const targetedIdSet = new Set(targetedIds.map(normalizeTargetId));

        if (!targetedIds.length) {
          throw new HttpsError(
            "invalid-argument",
            "No valid packageIds provided.",
          );
        }

        finalPackages = [];
        let targetedPackageCount = 0;

        if (newStatus === "DELIVERED") {
          targetedPackageCount = oldNormalizedPackages.filter((pkg) =>
            packageMatchesTarget(pkg, targetedIdSet, newStatus),
          ).length;

          if (targetedPackageCount === 0) {
            throw new HttpsError(
              "not-found",
              `No package matched the scanned label. Expected packageId: ${targetedIds.join(", ")}`,
            );
          }

          if (targetedPackageCount > 1) {
            const matchedIds = oldNormalizedPackages
              .filter((pkg) =>
                packageMatchesTarget(pkg, targetedIdSet, newStatus),
              )
              .map((pkg) => getPackageIdentity(pkg))
              .filter(Boolean);
            throw new HttpsError(
              "failed-precondition",
              `Multiple packages matched this delivery scan (${matchedIds.join(", ")}). Each piece must have a unique packageId.`,
            );
          }
        }

        oldNormalizedPackages.forEach((pkg) => {
          const identities = [pkg.packageId, pkg.trackingNumber]
            .filter((value) => typeof value === "string" && value.trim())
            .map((value) => value.trim());
          const isTargeted = packageMatchesTarget(
            pkg,
            targetedIdSet,
            newStatus,
          );

          if (isTargeted && newStatus !== "DELIVERED") {
            targetedPackageCount += 1;
          }

          if (!isTargeted) {
            finalPackages.push(pkg);
            return;
          }

          if (newStatus === "DELIVERED" && isDeliveryTrip) {
            const pieceId = getPackageIdentity(pkg);
            const loadedBy = String(pkg.loadedByCheckerId || "").trim();
            if (
              loadedBy &&
              loadedBy !== String(actorUid) &&
              (!usercode || loadedBy !== String(usercode))
            ) {
              throw new HttpsError(
                "failed-precondition",
                `Package ${pieceId} is on another checker's van and cannot be delivered by you.`,
              );
            }
          }

          if (newStatus === "LOADED" && isDeliveryTrip && isLoadingAction) {
            const pieceId = getPackageIdentity(pkg);
            const loadedBy = String(pkg.loadedByCheckerId || "").trim();
            if (
              loadedBy &&
              loadedBy !== String(actorUid) &&
              (!usercode || loadedBy !== String(usercode))
            ) {
              throw new HttpsError(
                "failed-precondition",
                `Package ${pieceId} is already with another checker.`,
              );
            }
          }

          const quantity = Math.max(normalizeQty(pkg.quantity, 1), 1);
          let loadedQty = clamp(normalizeQty(pkg.loadedQty, 0), 0, quantity);
          let receivedQty = clamp(
            normalizeQty(pkg.receivedQty, 0),
            0,
            quantity,
          );
          let missingQty = clamp(normalizeQty(pkg.missingQty, 0), 0, quantity);
          let damagedQty = clamp(normalizeQty(pkg.damagedQty, 0), 0, quantity);
          const specificQty =
            typeof manualQty === "object" && manualQty !== null
              ? identities
                  .map((id) => manualQty[id])
                  .find(
                    (qty) => qty !== undefined && qty !== null && qty !== "",
                  )
              : manualQty;

          if (newStatus === "RECEIVED") {
            const requestedQty =
              specificQty !== undefined &&
              specificQty !== null &&
              specificQty !== ""
                ? clamp(normalizeQty(specificQty, 0), 0, loadedQty)
                : loadedQty;

            loadedQty = clamp(loadedQty - requestedQty, 0, quantity);
            receivedQty = clamp(receivedQty + requestedQty, 0, quantity);
            missingQty = 0;
            damagedQty = 0;

            const updatedPkg = {
              ...pkg,
              loadedQty,
              receivedQty,
              missingQty,
              damagedQty,
              currentTripId: loadedQty > 0 ? pkg.currentTripId || tripId : null,
              loadedOnTrip: loadedQty > 0 ? pkg.loadedOnTrip || tripId : null,
              updatedAt: nowIso,
              updatedBy: name,
              remarks: remarks || pkg.remarks || null,
            };

            const unloadedStatus =
              loadedQty > 0
                ? derivePackageStatus(updatedPkg)
                : resolveHubUnloadStatus(pkg);

            finalPackages.push({
              ...updatedPkg,
              status: unloadedStatus,
              ...(loadedQty === 0
                ? {
                    currentTripId: null,
                    loadedOnTrip: null,
                    ...(tripId ? { hubReceivedOnTrip: tripId } : {}),
                    ...(unloadedStatus === PACKAGE_STATUS.ARRIVED_AT_ODIONGAN
                      ? {
                          custodyOwnerType: "WAREHOUSE",
                          custodyOwnerId: ODIONGAN_WAREHOUSE,
                          hubReceivedAt: pkg.hubReceivedAt || nowIso,
                          receivedQty: Math.max(receivedQty, quantity),
                        }
                      : {}),
                  }
                : tripId
                  ? { hubReceivedOnTrip: tripId }
                  : {}),
            });
            return;
          } else if (newStatus === "LOADED") {
            const remainingQty = Math.max(quantity - loadedQty, 0);
            const requestedQty =
              specificQty !== undefined &&
              specificQty !== null &&
              specificQty !== ""
                ? clamp(normalizeQty(specificQty, 0), 0, remainingQty)
                : remainingQty;

            const packageTripId = pkg.currentTripId || pkg.loadedOnTrip || null;

            const linehaulBlock = evaluatePackageLinehaulLoad(pkg, tripId, {
              isDeliveryTrip,
            });
            if (linehaulBlock && linehaulBlock !== "ALREADY_LOADED") {
              throw new HttpsError("failed-precondition", linehaulBlock);
            }
            if (linehaulBlock === "ALREADY_LOADED") {
              throw new HttpsError(
                "failed-precondition",
                `Package ${getPackageIdentity(pkg)} is already loaded on trip ${tripId}.`,
              );
            }

            if (tripId && packageTripId === tripId && remainingQty <= 0) {
              throw new HttpsError(
                "failed-precondition",
                `Package ${getPackageIdentity(pkg)} is already loaded on trip ${tripId}.`,
              );
            }

            if (
              tripId &&
              requestedQty > 0 &&
              loadedQty === 0 &&
              requestedQty < quantity
            ) {
              const remainingPkg = {
                ...pkg,
                quantity: quantity - requestedQty,
                loadedQty: 0,
                receivedQty: 0,
                missingQty: 0,
                damagedQty: 0,
                currentTripId: null,
                loadedOnTrip: null,
                status: PACKAGE_STATUS.RECEIVED_AT_DIVISORIA,
                updatedAt: nowIso,
                updatedBy: name,
                remarks: remarks || pkg.remarks || null,
              };
              const splitIdentity = nextPackageId(pkg, [
                ...oldNormalizedPackages,
                ...finalPackages,
              ]);
              const loadedPkg = {
                ...pkg,
                ...splitIdentity,
                quantity: requestedQty,
                loadedQty: requestedQty,
                receivedQty: 0,
                missingQty: 0,
                damagedQty: 0,
                currentTripId: tripId,
                loadedOnTrip: tripId,
                loadedAt: nowIso,
                loadedBy: name,
                loadedByRole: role || null,
                loadedByUid: actorUid || null,
                loadedAtLocation:
                  location || oldData.origin || oldData.originCode || null,
                splitFromPackageId: getPackageIdentity(pkg),
                status: shouldPromoteReadyForDelivery
                  ? PACKAGE_STATUS.OUT_FOR_DELIVERY
                  : isDeliveryTrip
                    ? resolveDeliveryVehicleLoadedStatus()
                    : resolveLinehaulLoadedStatus(),
                updatedAt: nowIso,
                updatedBy: name,
                remarks: remarks || pkg.remarks || null,
              };

              finalPackages.push(remainingPkg, loadedPkg);
              return;
            }

            loadedQty = clamp(loadedQty + requestedQty, 0, quantity);
            missingQty = 0;
            damagedQty = 0;
          } else if (newStatus === "OUT_FOR_DELIVERY") {
            const remainingQty = Math.max(quantity - loadedQty, 0);
            const requestedQty =
              specificQty !== undefined &&
              specificQty !== null &&
              specificQty !== ""
                ? clamp(normalizeQty(specificQty, 0), 0, remainingQty)
                : remainingQty;

            loadedQty = clamp(loadedQty + requestedQty, 0, quantity);
            missingQty = 0;
            damagedQty = 0;
          } else if (newStatus === "DELIVERED") {
            const remainingQty = Math.max(quantity - receivedQty, 0);
            const deliverableQty =
              loadedQty > 0 ? Math.min(loadedQty, remainingQty) : remainingQty;
            const requestedQty =
              specificQty !== undefined &&
              specificQty !== null &&
              specificQty !== ""
                ? clamp(normalizeQty(specificQty, 0), 0, deliverableQty)
                : deliverableQty;

            receivedQty = clamp(receivedQty + requestedQty, 0, quantity);
            loadedQty = clamp(loadedQty - requestedQty, 0, quantity);
            missingQty = 0;
            damagedQty = 0;
          } else if (newStatus === "MISSING" || newStatus === "DAMAGED") {
            const issueableQty = isLoadingAction
              ? Math.max(quantity - loadedQty - missingQty - damagedQty, 0)
              : isOffloadingAction
                ? loadedQty
                : loadedQty || quantity;
            const requestedQty =
              specificQty !== undefined &&
              specificQty !== null &&
              specificQty !== ""
                ? clamp(normalizeQty(specificQty, 0), 0, issueableQty)
                : issueableQty;

            loadedQty = clamp(loadedQty - requestedQty, 0, quantity);
            if (receivedQty > loadedQty) {
              receivedQty = loadedQty;
            }

            if (newStatus === "MISSING") {
              missingQty = clamp(requestedQty, 0, quantity);
              damagedQty = 0;
            } else {
              damagedQty = clamp(requestedQty, 0, quantity);
              missingQty = 0;
            }
          }

          const updatedPkg = {
            ...pkg,
            loadedQty,
            receivedQty,
            missingQty,
            damagedQty,
            currentTripId:
              tripId && loadedQty > 0
                ? tripId
                : loadedQty > 0
                  ? pkg.currentTripId || null
                  : null,
            loadedOnTrip:
              tripId && loadedQty > 0
                ? tripId
                : loadedQty > 0
                  ? pkg.loadedOnTrip || null
                  : null,
            updatedAt: nowIso,
            updatedBy: name,
            remarks: remarks || pkg.remarks || null,
          };

          let derivedStatus =
            newStatus === "OUT_FOR_DELIVERY"
              ? "OUT_FOR_DELIVERY"
              : shouldPromoteReadyForDelivery
                ? "OUT_FOR_DELIVERY"
                : derivePackageStatus(updatedPkg);

          if (newStatus === "DELIVERED" && isDeliveryTrip) {
            derivedStatus = "DELIVERED";
          }

          finalPackages.push({
            ...updatedPkg,
            status: derivedStatus,
            ...(newStatus === "LOADED"
              ? {
                  loadedAt: pkg.loadedAt || nowIso,
                  loadedBy: pkg.loadedBy || name,
                  loadedByRole: pkg.loadedByRole || role || null,
                  loadedByUid: pkg.loadedByUid || actorUid || null,
                  loadedAtLocation:
                    pkg.loadedAtLocation ||
                    location ||
                    oldData.origin ||
                    oldData.originCode ||
                    null,
                }
              : {}),
            ...(newStatus === "DELIVERED" && isDeliveryTrip
              ? {
                  loadedQty: 0,
                  custodyOwnerType: "CUSTOMER",
                  custodyOwnerId: null,
                  deliveredAt: nowIso,
                  deliveredByCheckerId: actorUid,
                  deliveredByCheckerName: name,
                }
              : {}),
          });
        });

      } else {
        finalPackages = newPackagesArray.map((pkg) => {
          const normalized = normalizePackage(pkg);
          return {
            ...normalized,
            status: derivePackageStatus(normalized),
          };
        });
      }

      // -----------------------------
      // 4. RECALCULATE TOTALS
      // -----------------------------
      const oldTotalQty = sumTotalQty(oldNormalizedPackages);
      const newTotalQty = sumTotalQty(finalPackages);

      const oldLoadedQty = sumLoadedQty(oldNormalizedPackages);
      const newLoadedQty = sumLoadedQty(finalPackages);

      const oldReceivedQty = sumReceivedQty(oldNormalizedPackages);
      const newReceivedQty = sumReceivedQty(finalPackages);

      const oldMissingQty = sumMissingQty(oldNormalizedPackages);
      const newMissingQty = sumMissingQty(finalPackages);

      const oldDamagedQty = sumDamagedQty(oldNormalizedPackages);
      const newDamagedQty = sumDamagedQty(finalPackages);

      const pendingQty = Math.max(
        newTotalQty -
          newLoadedQty -
          newReceivedQty -
          newMissingQty -
          newDamagedQty,
        0,
      );
      const totalRows = finalPackages.length;

      const deltaTotalQty = newTotalQty - oldTotalQty;
      const deltaLoadedQty = newLoadedQty - oldLoadedQty;
      const deltaReceivedQty = newReceivedQty - oldReceivedQty;
      const deltaMissingQty = newMissingQty - oldMissingQty;
      const deltaDamagedQty = newDamagedQty - oldDamagedQty;
      const oldPendingQty = Math.max(
        oldTotalQty -
          oldLoadedQty -
          oldReceivedQty -
          oldMissingQty -
          oldDamagedQty,
        0,
      );
      const deltaPendingQty = pendingQty - oldPendingQty;

      const shipmentStatus = deriveMasterShipmentStatus(finalPackages, {
        totals: {
          totalQty: newTotalQty,
          receivedQty: newReceivedQty,
          loadedQty: newLoadedQty,
          missingQty: newMissingQty,
          damagedQty: newDamagedQty,
        },
        shouldPromoteOutForDelivery:
          (shouldPromoteReadyForDelivery || wasOutForDelivery) &&
          newLoadedQty >= newTotalQty &&
          newTotalQty > 0,
        previousStatus: oldShipmentStatus,
      });
      const packageBreakdown = computePackageBreakdown(finalPackages);

      const packageBarcodes = finalPackages
        .map((pkg) => getPackageIdentity(pkg))
        .filter(Boolean);
      const activeTripIds = [
        ...new Set(
          finalPackages
            .map((pkg) => pkg.currentTripId || pkg.loadedOnTrip || null)
            .filter(Boolean)
            .map(String),
        ),
      ];
      const existingTripBarcodeSet = new Set(
        (
          (tripShipmentSnap?.exists
            ? tripShipmentSnap.data()?.packageBarcodes
            : []) || []
        )
          .filter(Boolean)
          .map(String),
      );
      if (
        tripId &&
        existingTripBarcodeSet.size > 0 &&
        !activeTripIds.includes(tripId)
      ) {
        activeTripIds.push(tripId);
      }
      const singleCurrentTripId =
        activeTripIds.length === 1 ? activeTripIds[0] : null;
      const scannedPackageIdSet = new Set(
        (Array.isArray(packageIds) ? packageIds : [])
          .filter(Boolean)
          .map((id) => String(id).trim()),
      );
      const tripPackages = tripId
        ? finalPackages.filter((pkg) =>
            packageLinkedToTrip(pkg, tripId, existingTripBarcodeSet, {
              scannedPackageIds: isHubReceive ? scannedPackageIdSet : new Set(),
            }),
          )
        : finalPackages;
      const tripPackageBarcodes = [
        ...new Set([
          ...tripPackages.map((pkg) => getPackageIdentity(pkg)).filter(Boolean),
          ...(isHubReceive ? [...scannedPackageIdSet] : []),
        ]),
      ];
      const tripTotalQty = sumTotalQty(tripPackages);
      const tripLoadedQty = sumLoadedQty(tripPackages);
      const tripReceivedQty = sumReceivedQty(tripPackages);
      const tripMissingQty = sumMissingQty(tripPackages);
      const tripDamagedQty = sumDamagedQty(tripPackages);
      // -----------------------------
      // 5. WRITES
      // -----------------------------
      tx.update(shipmentRef, {
        packages: finalPackages,
        packageBarcodes,
        currentTripIds: activeTripIds,
        currentTripId: singleCurrentTripId,
        status: shipmentStatus,
        packageBreakdown,

        "totals.totalItems": totalRows, // row count only
        "totals.totalContentQty": newTotalQty, // actual quantity
        "totals.loaded": newLoadedQty,
        "totals.received": newReceivedQty,
        "totals.delivered": packageBreakdown.delivered,
        "totals.missing": newMissingQty,
        "totals.damaged": newDamagedQty,
        "totals.pending": pendingQty,

        updatedAt: nowServer,
        updatedBy: name,
        ...(location ? { lastLocation: location } : {}),
        ...(shipmentStatus === "COMPLETED"
          ? {
              availableForDelivery: false,
              currentLocationState: "DELIVERED",
              completedAt: nowServer,
            }
          : {}),
        statusHistory: FieldValue.arrayUnion({
          status: shipmentStatus,
          at: new Date(),
          by: name,
          note:
            remarks ||
            `Package update: ${newLoadedQty} loaded / ${newReceivedQty} received / ${newMissingQty} missing / ${newDamagedQty} damaged / ${newTotalQty} total`,
          location: location || null,
        }),
      });

      if (shipmentStatus === "COMPLETED") {
        const manifestId = String(oldData.deliveryManifestId || "").trim();
        if (manifestId) {
          tx.set(
            db.collection("delivery_manifests").doc(manifestId),
            {
              status: "COMPLETED",
              completedAt: nowServer,
              updatedAt: nowServer,
              updatedBy: name,
            },
            { merge: true },
          );
        }
      }

      if (tripId && tripRef && tripShipmentRef) {
        const oldTripShipment = tripShipmentSnap?.exists
          ? tripShipmentSnap.data() || {}
          : {};
        const oldTripTotalQty = normalizeQty(oldTripShipment.totalItems, 0);
        const oldTripLoadedQty = normalizeQty(oldTripShipment.loadedCount, 0);
        const oldTripReceivedQty = normalizeQty(
          oldTripShipment.receivedCount || oldTripShipment.deliveredCount,
          0,
        );
        const oldTripMissingQty = normalizeQty(oldTripShipment.missingCount, 0);
        const oldTripDamagedQty = normalizeQty(oldTripShipment.damagedCount, 0);
        const oldTripPendingQty = normalizeQty(oldTripShipment.pendingCount, 0);
        const nextTripTotalItems = Math.max(
          oldTripTotalQty,
          tripTotalQty,
          tripLoadedQty + tripReceivedQty + tripMissingQty + tripDamagedQty,
          tripPackageBarcodes.length,
        );
        const nextTripPendingQty = Math.max(
          nextTripTotalItems -
            tripLoadedQty -
            tripReceivedQty -
            tripMissingQty -
            tripDamagedQty,
          0,
        );
        const deltaTripTotalQty = nextTripTotalItems - oldTripTotalQty;
        const deltaTripLoadedQty = tripLoadedQty - oldTripLoadedQty;
        const deltaTripReceivedQty = tripReceivedQty - oldTripReceivedQty;
        const deltaTripMissingQty = tripMissingQty - oldTripMissingQty;
        const deltaTripDamagedQty = tripDamagedQty - oldTripDamagedQty;
        const deltaTripPendingQty = nextTripPendingQty - oldTripPendingQty;

        tx.update(tripShipmentRef, {
          status: shipmentStatus,
          totalItems: nextTripTotalItems,
          pendingCount: nextTripPendingQty,
          loadedCount: tripLoadedQty,
          deliveredCount: tripReceivedQty,
          receivedCount: tripReceivedQty,
          missingCount: tripMissingQty,
          damagedCount: tripDamagedQty,
          packageBarcodes: tripPackageBarcodes,
          updatedAt: nowServer,
          updatedBy: name,
        });

        const tripUpdate = {
          updatedAt: nowServer,
          updatedBy: name,
        };

        if (deltaTripTotalQty !== 0) {
          tripUpdate.totalItems = FieldValue.increment(deltaTripTotalQty);
        }

        if (deltaTripLoadedQty !== 0) {
          tripUpdate.totalLoaded = FieldValue.increment(deltaTripLoadedQty);
        }

        if (deltaTripReceivedQty !== 0) {
          tripUpdate.totalArrived = FieldValue.increment(deltaTripReceivedQty);
          if (isDeliveryTrip) {
            tripUpdate.totalDelivered =
              FieldValue.increment(deltaTripReceivedQty);
          }
        }

        if (deltaTripMissingQty !== 0) {
          tripUpdate.totalMissing = FieldValue.increment(deltaTripMissingQty);
        }

        if (deltaTripDamagedQty !== 0) {
          tripUpdate.totalDamaged = FieldValue.increment(deltaTripDamagedQty);
        }

        if (deltaTripPendingQty !== 0) {
          tripUpdate.itemPending = FieldValue.increment(deltaTripPendingQty);
        }

        if (
          deltaTripLoadedQty > 0 &&
          (isLoadingAction || String(newStatus || "").toUpperCase() === "LOADED")
        ) {
          const currentTripStatus = String(tripData.status || "").toUpperCase();
          if (["CREATED", "ASSIGNED"].includes(currentTripStatus)) {
            tripUpdate.status = "LOADING";
          }
        }

        completedTripId = tripId;
        shouldTryAutoCompleteTrip = true;
        tx.update(tripRef, tripUpdate);
      }

      const targetedTrackingNumbers = isScannerUpdate
        ? packageIds
            .filter((id) => typeof id === "string" && id.trim())
            .map((id) => id.trim())
        : finalPackages
            .map((p) => p.packageId || p.trackingNumber || null)
            .filter(Boolean);

      writePackageActionLog({
        db,
        tx,
        collection: "admin_logs",
        action: "UPDATE_SHIPMENT_PACKAGES",
        actorId: uid || authUid,
        actorName: name || null,
        actorRole: role || null,
        packageId:
          targetedTrackingNumbers.length === 1
            ? targetedTrackingNumbers[0]
            : null,
        trackingNumber:
          targetedTrackingNumbers.length === 1
            ? targetedTrackingNumbers[0]
            : null,
        shipmentId,
        tripId,
        createdAt: nowServer,
        details: {
          status: shipmentStatus,
          affectedPackages: targetedTrackingNumbers,
          totalRows,
          totalQty: newTotalQty,
          loadedQty: newLoadedQty,
          receivedQty: newReceivedQty,
          missingQty: newMissingQty,
          damagedQty: newDamagedQty,
          pendingQty,
          source: isScannerUpdate ? "SCANNER" : "WEB_MODAL",
          scanAction: scanAction || null,
          remarks: remarks || "No remarks provided",
          location: location || null,
        },
      });

      if (isScannerUpdate) {
        const eventType = resolveEventTypeForScannerStatus(newStatus, {
          tripId,
          previousStatus: oldShipmentStatus,
        });
        if (eventType) {
          const tripContext = extractTripEventContext(tripData, tripId);
          const isManagerActor = ["admin", "manager"].includes(
            String(role || "").toLowerCase(),
          );

          pendingEvent = {
            shipmentId,
            eventType,
            pieceId:
              targetedTrackingNumbers.length === 1
                ? targetedTrackingNumbers[0]
                : null,
            ...tripContext,
            checkerId: !isManagerActor ? uid || authUid || null : null,
            checkerName: !isManagerActor ? name || null : null,
            warehouseManagerId: isManagerActor ? uid || authUid || null : null,
            warehouseManagerName: isManagerActor ? name || null : null,
            location: location || null,
            createdBy: uid || authUid || null,
            createdByRole: role || null,
            remarks: remarks || null,
            source: isScannerUpdate ? "SCANNER" : "WEB_MODAL",
          };
        }
      }

      if (
        isScannerUpdate &&
        String(newStatus || "").toUpperCase() === "OUT_FOR_DELIVERY" &&
        !wasOutForDelivery &&
        !wasShipmentOutForDelivery(oldShipmentStatus) &&
        !wasShipmentOutForDelivery(oldTripShipmentStatus)
      ) {
        outForDeliveryNotificationContext = {
          shipment: {
            ...oldData,
            packages: finalPackages,
            status: shipmentStatus,
            packageBreakdown,
            currentTripId: singleCurrentTripId,
            currentTripIds: activeTripIds,
          },
          tripId:
            tripId ||
            singleCurrentTripId ||
            oldData.currentTripId ||
            oldData.currentTruckTripId ||
            null,
        };
      }

      if (
        isScannerUpdate &&
        String(newStatus || "").toUpperCase() === "DELIVERED" &&
        !wasShipmentDelivered(oldShipmentStatus) &&
        wasShipmentDelivered(shipmentStatus)
      ) {
        deliveredNotificationContext = {
          shipment: {
            ...oldData,
            packages: finalPackages,
            status: shipmentStatus,
            packageBreakdown,
            currentTripId: singleCurrentTripId,
            currentTripIds: activeTripIds,
          },
          tripId:
            tripId ||
            singleCurrentTripId ||
            oldData.currentTripId ||
            oldData.currentTruckTripId ||
            null,
        };
      }

    });

    if (completedTripId && shouldTryAutoCompleteTrip) {
      try {
        await tryAutoCompleteTrip(completedTripId, {
          actorId: uid || authUid,
          actorName: name,
          actorRole: role,
          source: "UPDATE_SHIPMENT_PACKAGES",
        });
      } catch (autoCompleteError) {
        console.error("Auto-complete trip failed:", autoCompleteError);
      }
    }

    if (pendingEvent) {
      try {
        await writeShipmentEvent({
          db,
          event: pendingEvent,
        });
      } catch (eventError) {
        console.error("Shipment event write failed:", eventError);
      }
    }

    let customerNotificationResult = null;
    if (outForDeliveryNotificationContext) {
      try {
        customerNotificationResult =
          await sendAutomaticShipmentLifecycleNotification({
            db,
            shipment: outForDeliveryNotificationContext.shipment,
            shipmentId,
            tripId: outForDeliveryNotificationContext.tripId,
            notificationType: CUSTOMER_NOTIFICATION_TYPES.OUT_FOR_DELIVERY,
            source: "SCANNER_OUT_FOR_DELIVERY",
            channels: { sms: true, email: false, push: true },
            actor: { uid: actorUid, name, role },
          });
      } catch (notificationError) {
        console.error(
          "[updateShipmentPackages] Out-for-delivery notification failed:",
          notificationError,
        );
      }
    }

    if (deliveredNotificationContext) {
      try {
        const deliveredResult = await sendAutomaticShipmentLifecycleNotification({
          db,
          shipment: deliveredNotificationContext.shipment,
          shipmentId,
          tripId: deliveredNotificationContext.tripId,
          notificationType: CUSTOMER_NOTIFICATION_TYPES.DELIVERED,
          source: "SCANNER_DELIVERED",
          channels: { sms: true, email: false, push: true },
          actor: { uid: actorUid, name, role },
        });
        customerNotificationResult = deliveredResult;
      } catch (notificationError) {
        console.error(
          "[updateShipmentPackages] Delivered notification failed:",
          notificationError,
        );
      }
    }

    return {
      success: true,
      customerNotification: customerNotificationResult,
    };
  },
);
