"use strict";

function financeSourceVersionIncrement(currentValue) {
  const current = Number(currentValue);
  return Number.isSafeInteger(current) && current >= 1 ? 1 : 2;
}

module.exports = { financeSourceVersionIncrement };
