const Product = require('../models/productModel');

function hasVariants(product) {
  return Array.isArray(product.variants) && product.variants.length > 0;
}

function getVariant(product, id) {
  return hasVariants(product)
    ? product.variants.find(variant => String(variant._id) === String(id || ''))
    : null;
}

function totalStock(product) {
  return hasVariants(product)
    ? product.variants.reduce((sum, variant) => sum + Number(variant.stockQuantity || 0), 0)
    : Number(product.stockQuantity || 0);
}

function parseLifecycleVariants(input, parentSku, previousVariants = []) {
  const result = [];
  const stages = [
    ['Adult', 'Adult', 'ADT'],
    ['Juvenile', 'Juvenile', 'JUV']
  ];

  for (const [key, label, suffix] of stages) {
    if (input[`variant${key}Enabled`] !== 'on') continue;

    const rawPrice = String(input[`variant${key}Price`] ?? '').trim();
    const rawStock = String(input[`variant${key}Stock`] ?? '').trim();
    const rawSale = String(input[`variant${key}Sale`] ?? '').trim();
    const price = Number(rawPrice);
    const stockQuantity = Number(rawStock);

    if (
      !rawPrice || !Number.isFinite(price) || price <= 0 ||
      !rawStock || !Number.isInteger(stockQuantity) || stockQuantity < 0
    ) {
      throw new Error(`${label}: enter a price greater than zero and a nonnegative whole-number stock quantity.`);
    }

    const salePrice = rawSale ? Number(rawSale) : undefined;
    if (rawSale && (!Number.isFinite(salePrice) || salePrice <= 0 || salePrice >= price)) {
      throw new Error(`${label}: sale price must be greater than zero and below regular price.`);
    }

    const previous = previousVariants.find(variant =>
      String(variant.label).toLowerCase() === label.toLowerCase()
    );
    const sku = previous?.sku || `${parentSku}-${suffix}`;

    result.push({
      label,
      sku,
      price,
      stockQuantity,
      ...(salePrice ? { salePrice } : {}),
      ...(previous ? { _id: previous._id } : {})
    });
  }

  // When Juvenile is selected alone, the main product represents Adult.
  if (result.some(variant => variant.label === 'Juvenile') &&
      !result.some(variant => variant.label === 'Adult')) {
    const previous = previousVariants.find(variant =>
      String(variant.label).toLowerCase() === 'adult'
    );
    const price = Number(input.price);
    const stockQuantity = previous
      ? Number(previous.stockQuantity)
      : Number(input.stockQuantity);
    const rawSale = String(input.salePrice ?? '').trim();
    const salePrice = rawSale ? Number(rawSale) : undefined;

    if (!Number.isFinite(price) || price <= 0 ||
        !Number.isInteger(stockQuantity) || stockQuantity < 0) {
      throw new Error('Adult: enter a valid regular product price and stock quantity.');
    }

    result.unshift({
      label: 'Adult',
      sku: previous?.sku || `${parentSku}-ADT`,
      price,
      stockQuantity,
      ...(salePrice && salePrice < price ? { salePrice } : {}),
      ...(previous ? { _id: previous._id } : {})
    });
  }

  // Preserve historic variants (other than Adult/Juvenile) when editing.
  for (const previous of previousVariants) {
    if (!['adult', 'juvenile'].includes(String(previous.label).toLowerCase())) {
      result.push(previous.toObject ? previous.toObject() : previous);
    }
  }
  return result;
}

async function validateUniqueVariants(variants, productId) {
  if (!variants.length) return;

  const skus = variants.map(variant => variant.sku);
  if (new Set(skus).size !== skus.length) {
    throw new Error('Variant SKUs must be unique.');
  }

  const query = {
    $or: [
      { sku: { $in: skus } },
      { 'variants.sku': { $in: skus } }
    ]
  };
  if (productId) query._id = { $ne: productId };

  if (await Product.exists(query)) {
    throw new Error('A variant SKU is already used by another product.');
  }
}

module.exports = {
  hasVariants,
  getVariant,
  totalStock,
  parseLifecycleVariants,
  validateUniqueVariants
};
