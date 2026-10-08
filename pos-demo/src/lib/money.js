// All amounts are stored as integer centavos (₱125.50 = 12550).

const fmt = new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** @param {number} c centavos */
export const peso = (c) => `₱${fmt.format((c || 0) / 100)}`;

/** Whole pesos, for tight spaces like product tiles. */
export const pesoShort = (c) => {
  const v = (c || 0) / 100;
  return `₱${Number.isInteger(v) ? v.toLocaleString('en-PH') : fmt.format(v)}`;
};

/** @param {string|number} s pesos typed by a person */
export const toCentavos = (s) => Math.round((parseFloat(String(s).replace(/,/g, '')) || 0) * 100);

export const fromCentavos = (c) => ((c || 0) / 100).toFixed(2);
