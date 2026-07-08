import {
  canonicalMunicipalityLabel,
  normalizeMunicipalityKey,
  resolveShipmentMunicipality,
} from '../../../utility/deliveryMunicipalities.js';

function normalizeCheckerMunicipalities(checker = {}) {
  const assigned = [];
  const candidates = Array.isArray(checker)
    ? checker
    : [checker?.assignedMunicipality, checker?.assignedMunicipalities];

  candidates.forEach((entry) => {
    if (typeof entry === 'string') {
      assigned.push(entry);
      return;
    }

    if (Array.isArray(entry)) {
      assigned.push(...entry);
    }
  });

  return [...new Set(assigned.map((entry) => canonicalMunicipalityLabel(entry)).filter(Boolean))];
}

function isShipmentInCheckerMunicipalities(shipment = {}, assignedMunicipalities = []) {
  const municipality = resolveShipmentMunicipality(shipment);
  if (!municipality) return false;

  const normalizedAssignments = normalizeCheckerMunicipalities({ assignedMunicipalities });
  const targetKey = normalizeMunicipalityKey(municipality);

  return normalizedAssignments.some((entry) => normalizeMunicipalityKey(entry) === targetKey);
}

function getCheckerMunicipalityFilter(assignedMunicipalities = []) {
  const normalized = normalizeCheckerMunicipalities({ assignedMunicipalities });
  if (normalized.length === 0) return null;
  if (normalized.length === 1) {
    return { field: 'municipality', operator: '==', value: normalized[0] };
  }
  return { field: 'municipality', operator: 'in', value: normalized };
}

async function getCheckerAccessContext(request) {
  const { NextResponse } = await import('next/server');
  const { adminAuth, adminDb } = await import('@/lib/firebase-admin');
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    return {
      error: NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 },
      ),
    };
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    const profileSnap = await adminDb.collection('users').doc(decodedToken.uid).get();
    const profile = profileSnap.exists ? profileSnap.data() || {} : {};
    const assignedMunicipalities = normalizeCheckerMunicipalities(profile);

    if (String(profile?.role || '').toLowerCase() !== 'checker') {
      return {
        error: NextResponse.json(
          { success: false, message: 'Forbidden' },
          { status: 403 },
        ),
      };
    }

    if (!assignedMunicipalities.length) {
      return {
        error: NextResponse.json(
          {
            success: false,
            message: 'This checker account has no assigned municipality.',
          },
          { status: 403 },
        ),
      };
    }

    return {
      uid: decodedToken.uid,
      profile,
      assignedMunicipalities,
    };
  } catch (error) {
    return {
      error: NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 },
      ),
    };
  }
}

export {
  normalizeCheckerMunicipalities,
  isShipmentInCheckerMunicipalities,
  getCheckerMunicipalityFilter,
  getCheckerAccessContext,
};
