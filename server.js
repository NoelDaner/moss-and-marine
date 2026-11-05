const express = require('express');
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const dotenv = require('dotenv');
const ejsLayouts = require('express-ejs-layouts');
const generalController = require('./controllers/generalController');
const inventoryController = require('./controllers/inventoryController');
const fileUpload = require('express-fileupload');
const connectDB = require('./config/db');

dotenv.config({ path: path.join(__dirname, 'config', '.env') });
dotenv.config();
connectDB();

if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET is required in production');
}

const app = express();

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(ejsLayouts);
app.set('layout', 'layouts/main');

app.use(fileUpload());
app.use(express.static(path.join(__dirname, 'public')));
app.get('/media/products/:id', require('./modules/product-image-storage').serveProductImage);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'your-fallback-secret',
  store: process.env.MONGODB_URI
    ? MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        ttl: 2 * 60 * 60,
        autoRemove: 'native'
      })
    : undefined,
  rolling: true, // refresh the session expiry while the user remains active
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 2 * 60 * 60 * 1000
  }
}));


app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.currentPath = req.path;
  res.locals.navSearch = typeof req.query.q === 'string' ? req.query.q : '';
  next();
});


const { isAuthenticated, isDataEntryClerk } = require('./modules/auth-utils');

app.get('/', generalController.getHomePage);
app.get('/sign-up', generalController.getSignUpPage);
app.post('/sign-up', generalController.processSignUp);
app.get('/log-in', generalController.getLogInPage);
app.post('/log-in', generalController.processLogIn);
app.get('/welcome', generalController.getWelcomePage);
app.get('/cart', isAuthenticated, generalController.getCartPage);
app.post('/cart/add/:id', isAuthenticated, generalController.addToCart);
app.post('/cart/update/:id', isAuthenticated, generalController.updateCartItem);
app.post('/cart/remove/:id', isAuthenticated, generalController.removeCartItem);
app.post('/checkout', isAuthenticated, generalController.checkout);
app.get('/orders', isAuthenticated, generalController.getOrderHistory);
app.get('/orders/:id/confirmation', isAuthenticated, generalController.getOrderConfirmation);
app.get('/logout', generalController.logout);

app.get('/inventory', inventoryController.getInventoryPage);
app.get('/inventory/product/:id', inventoryController.getProductDetailPage);
app.get('/inventory/list', isAuthenticated, isDataEntryClerk, inventoryController.getProductListPage);

app.get('/inventory/add', isAuthenticated, isDataEntryClerk, inventoryController.getAddProductPage);
app.post('/inventory/add', isAuthenticated, isDataEntryClerk, inventoryController.processAddProduct);
app.get('/inventory/edit/:id', isAuthenticated, isDataEntryClerk, inventoryController.getEditProductPage);
app.post('/inventory/edit/:id', isAuthenticated, isDataEntryClerk, inventoryController.processEditProduct);
app.get('/inventory/remove/:id', isAuthenticated, isDataEntryClerk, inventoryController.getRemoveProductPage);
app.post('/inventory/remove/:id', isAuthenticated, isDataEntryClerk, inventoryController.processRemoveProduct);

app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Page Not Found - Moss and Marine',
    message: 'The page you are looking for does not exist.'
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', {
    title: 'Server Error - Moss and Marine',
    message: 'Something went wrong. Please try again.'
  });
});

// Vercel imports the Express app; local development starts an HTTP listener.
if (!process.env.VERCEL) {
  const port = process.env.PORT || 8080;
  app.listen(port, () => {
    console.log(`Express server listening on port ${port}`);
  });
}

module.exports = app;
