const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeFamily, displayFamily, getProductFamily, groupLiveFish } = require('../modules/product-group-util');
const { generateSku } = require('../modules/sku-util');

test('family comparisons ignore capitalization and extra whitespace', () => {
  assert.equal(normalizeFamily(' Cherry   Shrimp '), normalizeFamily('cherry shrimp'));
  assert.equal(displayFamily(' cherry    shrimp '), 'Cherry Shrimp');
});

test('aquatic products remain grouped by explicit animal type', () => {
  const products = [
    { title: 'Amano', category: 'Aquatic Life', animalType: 'Shrimp', animalFamily: 'Cherry Shrimp' },
    { title: 'Rainbowfish', category: 'Aquatic Life', animalType: 'Fish' },
    { title: 'Plant', category: 'Plants' }
  ];
  assert.equal(getProductFamily(products[0]), 'Shrimp');
  assert.equal(getProductFamily(products[2]), null);
  assert.deepEqual(Object.keys(groupLiveFish(products)), ['Fish', 'Shrimp']);
  assert.equal(groupLiveFish(products).Shrimp[0].title, 'Amano');
});

test('generated SKU has a category prefix and a unique suffix', () => {
  const first = generateSku({ title: 'Amano Shrimp', category: 'Aquatic Life' });
  const second = generateSku({ title: 'Amano Shrimp', category: 'Aquatic Life' });
  assert.match(first, /^FISH-AMANO-SHRIMP-[A-F0-9]{8}$/);
  assert.notEqual(first, second);
});
