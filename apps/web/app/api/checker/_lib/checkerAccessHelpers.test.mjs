import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeCheckerMunicipalities,
  isShipmentInCheckerMunicipalities,
  getCheckerMunicipalityFilter,
} from './checkerAccessHelpers.mjs';

test('normalizes a checker municipality assignment from either a string or array', () => {
  assert.deepEqual(normalizeCheckerMunicipalities({ assignedMunicipality: 'Odiongan' }), ['Odiongan']);
  assert.deepEqual(normalizeCheckerMunicipalities({ assignedMunicipalities: ['Odiongan', 'Calatrava'] }), ['Odiongan', 'Calatrava']);
});

test('matches shipments by canonical municipality labels', () => {
  assert.equal(
    isShipmentInCheckerMunicipalities({ municipality: 'odiongan town proper' }, ['Odiongan']),
    true,
  );
  assert.equal(
    isShipmentInCheckerMunicipalities({ municipality: 'San Andres' }, ['Odiongan']),
    false,
  );
});

test('builds a safe Firestore filter for a single municipality', () => {
  assert.deepEqual(getCheckerMunicipalityFilter(['Odiongan']), { field: 'municipality', operator: '==', value: 'Odiongan' });
});
