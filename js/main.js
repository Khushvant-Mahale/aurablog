/* Interactive Scripts for AuraBlog */

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initMobileNav();
  initPostFilter();
  initForms();
  initCookieConsent();
});

/**
 * Theme Switching System (Light/Dark Mode)
 */
function initTheme() {
  const themeToggleButtons = document.querySelectorAll('.theme-toggle-btn');
  const savedTheme = localStorage.getItem('theme');
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  // Set initial theme (defaults to light mode)
  const initialTheme = savedTheme || 'light';
  document.documentElement.setAttribute('data-theme', initialTheme);
  
  themeToggleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
    });
  });
}

/**
 * Mobile Drawer Menu
 */
function initMobileNav() {
  const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
  
  if (!mobileMenuBtn) return;
  
  // Create Mobile Drawer HTML dynamically to avoid code repetition across pages
  const overlay = document.createElement('div');
  overlay.className = 'mobile-nav-overlay';
  document.body.appendChild(overlay);
  
  const drawer = document.createElement('div');
  drawer.className = 'mobile-nav-drawer';
  
  // Extract desktop menu links to populate mobile menu
  const navLinks = Array.from(document.querySelectorAll('.nav-menu .nav-link'));
  const linksHtml = navLinks.map(link => {
    const isActive = link.classList.contains('active') ? 'active' : '';
    return `<li><a href="${link.getAttribute('href')}" class="nav-link ${isActive}">${link.textContent}</a></li>`;
  }).join('');
  
  drawer.innerHTML = `
    <div class="mobile-nav-drawer-header">
      <a href="/" class="nav-brand"><span>Aura</span>Blog</a>
      <button class="theme-toggle-btn" aria-label="Toggle theme" style="border:none;">
        <svg class="sun-icon" viewBox="0 0 24 24"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41s-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.01c.39-.39.39-1.03 0-1.41s-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/></svg>
        <svg class="moon-icon" viewBox="0 0 24 24"><path d="M9.37 5.51c-.18-.64-.9-1-1.54-.82-.64.18-1 .9-.82 1.54 1.41 4.97 6 8.52 11.37 8.52.64 0 1.28-.06 1.9-.17.65-.11 1.09-.72.98-1.37-.11-.64-.72-1.09-1.37-.98-.5.09-1.02.14-1.54.14-4.52 0-8.24-3.41-8.98-7.83z"/></svg>
      </button>
    </div>
    <nav>
      <ul class="mobile-nav-links">
        ${linksHtml}
      </ul>
    </nav>
  `;
  document.body.appendChild(drawer);
  
  // Wire up theme toggles inside the drawer
  const drawerThemeBtn = drawer.querySelector('.theme-toggle-btn');
  if (drawerThemeBtn) {
    drawerThemeBtn.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
    });
  }

  // Open and Close mechanisms
  const openDrawer = () => {
    drawer.classList.add('open');
    overlay.classList.add('show');
    document.body.style.overflow = 'hidden';
  };

  const closeDrawer = () => {
    drawer.classList.remove('open');
    overlay.classList.remove('show');
    document.body.style.overflow = '';
  };

  mobileMenuBtn.addEventListener('click', openDrawer);
  overlay.addEventListener('click', closeDrawer);
  
  // Close drawer if screen resizes to desktop width
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768 && drawer.classList.contains('open')) {
      closeDrawer();
    }
  });
}

/**
 * Client-Side Post Filtering & Search
 */
function initPostFilter() {
  const searchInput = document.querySelector('.search-input');
  const filterButtons = document.querySelectorAll('.filter-btn');
  const postCards = document.querySelectorAll('.posts-grid .post-card');
  
  if (postCards.length === 0) return;
  
  let activeTag = 'all';
  let searchQuery = '';

  function filterPosts() {
    postCards.forEach(card => {
      const title = card.querySelector('.post-card-title').textContent.toLowerCase();
      const excerpt = card.querySelector('.post-card-excerpt').textContent.toLowerCase();
      const tag = card.querySelector('.post-card-tag').textContent.trim().toLowerCase();
      
      const matchesSearch = title.includes(searchQuery) || excerpt.includes(searchQuery);
      const matchesTag = activeTag === 'all' || tag === activeTag;
      
      if (matchesSearch && matchesTag) {
        card.style.display = 'flex';
        card.style.animation = 'fadeIn 0.4s ease forwards';
      } else {
        card.style.display = 'none';
      }
    });
  }

  // Search input event
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      filterPosts();
    });
  }

  // Tag filter button events
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      activeTag = btn.getAttribute('data-tag').toLowerCase().trim();
      filterPosts();
    });
  });
}

/**
 * Handle Form Interactions
 */
function initForms() {
  // Contact Form Setup
  const contactForm = document.querySelector('.contact-form-wrapper form');
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const successMsg = document.querySelector('.form-success-msg');
      if (successMsg) {
        successMsg.textContent = "Thank you! Your message has been sent successfully. We will get back to you shortly.";
        successMsg.style.display = 'block';
        
        // Reset form
        contactForm.reset();
        
        // Smooth scroll to top of form
        contactForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
        // Hide message after 8 seconds
        setTimeout(() => {
          successMsg.style.display = 'none';
        }, 8000);
      }
    });
  }

  // Newsletter Subscription Forms
  const newsletterForms = document.querySelectorAll('.newsletter-form');
  newsletterForms.forEach(form => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const emailInput = form.querySelector('input[type="email"]');
      const submitBtn = form.querySelector('button');
      
      if (emailInput && submitBtn) {
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Subscribed!';
        submitBtn.style.background = 'var(--success)';
        
        emailInput.value = '';
        
        setTimeout(() => {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
          submitBtn.style.background = '';
        }, 4000);
      }
    });
  });
}

/**
 * Cookie Consent Compliance Banner
 */
function initCookieConsent() {
  const hasConsent = localStorage.getItem('cookieConsent');
  const banner = document.querySelector('.cookie-banner');
  
  if (!banner) return;
  
  if (hasConsent === 'accepted') {
    banner.classList.add('hidden');
  } else {
    banner.classList.remove('hidden');
  }
  
  const acceptBtn = banner.querySelector('.cookie-banner-accept-btn');
  if (acceptBtn) {
    acceptBtn.addEventListener('click', () => {
      localStorage.setItem('cookieConsent', 'accepted');
      banner.classList.add('hidden');
    });
  }
}
