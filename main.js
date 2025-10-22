// Minimal golden smoke cursor and small utilities
(() => {
  // Global-ish state for cursor effect
  let settings = { enabled: true, density: 0.7 };
  const mouse = { x: window.innerWidth/2, y: window.innerHeight/2, vx: 0, vy: 0, lastX: window.innerWidth/2, lastY: window.innerHeight/2 };
  const particles = []; // Легкие частицы дыма
  const sparkles = []; // Золотистые искорки
  const tailParticles = []; // Белый хвост факела
  // (Удалены боковые факелы)
  let lastTime = performance.now();

  // Reveal анимации отключены по умолчанию, чтобы контент всегда был виден даже при ошибках.
  const canvas = document.getElementById('cursor-canvas');
  const ctx = canvas.getContext('2d');
  let w = (canvas.width = window.innerWidth);
  let h = (canvas.height = window.innerHeight);
  const blob = document.getElementById('parallax-blob');
  // Lion smoke canvas (optional)
  const lionCanvas = document.getElementById('lion-smoke');
  const lionCtx = lionCanvas ? lionCanvas.getContext('2d') : null;
  const customCursorEl = document.getElementById('custom-cursor');
  const toggleBtn = document.getElementById('effects-toggle');
  // Utilities
  const TAU = Math.PI * 2;
  const rnd = (min, max) => min + Math.random() * (max - min);
  const fract = (x) => x - Math.floor(x);
  // Cheap pseudo-noise in 3D (x,y,t), fast enough and good for flow direction
  function hash3(x, y, t){
    return Math.sin(x*12.9898 + y*78.233 + t*37.719) * 43758.5453;
  }


  // Белый хвост факела (неяркий, короткий)
  function spawnWhiteTail(x, y, speed, vx, vy) {
    const mag = Math.hypot(vx, vy) || 1;
    const dirX = -vx / mag; // хвост уходит за курсором
    const dirY = -vy / mag;
    const k = 0.9; // коэффициент скорости
    tailParticles.push({
      x: x + dirX * 2 + rnd(-1.5, 1.5),
      y: y + dirY * 2 + rnd(-1.5, 1.5),
      vx: dirX * k + rnd(-0.05, 0.05),
      vy: dirY * k + rnd(-0.05, 0.05),
      size: rnd(10, 18),
      life: rnd(0.30, 0.50), // хвостик быстрее гаснет
      age: 0,
      opacity: rnd(0.10, 0.18) // белый хвост менее яркий
    });
  }
  function noise3(x, y, t){
    // value noise with bilinear blend of hashed grid corners
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const t0 = t;
    const h00 = fract(Math.sin(hash3(xi, yi, t0)));
    const h10 = fract(Math.sin(hash3(xi+1, yi, t0)));
    const h01 = fract(Math.sin(hash3(xi, yi+1, t0)));
    const h11 = fract(Math.sin(hash3(xi+1, yi+1, t0)));
    const sx = xf*xf*(3-2*xf);
    const sy = yf*yf*(3-2*yf);
    const nx0 = h00*(1-sx) + h10*sx;
    const nx1 = h01*(1-sx) + h11*sx;
    return nx0*(1-sy) + nx1*sy; // 0..1
  }

  function sizeLionCanvas(){
    if (!lionCanvas) return;
    const host = lionCanvas.parentElement; // .lion-hero
    const rect = host.getBoundingClientRect();
    lionCanvas.width = Math.max(1, Math.floor(rect.width));
    lionCanvas.height = Math.max(1, Math.floor(rect.height));
  }

  // Particles
  const lionParticles = [];
  // Относительные координаты рта в пределах .lion-hero (0..1). Подогнано под новый кадр.
  let lionMouth = { x: 0.56, y: 0.52 };
  // Make lion smoke stronger
  const lionSmokeStrength = 1.25;
  // Style for additive glowing
  // We'll switch blend modes per-step; default here not critical
  ctx.globalCompositeOperation = 'source-over';

  function onResize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    sizeLionCanvas();
  }

  function onMove(e) {
    const x = e.clientX;
    const y = e.clientY;
    mouse.vx = x - mouse.lastX;
    mouse.vy = y - mouse.lastY;
    mouse.x = x;
    mouse.y = y;
    mouse.lastX = x;
    mouse.lastY = y;

    // Move custom cursor element
    if (customCursorEl) {
      // Центрируем кольцо (36px => смещение 18px)
      const o = 18;
      customCursorEl.style.transform = `translate3d(${x - o}px, ${y - o}px, 0)`;
    }

    // Генерируем легкие частицы дыма и искорки
    if (settings.enabled) {
      const speed = Math.hypot(mouse.vx, mouse.vy);
      // Масштабнее след: немного больше частиц и зависимость от скорости
      const numParticles = Math.floor(Math.min(7, 1 + speed * 0.16) * settings.density);

      for (let i = 0; i < numParticles; i++) {
        spawnSmokeParticle(x, y, speed);
      }

      // Ещё реже искорки, чтобы не слепили
      if (Math.random() < 0.12 && speed > 1.2) {
        spawnSparkle(x, y, speed);
      }

      // Немного белого хвоста в конце следа (визуально "факел")
      const tailCount = speed > 0.5 ? 2 : 0;
      for (let i = 0; i < tailCount; i++) {
        spawnWhiteTail(x, y, speed, mouse.vx, mouse.vy);
      }
    }
  }

  // Создание легкой частицы дыма (приглушенного)
  function spawnSmokeParticle(x, y, speed) {
    const angle = rnd(0, TAU);
    const velocity = rnd(0.25, 0.72);
    const life = rnd(1.0, 1.8); // чуть короче жизнь, чтобы меньше отставал след

    particles.push({
      x: x + rnd(-4, 4),
      y: y + rnd(-4, 4),
      vx: Math.cos(angle) * velocity * 0.45,
      vy: Math.sin(angle) * velocity * 0.45 - rnd(0.4, 1.1),
      size: rnd(22, 50),
      life: life,
      age: 0,
      opacity: rnd(0.09, 0.20), // меньше яркость дымки
      hue: rnd(40, 48),
      wobbleX: rnd(0, TAU),
      wobbleY: rnd(0, TAU),
      wobbleSpeed: rnd(0.01, 0.025),
      growthRate: rnd(1.2, 1.8)
    });
  }

  // Создание искорки
  function spawnSparkle(x, y, speed) {
    const angle = rnd(0, TAU);
    const velocity = rnd(1.0, 2.0);
    const life = rnd(0.45, 1.0);

    sparkles.push({
      x: x + rnd(-2, 2),
      y: y + rnd(-2, 2),
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity - rnd(0.4, 0.9),
      size: rnd(2.2, 4.6),
      life: life,
      age: 0,
      brightness: rnd(0.35, 0.60), // приглушённые искры
      hue: rnd(42, 50),
      twinkle: rnd(0, TAU)
    });
  }

  // Параметры среды
  const isCoarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let fadeAlpha = 0.18;
  if (isCoarse) fadeAlpha = 0.20;
  if (prefersReduced) fadeAlpha = Math.min(0.24, fadeAlpha + 0.02);

  function step(dt) {
    if (!settings.enabled) {
      ctx.clearRect(0, 0, w, h);
      return;
    }

    // Мягкое стирание холста (адаптируется под устройство)
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = `rgba(0,0,0,${fadeAlpha})`;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';

    const time = performance.now() * 0.001;

    // Обновляем и рисуем частицы
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.age += dt;

      // Удаляем старые частицы
      if (p.age >= p.life) {
        particles.splice(i, 1);
        continue;
      }

      // Прогресс жизни (0 = новая, 1 = старая)
      const t = p.age / p.life;

      // Органичное движение через турбулентность
      const noiseScale = 0.002;
      const noiseX = noise3(p.x * noiseScale, p.y * noiseScale, time * 0.5);
      const noiseY = noise3(p.y * noiseScale, p.x * noiseScale, time * 0.5 + 100);
      
      // Применяем турбулентность
      p.vx += (noiseX - 0.5) * 0.08;
      p.vy += (noiseY - 0.5) * 0.08 - 0.05; // Дополнительное движение вверх
      
      // Замедление
      p.vx *= 0.96;
      p.vy *= 0.96;

      // Колебание (wobble)
      p.wobbleX += p.wobbleSpeed;
      p.wobbleY += p.wobbleSpeed * 1.2;
      const wobbleOffsetX = Math.sin(p.wobbleX) * 8 * t;
      const wobbleOffsetY = Math.cos(p.wobbleY) * 6 * t;

      // Обновляем позицию
      p.x += p.vx + wobbleOffsetX * 0.1;
      p.y += p.vy + wobbleOffsetY * 0.1;

      // Рост размера и затухание
      const currentSize = p.size * (1 + t * p.growthRate);
      const currentOpacity = p.opacity * (1 - t * t * 1.1); // быстрее тускнеет

      // Рисуем частицу с радиальным градиентом
      ctx.save();
      ctx.globalCompositeOperation = 'lighter'; // Аддитивное смешивание

      const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, currentSize);
      
      // Приглушенный золотистый градиент
      const centerAlpha = currentOpacity * 0.25; // Уменьшена яркость
      const midAlpha = currentOpacity * 0.15;
      const outerAlpha = 0;

      gradient.addColorStop(0, `hsla(${p.hue}, 65%, 55%, ${centerAlpha})`); // Менее насыщенный
      gradient.addColorStop(0.3, `hsla(${p.hue - 2}, 60%, 50%, ${midAlpha})`);
      gradient.addColorStop(0.6, `hsla(${p.hue - 4}, 55%, 45%, ${midAlpha * 0.5})`);
      gradient.addColorStop(1, `hsla(${p.hue - 6}, 50%, 40%, ${outerAlpha})`);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(p.x, p.y, currentSize, 0, TAU);
      ctx.fill();

      ctx.restore();
    }


    // Рисуем искорки
    for (let i = sparkles.length - 1; i >= 0; i--) {
      const s = sparkles[i];
      s.age += dt;

      // Удаляем старые искорки
      if (s.age >= s.life) {
        sparkles.splice(i, 1);
        continue;
      }

      const t = s.age / s.life;

      // Применяем турбулентность к искоркам
      const noiseScale = 0.003;
      const noiseX = noise3(s.x * noiseScale, s.y * noiseScale, time * 0.8);
      const noiseY = noise3(s.y * noiseScale, s.x * noiseScale, time * 0.8 + 50);
      
      s.vx += (noiseX - 0.5) * 0.15;
      s.vy += (noiseY - 0.5) * 0.15 - 0.08; // Движение вверх
      
      s.vx *= 0.94; // Быстрое замедление
      s.vy *= 0.94;

      s.x += s.vx;
      s.y += s.vy;

      // Эффект мерцания
      s.twinkle += 0.15;
      const twinkleEffect = (Math.sin(s.twinkle) * 0.5 + 0.5);

      // Затухание
      const currentOpacity = s.brightness * (1 - t * t) * twinkleEffect;
      const currentSize = s.size * (1 - t * 0.3);

      // Рисуем искорку (менее яркую)
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      // Яркое ядро
      ctx.beginPath();
      ctx.arc(s.x, s.y, currentSize, 0, TAU);
      ctx.fillStyle = `hsla(${s.hue}, 80%, 75%, ${currentOpacity})`;
      ctx.fill();

      // Мягкое свечение вокруг
      const glowGradient = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, currentSize * 3);
      glowGradient.addColorStop(0, `hsla(${s.hue}, 75%, 70%, ${currentOpacity * 0.22})`);
      glowGradient.addColorStop(0.5, `hsla(${s.hue - 2}, 70%, 62%, ${currentOpacity * 0.10})`);
      glowGradient.addColorStop(1, `hsla(${s.hue - 5}, 60%, 50%, 0)`);
      
      ctx.beginPath();
      ctx.arc(s.x, s.y, currentSize * 3, 0, TAU);
      ctx.fillStyle = glowGradient;
      ctx.fill();

      ctx.restore();
    }

    // Рисуем белый хвост (всегда сверху дымка, мягкий)
    for (let i = tailParticles.length - 1; i >= 0; i--) {
      const t = tailParticles[i];
      t.age += dt;
      if (t.age >= t.life) { tailParticles.splice(i, 1); continue; }
      // движение и демпфирование
      t.vx *= 0.96;
      t.vy *= 0.96;
      t.x += t.vx;
      t.y += t.vy;

      const q = t.age / t.life;
      const size = t.size * (1 + q * 0.3);
      const alpha = t.opacity * (1 - q*q);

      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const g = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, size);
      g.addColorStop(0, `rgba(255,255,255,${alpha})`);
      g.addColorStop(0.5, `rgba(255,255,255,${alpha * 0.35})`);
      g.addColorStop(1, `rgba(255,255,255,0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(t.x, t.y, size, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    // Ограничиваем количество частиц
    const particleLimit = 110; // немного меньше частиц
    const sparkleLimit = 50;
    const tailLimit = 120;
    if (particles.length > particleLimit) {
      particles.splice(0, particles.length - particleLimit);
    }
    if (sparkles.length > sparkleLimit) {
      sparkles.splice(0, sparkles.length - sparkleLimit);
    }
    if (tailParticles.length > tailLimit) {
      tailParticles.splice(0, tailParticles.length - tailLimit);
    }
  }

  function loop(t) {
    const dt = Math.min(0.05, (t - lastTime) / 1000);
    lastTime = t;
    step(dt);
    lionStep(dt);
    requestAnimationFrame(loop);
  }

  // Init
  window.addEventListener('resize', onResize);
  window.addEventListener('mousemove', onMove, { passive: true });
  window.addEventListener('touchmove', (e)=>{
    const t = e.touches[0];
    if (t) onMove({ clientX: t.clientX, clientY: t.clientY });
  }, { passive: true });
  onResize();
  // Place custom cursor initially at center
  if (customCursorEl) {
    const o = 18;
    customCursorEl.style.transform = `translate3d(${mouse.x - o}px, ${mouse.y - o}px, 0)`;
  }
  requestAnimationFrame(loop);

  // Public API to control effect
  window.initCursorEffect = function initCursorEffect(opts = {}) {
    settings.enabled = opts.enabled !== undefined ? opts.enabled : settings.enabled;
    settings.density = typeof opts.density === 'number' ? opts.density : settings.density;
    // Показываем нативный курсор (по требованию)
    document.body.style.cursor = '';
    if (toggleBtn) toggleBtn.textContent = settings.enabled ? 'Эффекты: вкл' : 'Эффекты: выкл';
  };

  // --- Навигация: бургер на мобильных ---
  const nav = document.getElementById('site-nav');
  const navToggle = document.querySelector('.nav-toggle');
  if (nav && navToggle) {
    navToggle.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    // Закрываем при клике по ссылке
    nav.addEventListener('click', (e) => {
      const t = e.target;
      if (t && t.tagName === 'A') {
        nav.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // --- Облегчённый эффект на touch-устройствах ---
  const isCoarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  if (isCoarse) {
    settings.density = Math.min(settings.density, 0.75);
  }

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      settings.enabled = !settings.enabled;
      window.initCursorEffect({ enabled: settings.enabled });
    });
  }

  // Footer year
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear().toString();

  // Reveal animations via IntersectionObserver
  const reveals = Array.from(document.querySelectorAll('.reveal'));
  if ('IntersectionObserver' in window && reveals.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('is-visible');
          io.unobserve(e.target);
        }
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });
    reveals.forEach(el => io.observe(el));
  } else {
    reveals.forEach(el => el.classList.add('is-visible'));
  }

  // Parallax blob follows mouse slowly
  let bx = window.innerWidth * 0.2, by = window.innerHeight * 0.8;
  function updateBlob() {
    // Smooth follow
    bx += (mouse.x - bx) * 0.03;
    by += (mouse.y - by) * 0.03;
    if (blob) {
      blob.style.transform = `translate3d(${bx * 0.06}px, ${by * 0.04}px, 0)`;
    }
    requestAnimationFrame(updateBlob);
  }
  updateBlob();

  // Subtle hover glow for .card and .feature and .btn
  const glows = document.querySelectorAll('.card, .feature, .btn');
  glows.forEach(el => {
    el.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      el.style.setProperty('--mx', `${x}px`);
      el.style.setProperty('--my', `${y}px`);
    });
    el.addEventListener('mouseleave', () => {
      el.style.removeProperty('--mx');
      el.style.removeProperty('--my');
    });
  });

  // --- Lion smoke ---
  function spawnLionParticle(px, py) {
    if (!lionCtx || !lionCanvas) return;
    // Golden warm smoke drifting upward from mouth
    const angle = -Math.PI / 2 + rnd(-0.5, 0.5); // mostly upward
    const speed = rnd(0.25, 0.9);
    const life = rnd(0.8, 1.6);
    const size = rnd(8, 22);
    const hue = 48 + rnd(-6, 4);
    const sat = rnd(78, 96);
    const light = rnd(58, 75);
    lionParticles.push({
      x: px, y: py,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 0.05,
      life, age: 0, size, hue, sat, light,
      drag: rnd(0.92, 0.97), curl: rnd(-0.02, 0.02), rot: rnd(0, Math.PI * 2)
    });
  }

  function lionStep(dt) {
    if (!lionCtx || !lionCanvas) return;
    lionCtx.clearRect(0, 0, lionCanvas.width, lionCanvas.height);
    // Emit from mouth location each frame
    const host = lionCanvas.parentElement; // .lion-hero
    const mouthX = lionCanvas.width * lionMouth.x;
    const mouthY = lionCanvas.height * lionMouth.y;
    for (let i = 0; i < 12; i++) spawnLionParticle(mouthX, mouthY);

    for (let i = lionParticles.length - 1; i >= 0; i--) {
      const p = lionParticles[i];
      p.age += dt;
      if (p.age >= p.life) { lionParticles.splice(i, 1); continue; }
      // motion
      p.vx += Math.cos(p.rot) * p.curl * 0.4;
      p.vy += Math.sin(p.rot) * p.curl * 0.4 - 0.01;
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.curl * 2;

      const t = p.age / p.life;
      const alpha = (1 - t) * 0.85;
      const size = p.size * (1 + (1 - t) * 0.4);
      const grd = lionCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size);
      grd.addColorStop(0, `hsla(${p.hue}, ${p.sat}%, ${Math.min(99, p.light + 25)}%, ${alpha})`);
      grd.addColorStop(0.3, `hsla(${p.hue - 2}, ${p.sat}%, ${p.light}%, ${alpha * 0.7})`);
      grd.addColorStop(1, `hsla(${p.hue - 10}, ${Math.max(36, p.sat - 30)}%, ${Math.max(24, p.light - 30)}%, ${alpha * 0.18})`);
      lionCtx.beginPath();
      lionCtx.fillStyle = grd;
      lionCtx.arc(p.x, p.y, size, 0, TAU);
      lionCtx.fill();
    }

    // cap
    if (lionParticles.length > 600) lionParticles.splice(0, lionParticles.length - 600);
  }
})();
