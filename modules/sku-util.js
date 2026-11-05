const crypto = require('crypto');

const CATEGORY_PREFIXES = Object.freeze({
  'Aquatic Life': 'FISH',
  Plants: 'PLANT',
  Equipment: 'EQUIP',
  Maintenance: 'MAINT'
});

function slugPart(value, fallback = 'ITEM') {
  const cleaned = String(value || '')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-')
    .toUpperCase();

  if (!cleaned) return fallback;
  return cleaned.split('-').filter(Boolean).slice(0, 2).join('-').slice(0, 18);
}

function generateSku({ title, category }) {
  const prefix = CATEGORY_PREFIXES[category] || 'ITEM';
  const productPart = slugPart(title);
  const uniquePart = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}-${productPart}-${uniquePart}`;
}

module.exports = {
  CATEGORY_PREFIXES,
  generateSku
};
