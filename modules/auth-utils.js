const isAuthenticated = (req, res, next) => {
  if (req.session.user) {
    return next();
  }

  // Remember where the visitor was trying to go so a successful login can
  // return them there instead of showing an authorization error page.
  if (req.method === 'GET') {
    req.session.returnTo = req.originalUrl;
  }

  return res.redirect('/log-in');
};

const isDataEntryClerk = (req, res, next) => {
  if (req.session.user && req.session.user.role === 'data-entry-clerk') {
    return next();
  }

  return res.status(403).render('error', {
    title: 'Access Denied - Moss and Marine',
    message: 'This page is only available to data entry clerks.'
  });
};

module.exports = {
  isAuthenticated,
  isDataEntryClerk
};
