// Search product words independently, rather than matching one exact phrase.
const GENERIC_WORDS = new Set(['fish', 'fishes', 'aquarium', 'aquatic', 'live', 'product', 'products']);

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getSearchTerms(input) {
  const terms = String(input || '').trim().slice(0, 100)
    .split(/\s+/).filter(Boolean).slice(0, 6);
  const specific = terms.filter(term => !GENERIC_WORDS.has(term.toLowerCase()));
  return specific.length ? specific : terms;
}

function buildProductSearch(input) {
  const terms = getSearchTerms(input);
  if (!terms.length) return null;
  return {
    $and: terms.map(term => {
      // Common aquarium typo: 'beta' often means 'betta'. Support both.
      const alternatives = term.toLowerCase() === 'beta' ? ['beta', 'betta'] : [term];
      const regex = new RegExp(alternatives.map(escapeRegex).join('|'), 'i');
      return { $or: [
        { title: regex }, { description: regex }, { sku: regex },
        { animalType: regex }, { animalFamily: regex }, { category: regex }
      ] };
    })
  };
}

module.exports = { buildProductSearch, getSearchTerms };
