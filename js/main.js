(() => {
  const root = document.documentElement;
  root.classList.add('js');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Nav: solid on scroll, hide on scroll down, mobile menu ---------- */
  const nav = document.getElementById('nav');
  const toggle = document.getElementById('nav-toggle');
  const links = document.getElementById('nav-links');
  let lastY = window.scrollY;

  const setMenu = (open) => {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.style.overflow = open ? 'hidden' : '';
  };
  toggle.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
  links.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

  /* ---------- Active nav link ---------- */
  const navLinks = [...links.querySelectorAll('a[href^="#"]')];
  const sections = navLinks
    .map((a) => document.querySelector(a.getAttribute('href')))
    .filter(Boolean);
  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      navLinks.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === '#' + entry.target.id));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach((s) => sectionObserver.observe(s));

  /* ---------- Reveal on scroll (staggered within each group) ---------- */
  const revealEls = document.querySelectorAll('[data-reveal]');
  const groups = new Map();
  revealEls.forEach((el) => {
    const parent = el.parentElement;
    const i = groups.get(parent) || 0;
    el.style.setProperty('--delay', `${Math.min(i, 5) * 0.09}s`);
    groups.set(parent, i + 1);
  });
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealEls.forEach((el) => el.classList.add('is-in'));
  } else {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
    revealEls.forEach((el) => revealObserver.observe(el));
  }

  /* ---------- Showreel: 90% → full bleed as you scroll ---------- */
  const reel = document.getElementById('reel');
  const frame = document.getElementById('reel-frame');
  const video = document.getElementById('reel-video');
  const soundBtn = document.getElementById('reel-sound');
  const parallaxImg = document.querySelector('[data-parallax]');
  const ease = (t) => 1 - Math.pow(1 - t, 3);

  const update = () => {
    const vh = window.innerHeight;
    const y = window.scrollY;

    nav.classList.toggle('is-solid', y > 40);
    if (!nav.classList.contains('is-open')) {
      nav.classList.toggle('is-hidden', y > lastY && y > vh * 0.9);
    }
    lastY = y;

    // Reel: progress runs from when the sticky frame pins (top hits 0)
    // to 60% of the scroll distance, then holds full screen until it scrolls away.
    const r = reel.getBoundingClientRect();
    const travel = r.height - vh;
    const raw = Math.min(Math.max(-r.top / (travel * 0.6), 0), 1);
    frame.style.setProperty('--p', reduceMotion ? 1 : ease(raw).toFixed(4));

    // Gentle parallax on the kayaking background
    if (parallaxImg && !reduceMotion) {
      const pr = parallaxImg.parentElement.getBoundingClientRect();
      if (pr.bottom > 0 && pr.top < vh) {
        const t = (vh - pr.top) / (vh + pr.height);
        parallaxImg.style.setProperty('--parallax', `${(-t * 16).toFixed(2)}%`);
      }
    }
  };

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { update(); ticking = false; });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  update();

  // Autoplay the reel (muted) as soon as the page loads. It only pauses once
  // you've scrolled right past it, and resumes when you scroll back up.
  // Visitors who ask their device to reduce motion get the poster instead.
  // Safari only autoplays if muted is set as a property, not just the attribute
  video.muted = true;
  video.defaultMuted = true;
  const playReel = () => { if (!reduceMotion) video.play().catch(() => {}); };
  // If the browser still blocked autoplay, start on the first scroll, tap or key press
  const kick = () => { if (video.paused) playReel(); };
  ['scroll', 'touchstart', 'pointerdown', 'keydown'].forEach((ev) =>
    window.addEventListener(ev, kick, { once: true, passive: true }));
  if (reduceMotion) { video.removeAttribute('autoplay'); video.pause(); }
  video.addEventListener('loadeddata', () => { soundBtn.hidden = false; playReel(); });
  if (video.readyState >= 2) { soundBtn.hidden = false; playReel(); }
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) playReel();
    else if (entry.boundingClientRect.top < 0) video.pause();
  }).observe(reel);

  soundBtn.addEventListener('click', () => {
    video.muted = !video.muted;
    soundBtn.classList.toggle('is-on', !video.muted);
    soundBtn.setAttribute('aria-label', video.muted ? 'Turn sound on' : 'Turn sound off');
    if (video.paused) video.play().catch(() => {});
  });

  /* ---------- Contact form ---------- */
  const form = document.getElementById('contact-form');
  const status = document.getElementById('form-status');

  const setStatus = (msg, isError = false) => {
    status.textContent = msg;
    status.classList.toggle('is-error', isError);
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    let firstBad = null;
    form.querySelectorAll('[required]').forEach((input) => {
      const ok = input.checkValidity();
      input.closest('.field').classList.toggle('is-invalid', !ok);
      if (!ok && !firstBad) firstBad = input;
    });
    if (firstBad) {
      setStatus('Please fill in the highlighted fields.', true);
      firstBad.focus();
      return;
    }
    if (form._gotcha.value) return; // spam bot

    const endpoint = form.dataset.endpoint;
    if (!endpoint) {
      setStatus('The form isn’t connected yet. Please message us on Instagram or Facebook for now.', true);
      return;
    }

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    setStatus('Sending…');
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        body: (() => {
          const data = new FormData(form);
          const needs = data.getAll('needs');
          data.delete('needs');
          data.append('needs', needs.length ? needs.join(', ') : 'Not specified');
          return data;
        })(),
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(res.status);
      form.reset();
      setStatus('Thanks, we’ve got your message and will be in touch soon.');
    } catch {
      setStatus('Something went wrong sending that. Please try again or message us on social.', true);
    } finally {
      btn.disabled = false;
    }
  });
  form.addEventListener('input', (e) => {
    const field = e.target.closest('.field');
    if (field && e.target.checkValidity()) field.classList.remove('is-invalid');
  });

  document.getElementById('year').textContent = new Date().getFullYear();
})();
