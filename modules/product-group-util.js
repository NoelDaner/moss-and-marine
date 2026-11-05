const TYPE_LABELS = Object.freeze({
  Fish: 'Fish',
  Shrimp: 'Shrimp',
  Snail: 'Snails',
  Other: 'Other Aquatic Life'
});

function normalizeFamily(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function displayFamily(value) {
  const cleaned = String(value || '').trim().replace(/\s+/g, ' ');
  return cleaned ? cleaned.replace(/\b[a-z]/g, char => char.toUpperCase()) : undefined;
}

// Use saved animal types. Never guess a family from a name or description.
function getProductFamily(product) {
  if (!product || !['Aquatic Life', 'Live Fish'].includes(product.category)) {
    return null;
  }
  return TYPE_LABELS[product.animalType] || 'Unclassified';
}

function groupLiveFish(products) {
  const grouped = {};
  for (const product of products) {
    const parent = getProductFamily(product);
    if (!parent) continue;
    (grouped[parent] ||= []).push(product);
  }

  const order = ['Fish', 'Shrimp', 'Snails', 'Other Aquatic Life', 'Unclassified'];
  return Object.fromEntries(
    Object.entries(grouped).sort(([first], [second]) => order.indexOf(first) - order.indexOf(second))
  );
}

module.exports = { getProductFamily, groupLiveFish, normalizeFamily, displayFamily };
