const {parseLifecycleVariants, validateUniqueVariants} = require('../modules/variant-util');
// controllers/inventoryController.js
const Product = require('../models/productModel');
const path = require('path');
const { generateSku } = require('../modules/sku-util');
const { buildSpecifications, validateSpecifications } = require('../modules/product-specs-util');
const { groupLiveFish, normalizeFamily, displayFamily } = require('../modules/product-group-util');

const ALLOWED_CATEGORIES = ['Aquatic Life', 'Plants', 'Equipment', 'Maintenance'];
const ANIMAL_TYPES = ['Fish', 'Shrimp', 'Snail', 'Other'];

const { saveProductImage, deleteProductImage } = require('../modules/product-image-storage');
const { buildProductSearch } = require('../modules/product-search-util');

exports.getInventoryPage = async (req, res) => {
    try {
        const showLiveStock = req.query.type === 'live';
        const currentCategory = req.query.category === 'Live Fish' ? 'Aquatic Life' : (req.query.category || (showLiveStock ? 'Aquatic Life' : null));
        const searchTerm = (req.query.q || '').trim();
        const sort = ['featured', 'az', 'newest', 'price-low', 'price-high'].includes(req.query.sort)
            ? req.query.sort
            : 'featured';
        const inStockOnly = req.query.inStock === '1';
        const onSaleOnly = req.query.onSale === '1';
        const familyFilter = (req.query.family || '').trim();
        const subfamilyFilter = (req.query.subfamily || '').trim();

        const filters = [];

        if (showLiveStock) filters.push({ category: { $in: ['Aquatic Life', 'Live Fish'] } });
        if (currentCategory && !ALLOWED_CATEGORIES.includes(currentCategory)) return res.status(400).render('error', { title: 'Invalid Category', message: 'Please choose a valid shop category.' });
        if (currentCategory) filters.push({ category: currentCategory === 'Aquatic Life' ? { $in: ['Aquatic Life', 'Live Fish'] } : currentCategory });
        if (inStockOnly) filters.push({ stockQuantity: { $gt: 0 } });
        if (onSaleOnly) filters.push({ salePrice: { $exists: true, $ne: null } });

        if (searchTerm) {
            filters.push(buildProductSearch(searchTerm));
        }

        const query = filters.length > 0 ? { $and: filters } : {};
        const sortMap = {
            featured: { featured: -1, category: 1, title: 1 },
            az: { title: 1 },
            newest: { createdAt: -1, title: 1 },
            'price-low': { salePrice: 1, price: 1, title: 1 },
            'price-high': { salePrice: -1, price: -1, title: 1 }
        };

        let products = await Product.find(query).sort(sortMap[sort]);

        const productsByCategory = {};
        products.forEach(product => {
            const bucket = product.category === 'Live Fish' ? 'Aquatic Life' : product.category;
            if (!productsByCategory[bucket]) productsByCategory[bucket] = [];
            productsByCategory[bucket].push(product);
        });

        const liveFishGroups = currentCategory === 'Aquatic Life' || (!currentCategory && productsByCategory['Aquatic Life'])
            ? groupLiveFish(products.filter(product => ['Aquatic Life', 'Live Fish'].includes(product.category)))
            : {};

        let visibleLiveFishGroups = liveFishGroups;
        if (familyFilter) {
            const selected = Object.keys(liveFishGroups).find(key => normalizeFamily(key) === normalizeFamily(familyFilter));
            visibleLiveFishGroups = selected ? { [selected]: liveFishGroups[selected] } : {};
        }
        // Subfamilies are nested within the chosen animal type, never separate top-level groups.
        const subfamilies = {};
        for (const [parent, items] of Object.entries(liveFishGroups)) {
            const seen = new Map();
            items.forEach(item => {
                if (item.animalFamily && normalizeFamily(item.animalFamily) !== normalizeFamily(parent)) {
                    const key = normalizeFamily(item.animalFamily);
                    if (!seen.has(key)) seen.set(key, displayFamily(item.animalFamily));
                }
            });
            subfamilies[parent] = [...seen.values()].sort((a,b) => a.localeCompare(b));
        }
        if (subfamilyFilter) {
            visibleLiveFishGroups = Object.fromEntries(Object.entries(visibleLiveFishGroups).map(([parent, items]) => [
                parent, items.filter(item => normalizeFamily(item.animalFamily) === normalizeFamily(subfamilyFilter))
            ]).filter(([, items]) => items.length));
        }

        res.render('inventory', {
            title: showLiveStock ? 'Live Stock - Moss and Marine' : 'Products - Moss and Marine',
            products,
            productsByCategory,
            liveFishGroups,
            visibleLiveFishGroups,
            showLiveStock,
            currentCategory,
            searchTerm,
            sort,
            inStockOnly,
            onSaleOnly,
            familyFilter,
            subfamilyFilter,
            subfamilies
        });
    } catch (error) {
        console.error('Error fetching inventory:', error);
        res.status(500).render('error', {
            title: 'Error - Moss and Marine',
            message: 'An error occurred while loading products'
        });
    }
};


exports.getProductDetailPage = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).render('error', {
                title: 'Product Not Found - Moss and Marine',
                message: 'That product could not be found.'
            });
        }

        res.render('inventory/detail', {
            title: `${product.title} - Moss and Marine`,
            product
        });
    } catch (error) {
        console.error('Error fetching product details:', error);
        res.status(500).render('error', {
            title: 'Error - Moss and Marine',
            message: 'An error occurred while loading this product.'
        });
    }
};

exports.getProductListPage = async (req, res) => {
  if (!req.session.user) {
      return res.status(401).render('error', {
          title: 'Unauthorized - Moss and Marine',
          message: 'You are not authorized to view this page.'
      });
  }

  if (req.session.user.role !== 'data-entry-clerk') {
      return res.status(401).render('error', {
          title: 'Unauthorized - Moss and Marine',
          message: 'You are not authorized to view this page.'
      });
  }

  try {
      const category = ALLOWED_CATEGORIES.includes(req.query.category) ? req.query.category : '';
      const status = ['featured', 'live', 'in-stock', 'sold-out', 'low', 'juvenile'].includes(req.query.status) ? req.query.status : '';
      const group = (req.query.group || '').trim().slice(0, 80);
      const search = (req.query.q || '').trim().slice(0, 100);
      const sort = ['category', 'title', 'newest', 'stock-low'].includes(req.query.sort) ? req.query.sort : 'category';
      const classifications = await Product.find({ category: { $in: ['Aquatic Life', 'Live Fish'] } })
          .select('animalType animalFamily').lean();
      const familyByType = new Map();
      for (const item of classifications) {
          if (!ANIMAL_TYPES.includes(item.animalType)) continue;
          if (!familyByType.has(item.animalType)) familyByType.set(item.animalType, new Map());
          if (item.animalFamily) {
              const key = normalizeFamily(item.animalFamily);
              if (!familyByType.get(item.animalType).has(key)) familyByType.get(item.animalType).set(key, displayFamily(item.animalFamily));
          }
      }
      const groups = [];
      for (const type of ANIMAL_TYPES) {
          if (!familyByType.has(type)) continue;
          groups.push({ value: `type:${type}`, label: `All ${type}`, parent: type });
          for (const [key, label] of [...familyByType.get(type)].sort((a,b) => a[1].localeCompare(b[1]))) {
              groups.push({ value: `family:${type}:${key}`, label, parent: type });
          }
      }
      const filters = [];
      if (category) filters.push({ category: category === 'Aquatic Life' ? { $in: ['Aquatic Life', 'Live Fish'] } : category });
      if (status === 'featured') filters.push({ featured: true });
      if (status === 'juvenile') filters.push({ 'variants.label': /^juvenile$/i });
      if (status === 'live') filters.push({ isLive: true });
      if (status === 'sold-out') filters.push({ $or: [{ variants: { $size: 0 }, stockQuantity: 0 }, { 'variants.0': { $exists: true }, variants: { $not: { $elemMatch: { stockQuantity: { $gt: 0 } } } } }] });
      if (status === 'in-stock') filters.push({ $or: [{ variants: { $size: 0 }, stockQuantity: { $gt: 0 } }, { 'variants.stockQuantity': { $gt: 0 } }] });
      if (status === 'low') filters.push({ stockQuantity: { $gt: 0, $lte: 3 } });
      // Restrict filter values to those already present in the database.
      if (groups.some(entry => entry.value === group)) {
          const [kind, type, family] = group.split(':');
          filters.push(kind === 'type' ? { animalType: type } : { animalType: type, animalFamily: new RegExp('^\\s*' + family.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+') + '\\s*$', 'i') });
      }
      if (search) {
          filters.push(buildProductSearch(search));
      }

      const query = filters.length ? { $and: filters } : {};
      const sortMap = {
          category: { category: 1, title: 1 },
          title: { title: 1 },
          newest: { createdAt: -1, title: 1 },
          'stock-low': { stockQuantity: 1, category: 1, title: 1 }
      };

      const products = await Product.find(query).sort(sortMap[sort]);
      const productsByCategory = {};
      products.forEach(product => {
          const bucket = product.category === 'Live Fish' ? 'Aquatic Life' : product.category;
          if (!productsByCategory[bucket]) productsByCategory[bucket] = [];
          productsByCategory[bucket].push(product);
      });

      res.render('inventory/list', {
          title: 'Product Management - Moss and Marine',
          products,
          productsByCategory,
          user: req.session.user,
          filters: { category, status, group: groups.some(entry => entry.value === group) ? group : '', search, sort },
          groups,
          categories: ALLOWED_CATEGORIES
      });
  } catch (error) {
      console.error('Error fetching products:', error);
      res.status(500).render('error', {
          title: 'Error - Moss and Marine',
          message: 'An error occurred while loading products'
      });
  }
};

exports.getAddProductPage = (req, res) => {
    if (!req.session.user || req.session.user.role !== 'data-entry-clerk') {
        return res.status(401).render('error', {
            title: 'Unauthorized - Moss and Marine',
            message: 'You are not authorized to view this page.'
        });
    }
    
    res.render('inventory/add', {
        title: 'Add Product - Moss and Marine',
        user: req.session.user,
        errors: [],
        product: {}
    });
};

exports.processAddProduct = async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'data-entry-clerk') {
        return res.status(401).render('error', {
            title: 'Unauthorized - Moss and Marine',
            message: 'You are not authorized to add products'
        });
    }
    
    try {
        const { 
            title, description, category, price, salePrice, stockQuantity
        } = req.body;
        
        const featured = req.body.featured === 'on';
        const isLive = category === 'Aquatic Life';
        const animalType = isLive ? req.body.animalType : undefined;
        const animalFamily = isLive ? displayFamily(req.body.animalFamily) : undefined;
        
        const errors = [];
        let variants = [];
        const proposedSku = generateSku({ title, category });
        try { variants = isLive ? parseLifecycleVariants(req.body, proposedSku) : []; await validateUniqueVariants(variants); } catch(e) { errors.push(e.message); }
        
        if (!title) errors.push('Title is required');
        if (!category) errors.push('Category is required');
        else if (!ALLOWED_CATEGORIES.includes(category)) errors.push('Please choose a valid category');
        if (!price || isNaN(price) || price <= 0) errors.push('Valid price is required');
        if (salePrice && (isNaN(salePrice) || salePrice <= 0)) errors.push('Sale price must be a valid number');
        if (stockQuantity === '' || stockQuantity === undefined || !Number.isInteger(Number(stockQuantity)) || Number(stockQuantity) < 0) errors.push('Stock quantity must be a whole number of 0 or more');
        if (isLive && !ANIMAL_TYPES.includes(animalType)) errors.push('Choose an aquatic animal type');
        if (animalFamily && animalFamily.length > 80) errors.push('Animal family is too long');
        errors.push(...validateSpecifications(category, req.body));
        
        if (!req.files || !req.files.productImage) {
            errors.push('Product image is required');
        } else {
            const imageFile = req.files.productImage;
            const fileExtension = path.extname(imageFile.name).toLowerCase();
            const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
            
            if (!allowedExtensions.includes(fileExtension)) {
                errors.push('Invalid image format. Only JPG, JPEG, PNG, GIF, and WEBP are allowed');
            }
        }
        
        if (errors.length > 0) {
            return res.render('inventory/add', {
                title: 'Add Product - Moss and Marine',
                user: req.session.user,
                errors: errors,
                product: req.body
            });
        }
        
        const imageFile = req.files.productImage;
        const imageUrl = await saveProductImage(imageFile);

        const newProduct = new Product({
            sku: proposedSku,
            title,
            description: (description || '').trim(),
            category,
            variants,
            price: parseFloat(price),
            salePrice: salePrice ? parseFloat(salePrice) : undefined,
            stockQuantity: parseInt(stockQuantity, 10),
            specifications: buildSpecifications(category, req.body),
            imageUrl,
            featured,
            isLive,
            animalType,
            animalFamily
        });
        
        await newProduct.save();
        
        res.redirect('/inventory/list');
    } catch (error) {
        console.error('Error adding product:', error);
        res.status(500).render('error', {
            title: 'Error - Moss and Marine',
            message: 'An error occurred while adding the product'
        });
    }
};

exports.getEditProductPage = async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'data-entry-clerk') {
        return res.status(401).render('error', {
            title: 'Unauthorized - Moss and Marine',
            message: 'You are not authorized to view this page.'
        });
    }
    
    try {
        const product = await Product.findById(req.params.id);
        
        if (!product) {
            return res.status(404).render('error', {
                title: 'Not Found - Moss and Marine',
                message: 'Product not found'
            });
        }
        
        res.render('inventory/edit', {
            title: 'Edit Product - Moss and Marine',
            user: req.session.user,
            errors: [],
            product
        });
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).render('error', {
            title: 'Error - Moss and Marine',
            message: 'An error occurred while loading the product'
        });
    }
};

exports.processEditProduct = async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'data-entry-clerk') {
        return res.status(401).render('error', {
            title: 'Unauthorized - Moss and Marine',
            message: 'You are not authorized to edit products'
        });
    }
    
    try {
        const { 
            title, description, category, price, salePrice, stockQuantity
        } = req.body;
        
        const featured = req.body.featured === 'on';
        const isLive = category === 'Aquatic Life';
        const animalType = isLive ? req.body.animalType : undefined;
        const animalFamily = isLive ? displayFamily(req.body.animalFamily) : undefined;
        
        const errors = [];
        let variants = [];
        
        if (!title) errors.push('Title is required');
        if (!category) errors.push('Category is required');
        else if (!ALLOWED_CATEGORIES.includes(category)) errors.push('Please choose a valid category');
        if (!price || isNaN(price) || price <= 0) errors.push('Valid price is required');
        if (salePrice && (isNaN(salePrice) || salePrice <= 0)) errors.push('Sale price must be a valid number');
        if (stockQuantity === '' || stockQuantity === undefined || !Number.isInteger(Number(stockQuantity)) || Number(stockQuantity) < 0) errors.push('Stock quantity must be a whole number of 0 or more');
        if (isLive && !ANIMAL_TYPES.includes(animalType)) errors.push('Choose an aquatic animal type');
        if (animalFamily && animalFamily.length > 80) errors.push('Animal family is too long');
        errors.push(...validateSpecifications(category, req.body));

        const product = await Product.findById(req.params.id);
        
        if (!product) {
            return res.status(404).render('error', {
                title: 'Not Found - Moss and Marine',
                message: 'Product not found'
            });
        }
        try {
            variants = isLive ? parseLifecycleVariants(req.body, product.sku, product.variants || []) : [];
            await validateUniqueVariants(variants, product._id);
        } catch (error) { errors.push(error.message); }

        if (errors.length > 0) {
            return res.render('inventory/edit', {
                title: 'Edit Product - Moss and Marine',
                user: req.session.user,
                errors: errors,
                product: {
                    ...req.body,
                    _id: req.params.id,
                    imageUrl: product.imageUrl
                }
            });
        }
        
        let imageUrl = product.imageUrl;
        
        if (req.files && req.files.productImage) {
            const imageFile = req.files.productImage;
            const fileExtension = path.extname(imageFile.name).toLowerCase();
            const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
            
            if (!allowedExtensions.includes(fileExtension)) {
                return res.render('inventory/edit', {
                    title: 'Edit Product - Moss and Marine',
                    user: req.session.user,
                    errors: ['Invalid image format. Only JPG, JPEG, PNG, GIF, and WEBP are allowed'],
                    product: {
                        ...req.body,
                        _id: req.params.id,
                        imageUrl: product.imageUrl
                    }
                });
            }
            
            imageUrl = await saveProductImage(imageFile);
        }
        
        await Product.findByIdAndUpdate(req.params.id, {
            title,
            description: (description || '').trim(),
            category,
            variants,
            price: parseFloat(price),
            salePrice: salePrice ? parseFloat(salePrice) : undefined,
            stockQuantity: parseInt(stockQuantity, 10),
            specifications: buildSpecifications(category, req.body),
            imageUrl,
            featured,
            isLive,
            animalType,
            animalFamily
        });
        
        if (imageUrl !== product.imageUrl) {
            await deleteProductImage(product.imageUrl);
        }

        res.redirect('/inventory/list');
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).render('error', {
            title: 'Error - Moss and Marine',
            message: 'An error occurred while updating the product'
        });
    }
};

exports.getRemoveProductPage = async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'data-entry-clerk') {
        return res.status(401).render('error', {
            title: 'Unauthorized - Moss and Marine',
            message: 'You are not authorized to view this page.'
        });
    }
    
    try {
        const product = await Product.findById(req.params.id);
        
        if (!product) {
            return res.status(404).render('error', {
                title: 'Not Found - Moss and Marine',
                message: 'Product not found'
            });
        }
        
        res.render('inventory/remove', {
            title: 'Remove Product - Moss and Marine',
            user: req.session.user,
            product
        });
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).render('error', {
            title: 'Error - Moss and Marine',
            message: 'An error occurred while loading the product'
        });
    }
};

exports.processRemoveProduct = async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'data-entry-clerk') {
      return res.status(401).render('error', {
          title: 'Unauthorized - Moss and Marine',
          message: 'You are not authorized to remove products'
      });
  }
  
  try {
      const product = await Product.findById(req.params.id);
      
      if (!product) {
          return res.status(404).render('error', {
              title: 'Not Found - Moss and Marine',
              message: 'Product not found'
          });
      }
      
      await Product.findByIdAndDelete(req.params.id);
      await deleteProductImage(product.imageUrl);
      
      res.redirect('/inventory/list');
  } catch (error) {
      console.error('Error removing product:', error);
      res.status(500).render('error', {
          title: 'Error - Moss and Marine',
          message: 'An error occurred while removing the product'
      });
  }
};