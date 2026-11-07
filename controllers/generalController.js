const {hasVariants,getVariant,totalStock} = require('../modules/variant-util');
const User = require('../models/userModel');
const emailUtil = require('../modules/email-util');
const validation = require('../modules/validation-util');
const mongoose = require('mongoose');
const Product = require('../models/productModel');
const Order = require('../models/orderModel');

function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save(error => {
      if (error) return reject(error);
      resolve();
    });
  });
}

exports.getHomePage = async (req, res) => {
  try {

    const products = await Product.find({ featured: true });
    
    res.render('home', {
      title: 'Home - Moss and Marine',
      products: products
    });
  } catch (error) {
    console.error('Error fetching featured products:', error);
    res.render('home', {
      title: 'Home - Moss and Marine',
      products: []
    });
  }
};

exports.getSignUpPage = (req, res) => {
  res.render('sign-up', {
    title: 'Create Account - Moss and Marine',
    errors: []
  });
};

exports.processSignUp = async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;
    
    const formData = {
      firstName,
      lastName,
      email,
      password
    };
    const validationResult = validation.validateRegistrationForm(formData);
    
    if (!validationResult.isValid) {
      return res.render('sign-up', {
        title: 'Create Account - Moss and Marine',
        errors: validationResult.errors,
        firstName,
        lastName,
        email
      });
    }
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.render('sign-up', {
        title: 'Create Account - Moss and Marine',
        errors: ['Email is already registered'],
        firstName,
        lastName
      });
    }
    
    const newUser = new User({
      firstName,
      lastName,
      email,
      password,
      role: 'customer'
    });
    
    await newUser.save();
    
    // Email is a nice-to-have. A Mailgun outage or missing key should not
    // make a successfully-created account look like a failed registration.
    try {
      await emailUtil.sendWelcomeEmail(email, firstName, lastName);
    } catch (emailError) {
      console.error('Welcome email failed:', emailError.message);
    }

    try {
      await emailUtil.sendNewSignupNotification(newUser);
    } catch (emailError) {
      console.error('Admin signup notification failed:', emailError.message);
    }
    
    req.session.user = {
      id: newUser._id,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      email: newUser.email,
      role: newUser.role
    };
    
    req.session.save(err => {
      if (err) {
        console.error('Session save error:', err);
      }
      res.redirect('/welcome');
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.render('sign-up', {
      title: 'Create Account - Moss and Marine',
      errors: ['An error occurred during registration. Please try again.'],
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email
    });
  }
};

exports.getLogInPage = (req, res) => {
  res.render('log-in', {
    title: 'Log In - Moss and Marine',
    errors: []
  });
};

exports.processLogIn = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const formData = {
      email,
      password
    };
    const validationResult = validation.validateLoginForm(formData);
    
    if (!validationResult.isValid) {
      return res.render('log-in', {
        title: 'Log In - Moss and Marine',
        errors: validationResult.errors,
        email
      });
    }
    
    const user = await User.findOne({ email });
    
    if (!user || !(await user.comparePassword(password))) {
      return res.render('log-in', {
        title: 'Log In - Moss and Marine',
        errors: ['Sorry, you entered an invalid email and/or password'],
        email
      });
    }
    
    req.session.user = {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      // The database is the source of truth for authorization.
      // Never accept a role supplied by the login form.
      role: user.role
    };
    
    req.session.save(err => {
      if (err) {
        console.error('Session save error:', err);
      }
      
      const returnTo = req.session.returnTo;
      delete req.session.returnTo;

      if (returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')) {
        return res.redirect(returnTo);
      }

      if (req.session.user.role === 'data-entry-clerk') {
        return res.redirect('/inventory/list');
      }

      return res.redirect('/inventory');
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.render('log-in', {
      title: 'Log In - Moss and Marine',
      errors: ['An error occurred during login. Please try again.'],
      email: req.body.email
    });
  }
};


exports.getWelcomePage = (req, res) => {
  res.render('welcome', {
    title: 'Welcome - Moss and Marine'
  });
};


exports.getCartPage = async (req, res) => {
  try {
    const cart = Array.isArray(req.session.cart) ? req.session.cart : [];
    const productIds = cart.map(item => item.productId);
    const products = await Product.find({ _id: { $in: productIds } });
    const productMap = new Map(products.map(product => [String(product._id), product]));
    const cartNotices = [];

    const items = cart
      .map(item => {
        const product = productMap.get(String(item.productId));
        if (!product) return null;

        const variant = hasVariants(product) ? getVariant(product,item.variantId) : null;
        if (hasVariants(product) && !variant) { cartNotices.push(`${product.title} variation is no longer available.`); return null; }
        const availableStock = Math.max(0, Number(variant ? variant.stockQuantity : product.stockQuantity) || 0);
        if (availableStock === 0) {
          cartNotices.push(`${product.title} is now sold out and was removed from your cart.`);
          return null;
        }

        const requestedQuantity = Math.max(1, parseInt(item.quantity, 10) || 1);
        const quantity = Math.min(requestedQuantity, availableStock);
        if (quantity !== requestedQuantity) {
          cartNotices.push(`${product.title} was adjusted to ${quantity} because that is all we currently have in stock.`);
        }

        const unitPrice = variant ? (variant.salePrice || variant.price) : (product.salePrice || product.price);
        return {
          product, variant,
          quantity,
          availableStock,
          unitPrice,
          lineTotal: unitPrice * quantity
        };
      })
      .filter(Boolean);

    // Keep the session cart synchronized with current inventory.
    req.session.cart = items.map(item => ({
      productId: String(item.product._id),
      variantId: item.variant ? String(item.variant._id) : undefined,
      quantity: item.quantity
    }));

    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const message = req.session.cartMessage || null;
    const warning = req.session.cartWarning || (cartNotices.length ? cartNotices.join(' ') : null);
    delete req.session.cartMessage;
    delete req.session.cartWarning;

    res.render('cart', {
      title: 'Shopping Cart - Moss and Marine',
      user: req.session.user,
      items,
      subtotal,
      totalQuantity,
      message,
      warning
    });
  } catch (error) {
    console.error('Cart error:', error);
    res.status(500).render('error', {
      title: 'Cart Error - Moss and Marine',
      message: 'We could not load your cart. Please try again.'
    });
  }
};

exports.addToCart = async (req,res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).render('error',{title:'Not Found',message:'Product not found.'});
    const variant = hasVariants(product) ? getVariant(product,req.body.variantId) : null;
    if (hasVariants(product) && !variant) { req.session.cartWarning='Choose a valid product variation.'; return res.redirect(`/inventory/product/${product.id}`); }
    const availableStock = Number(variant ? variant.stockQuantity : product.stockQuantity) || 0;
    if (availableStock <= 0) { req.session.cartWarning='That option is sold out.'; return res.redirect('/cart'); }
    const quantity = Math.min(Math.max(1,parseInt(req.body.quantity,10)||1),availableStock);
    const variantId = variant ? String(variant._id) : undefined;
    if (!Array.isArray(req.session.cart)) req.session.cart=[];
    const existing = req.session.cart.find(x=>String(x.productId)===String(product.id) && String(x.variantId||'')===String(variantId||''));
    if (existing) existing.quantity=Math.min(availableStock,existing.quantity+quantity);
    else req.session.cart.push({productId:String(product.id),variantId,quantity});
    req.session.cartMessage=`${product.title}${variant?' — '+variant.label:''} added to cart.`;
    return res.redirect('/cart');
  } catch(error) { console.error(error); return res.status(500).render('error',{title:'Cart Error',message:'Could not add item.'}); }
};

exports.updateCartItem = async (req, res) => {
  try {
    if (!Array.isArray(req.session.cart)) req.session.cart = [];
    const item = req.session.cart.find(cartItem => String(cartItem.productId) === String(req.params.id) && String(cartItem.variantId||'') === String(req.body.variantId||''));
    if (!item) return res.redirect('/cart');

    const product = await Product.findById(req.params.id);
    if (!product) {
      req.session.cart = req.session.cart.filter(cartItem => !(String(cartItem.productId) === String(req.params.id) && String(cartItem.variantId||'') === String(req.body.variantId||''))); 
      req.session.cartWarning = 'That product is no longer available and was removed from your cart.';
      return res.redirect('/cart');
    }

    const variant = hasVariants(product) ? getVariant(product,item.variantId) : null;
    const availableStock = hasVariants(product) && !variant ? 0 : Math.max(0,Number(variant ? variant.stockQuantity : product.stockQuantity)||0);
    if (availableStock === 0) {
      req.session.cart = req.session.cart.filter(cartItem => !(String(cartItem.productId) === String(req.params.id) && String(cartItem.variantId||'') === String(req.body.variantId||''))); 
      req.session.cartWarning = `${product.title} is sold out and was removed from your cart.`;
      return res.redirect('/cart');
    }

    const requestedQuantity = Math.max(1, parseInt(req.body.quantity, 10) || 1);
    item.quantity = Math.min(requestedQuantity, availableStock);

    // Quantity changes are visible immediately, so avoid a persistent-looking success banner.
    if (requestedQuantity > availableStock) {
      req.session.cartWarning = `Only ${availableStock} ${product.title} ${availableStock === 1 ? 'item is' : 'items are'} available. Your cart was adjusted.`;
    }

    return res.redirect('/cart');
  } catch (error) {
    console.error('Update cart error:', error);
    return res.status(500).render('error', {
      title: 'Cart Error - Moss and Marine',
      message: 'We could not update that cart item.'
    });
  }
};

exports.removeCartItem = (req, res) => {
  if (!Array.isArray(req.session.cart)) req.session.cart = [];
  req.session.cart = req.session.cart.filter(item => !(String(item.productId) === String(req.params.id) && String(item.variantId||'') === String(req.body.variantId||'')));
  res.redirect('/cart');
};


exports.checkout = async (req, res) => {
  const cart = Array.isArray(req.session.cart) ? req.session.cart : [];
  if (!cart.length) {
    req.session.cartWarning = 'Your cart is empty.';
    return res.redirect('/cart');
  }

  const dbSession = await mongoose.startSession();
  let createdOrder = null;

  try {
    await dbSession.withTransaction(async () => {
      const productIds = cart.map(item => item.productId);
      const products = await Product.find({ _id: { $in: productIds } }).session(dbSession);
      const productMap = new Map(products.map(product => [String(product._id), product]));
      const orderItems = [];

      for (const cartItem of cart) {
        const product = productMap.get(String(cartItem.productId));
        const quantity = Math.max(1, parseInt(cartItem.quantity, 10) || 1);

        if (!product) {
          const error = new Error('One of the products in your cart is no longer available.');
          error.code = 'STOCK_CONFLICT';
          throw error;
        }

        const variant = hasVariants(product) ? getVariant(product,cartItem.variantId) : null;
        if (hasVariants(product) && !variant) { const error=new Error('Selected variant is no longer available.'); error.code='STOCK_CONFLICT'; throw error; }
        const updatedProduct = variant
          ? await Product.findOneAndUpdate({ _id:product._id, variants:{$elemMatch:{_id:variant._id,stockQuantity:{$gte:quantity}}} },{$inc:{'variants.$.stockQuantity':-quantity}},{new:true,session:dbSession})
          : await Product.findOneAndUpdate({_id:product._id,stockQuantity:{$gte:quantity}},{$inc:{stockQuantity:-quantity}},{new:true,session:dbSession});

        if (!updatedProduct) {
          const error = new Error(`${product.title} no longer has enough stock for the quantity in your cart.`);
          error.code = 'STOCK_CONFLICT';
          throw error;
        }

        const unitPrice = Number(variant ? (variant.salePrice||variant.price) : (product.salePrice||product.price));
        orderItems.push({
          variantId: variant ? variant._id : undefined,
          variantLabel: variant ? variant.label : undefined,
          productId: product._id,
          sku: variant ? variant.sku : product.sku,
          title: variant ? `${product.title} — ${variant.label}` : product.title,
          category: product.category,
          imageUrl: product.imageUrl,
          unitPrice,
          quantity,
          lineTotal: unitPrice * quantity
        });
      }

      const subtotal = orderItems.reduce((sum, item) => sum + item.lineTotal, 0);
      const totalQuantity = orderItems.reduce((sum, item) => sum + item.quantity, 0);
      const [order] = await Order.create([{
        userId: req.session.user.id,
        customer: {
          firstName: req.session.user.firstName,
          lastName: req.session.user.lastName,
          email: req.session.user.email
        },
        items: orderItems,
        totalQuantity,
        subtotal,
        total: subtotal,
        status: 'Placed'
      }], { session: dbSession });

      createdOrder = order;
    });

    if (!createdOrder) {
      throw new Error('The order could not be created.');
    }

    req.session.cart = [];
    delete req.session.cartMessage;
    delete req.session.cartWarning;

    // Persist the empty cart before redirecting so a completed order can never
    // reappear from a stale session on the next request or login.
    await saveSession(req);

    try {
      await emailUtil.sendOrderConfirmationEmail(createdOrder);
    } catch (emailError) {
      console.error('Order confirmation email failed:', emailError.message);
    }

    try {
      await emailUtil.sendNewOrderNotification(createdOrder);
    } catch (emailError) {
      console.error('Admin order notification failed:', emailError.message);
    }

    return res.redirect(`/orders/${createdOrder._id}/confirmation`);
  } catch (error) {
    console.error('Checkout error:', error);

    if (error.code === 'STOCK_CONFLICT') {
      req.session.cartWarning = `${error.message} Please review your cart and try again.`;
      return res.redirect('/cart');
    }

    return res.status(500).render('error', {
      title: 'Checkout Error - Moss and Marine',
      message: 'We could not place your order. Your cart has not been cleared. Please try again.'
    });
  } finally {
    await dbSession.endSession();
  }
};

exports.getOrderHistory = async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.session.user.id }).sort({ createdAt: -1 });
    return res.render('orders', {
      title: 'My Orders - Moss and Marine',
      orders
    });
  } catch (error) {
    console.error('Order history error:', error);
    return res.status(500).render('error', {
      title: 'Orders Error - Moss and Marine',
      message: 'We could not load your order history.'
    });
  }
};

exports.getOrderConfirmation = async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      userId: req.session.user.id
    });

    if (!order) {
      return res.status(404).render('error', {
        title: 'Order Not Found - Moss and Marine',
        message: 'We could not find that order.'
      });
    }

    return res.render('order-confirmation', {
      title: 'Order Confirmed - Moss and Marine',
      order
    });
  } catch (error) {
    console.error('Order confirmation error:', error);
    return res.status(404).render('error', {
      title: 'Order Not Found - Moss and Marine',
      message: 'We could not find that order.'
    });
  }
};


exports.logout = (req, res) => {

  req.session.destroy(err => {
    if (err) {
      console.error('Error destroying session:', err);
    }
   
    res.redirect('/log-in');
  });
};