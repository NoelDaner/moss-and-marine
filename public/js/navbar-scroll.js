(() => {
  const navbar = document.getElementById('mainNavbar');
  if (!navbar) return;

  let previousScrollY = window.scrollY;
  const scrollThreshold = 8;
  const showNearTop = 90;

  window.addEventListener('scroll', () => {
    const currentScrollY = window.scrollY;
    const menuOpen = navbar.querySelector('.navbar-collapse.show');

    if (window.innerWidth < 992 || menuOpen || currentScrollY <= showNearTop) {
      navbar.classList.remove('navbar-hidden');
      previousScrollY = currentScrollY;
      return;
    }

    const difference = currentScrollY - previousScrollY;
    if (Math.abs(difference) < scrollThreshold) return;

    if (difference > 0) {
      navbar.classList.add('navbar-hidden');
    } else {
      navbar.classList.remove('navbar-hidden');
    }

    previousScrollY = currentScrollY;
  }, { passive: true });
})();
