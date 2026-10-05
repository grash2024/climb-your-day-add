/**
 * CLIMB YOUR DAY — Promotional Motion Graphic Timeline Engine
 * 12-scene frame-accurate motion graphics, procedural mountain generation,
 * parallax camera, particle engine, and interactive scrubber.
 */

(function () {
  'use strict';

  // -------------------------------------------------------------
  // 1. CONSTANTS & SCENE DEFINITIONS
  // -------------------------------------------------------------
  const TOTAL_DURATION = 86.0; // 12 scenes across 86 seconds

  const SCENES = [
    { id: 1,  name: 'The Beginning',        start: 0.0,  end: 6.8  },
    { id: 2,  name: 'Add Your Habits',       start: 6.8,  end: 14.5 },
    { id: 3,  name: 'Complete a Habit',      start: 14.5, end: 22.5 },
    { id: 4,  name: 'Mountain Progress',     start: 22.5, end: 28.0 },
    { id: 5,  name: 'Daily Streak',          start: 28.0, end: 34.0 },
    { id: 6,  name: 'Smart Reminders',       start: 34.0, end: 40.0 },
    { id: 7,  name: 'Fight Distractions',    start: 40.0, end: 47.5 },
    { id: 8,  name: 'Focus Time',            start: 47.5, end: 54.5 },
    { id: 9,  name: 'Mountain Checkpoints',  start: 54.5, end: 63.5 },
    { id: 10, name: 'Summit Reached',        start: 63.5, end: 69.0 },
    { id: 11, name: 'Full App Overview',     start: 69.0, end: 76.5 },
    { id: 12, name: 'Your Summit',           start: 76.5, end: 86.0 }
  ];

  // Mountain trail control points (1920x1080 coordinate space)
  // Base camp (840, 1020) winding up ridges to summit peak (980, 140)
  const TRAIL_POINTS = [
    { x: 840, y: 1020 },
    { x: 790, y: 980 },
    { x: 670, y: 920 },
    { x: 620, y: 880 },
    { x: 740, y: 840 },
    { x: 890, y: 810 },
    { x: 940, y: 770 },
    { x: 880, y: 720 },
    { x: 730, y: 670 },
    { x: 690, y: 620 },
    { x: 790, y: 570 },
    { x: 970, y: 530 },
    { x: 1030, y: 480 },
    { x: 960, y: 430 },
    { x: 880, y: 380 },
    { x: 910, y: 320 },
    { x: 990, y: 270 },
    { x: 970, y: 210 },
    { x: 980, y: 140 }
  ];

  // Mountain Checkpoints along trail progress (0.0 to 1.0)
  const CHECKPOINTS = [
    { progress: 0.00, title: 'START',        subtitle: 'Base Camp',   icon: '#i-mountain', tag: 'BASE' },
    { progress: 0.18, title: 'FIRST STEP',   subtitle: 'Altitude 2',  icon: '#i-bolt',     tag: 'LV 2' },
    { progress: 0.36, title: 'CONSISTENCY',  subtitle: 'Ridge Camp',  icon: '#i-flame',    tag: 'LV 5' },
    { progress: 0.55, title: 'DISCIPLINE',   subtitle: 'High Trail',  icon: '#i-flag',     tag: 'LV 8' },
    { progress: 0.74, title: 'MOMENTUM',     subtitle: 'Snow Line',   icon: '#i-star',     tag: 'LV 10'},
    { progress: 1.00, title: 'SUMMIT',       subtitle: 'The Peak',    icon: '#i-sun',      tag: 'SUMMIT'}
  ];

  // -------------------------------------------------------------
  // 2. EASING & INTERPOLATION HELPERS
  // -------------------------------------------------------------
  const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  const easeInOutCubic = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
  const easeInCubic = t => t * t * t;
  const easeOutBack = (t, s = 1.6) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
  const easeOutElastic = t => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
  };

  // Color interpolation helpers for dynamic day/night/sunrise sky
  function hexToRgb(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const num = parseInt(hex, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  }
  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
  }
  function lerpColor(c1, c2, t) {
    const rgb1 = hexToRgb(c1);
    const rgb2 = hexToRgb(c2);
    return rgbToHex(
      lerp(rgb1[0], rgb2[0], t),
      lerp(rgb1[1], rgb2[1], t),
      lerp(rgb1[2], rgb2[2], t)
    );
  }

  // -------------------------------------------------------------
  // 3. PROCEDURAL SVG ASSET GENERATION
  // -------------------------------------------------------------
  let trailPathEl = null;
  let trailTotalLength = 0;

  function buildSpline(points) {
    if (points.length < 2) return '';
    let d = `M ${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x},${p2.y}`;
    }
    return d;
  }

  function initProceduralSVG() {
    // 1. Stars in the sky
    const starsG = document.getElementById('stars');
    if (starsG) {
      let starsMarkup = '';
      for (let i = 0; i < 90; i++) {
        const x = (i * 21.37 + 17) % 1920;
        const y = ((i * 37.19 + 43) % 480) + 20;
        const r = (i % 5 === 0 ? 1.8 : i % 3 === 0 ? 1.3 : 0.85);
        const o = 0.25 + 0.65 * ((i * 7) % 10) / 10;
        starsMarkup += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="#fff" opacity="${o.toFixed(2)}" class="star star-${i}"/>`;
      }
      starsG.innerHTML = starsMarkup;
    }

    // 2. Far mountain ranges
    const farA = document.getElementById('farA');
    if (farA) {
      farA.setAttribute('d',
        'M-200,680 L120,530 L280,590 L490,460 L680,540 L880,410 L1080,490 L1260,390 L1460,490 L1660,420 L1840,490 L2120,680 L2120,1100 L-200,1100 Z');
    }
    const farB = document.getElementById('farB');
    if (farB) {
      farB.setAttribute('d',
        'M-200,720 L80,600 L240,650 L420,540 L600,610 L790,500 L990,570 L1180,470 L1380,570 L1580,490 L1760,560 L1950,510 L2120,720 L2120,1100 L-200,1100 Z');
    }

    // 3. Mid mountain range
    const midRange = document.getElementById('midRange');
    if (midRange) {
      midRange.setAttribute('d',
        'M-200,780 L180,640 L340,700 L560,570 L760,670 L980,510 L1180,640 L1360,550 L1560,670 L1740,590 L2120,800 L2120,1100 L-200,1100 Z');
    }

    // 4. Main mountain geometry (epic peak at 980, 140)
    const mClipPath = document.getElementById('mClipPath');
    const mPathD = 'M320,1080 L620,720 L760,800 L870,510 L940,580 L980,140 L1020,440 L1120,380 L1260,660 L1420,580 L1680,1080 Z';
    if (mClipPath) mClipPath.setAttribute('d', mPathD);

    const mBase = document.getElementById('mBase');
    if (mBase) mBase.setAttribute('d', mPathD);

    const mLight = document.getElementById('mLight');
    if (mLight) {
      mLight.setAttribute('d', 'M980,140 L870,510 L760,800 L620,720 L320,1080 L980,1080 Z');
    }

    const mShade = document.getElementById('mShade');
    if (mShade) {
      mShade.setAttribute('d', 'M980,140 L1020,440 L1120,380 L1260,660 L1420,580 L1680,1080 L980,1080 Z');
    }

    const mShade2 = document.getElementById('mShade2');
    if (mShade2) {
      mShade2.setAttribute('d', 'M980,140 L970,360 L1040,490 L1010,680 L1150,780 L1090,1080 L1680,1080 Z');
    }

    // Subtle mountain facets for modern 2.5D topographic structure
    const mFacets = document.getElementById('mFacets');
    if (mFacets) {
      mFacets.innerHTML = `
        <line x1="980" y1="140" x2="980" y2="1080"/>
        <line x1="980" y1="140" x2="870" y2="510"/>
        <line x1="870" y1="510" x2="740" y2="840"/>
        <line x1="980" y1="140" x2="1020" y2="440"/>
        <line x1="1020" y1="440" x2="1120" y2="380"/>
        <line x1="1020" y1="440" x2="1260" y2="660"/>
        <line x1="870" y1="510" x2="940" y2="580"/>
        <line x1="940" y1="580" x2="980" y2="760"/>
        <line x1="980" y1="760" x2="1080" y2="920"/>
        <line x1="760" y1="800" x2="670" y2="920"/>
      `;
    }

    // Snow caps
    const mSnow = document.getElementById('mSnow');
    if (mSnow) {
      mSnow.setAttribute('d',
        'M980,140 L942,220 L960,230 L935,270 L965,280 L948,320 L980,310 Z');
    }
    const mSnowS = document.getElementById('mSnowS');
    if (mSnowS) {
      mSnowS.setAttribute('d',
        'M980,140 L980,310 L1008,300 L995,260 L1020,240 L1002,210 L1012,185 Z');
    }
    const mSnow2 = document.getElementById('mSnow2');
    if (mSnow2) {
      mSnow2.setAttribute('d',
        'M870,510 L842,548 L864,556 L852,580 L870,572 Z');
    }
    const mSnow3 = document.getElementById('mSnow3');
    if (mSnow3) {
      mSnow3.setAttribute('d',
        'M1120,380 L1102,410 L1124,420 L1114,440 L1138,432 Z');
    }

    // Ground and valley foothills
    const mGround = document.getElementById('mGround');
    if (mGround) {
      mGround.setAttribute('d',
        'M0,1080 L0,970 C 240,960 460,940 680,980 C 900,1020 1140,990 1420,960 C 1680,930 1820,950 1920,960 L1920,1080 Z');
    }

    // Pine trees cluster along the valley
    const mTrees = document.getElementById('mTrees');
    if (mTrees) {
      let treePath = '';
      const treeCols = [
        420, 460, 510, 560, 610, 660, 710, 750, 780, 810, 860,
        1100, 1140, 1190, 1240, 1290, 1340, 1390, 1450, 1520
      ];
      treeCols.forEach((tx, idx) => {
        const ty = 1000 + (idx % 3) * 14;
        const th = 28 + (idx % 4) * 8;
        const tw = th * 0.45;
        treePath += `M${tx},${ty} L${tx - tw},${ty} L${tx},${ty - th} L${tx + tw},${ty} Z `;
      });
      mTrees.setAttribute('d', treePath);
    }

    // 5. Climbing trail (smooth cubic Bézier spline)
    const splineD = buildSpline(TRAIL_POINTS);
    const trailBase = document.getElementById('trailBase');
    const trailGlow = document.getElementById('trailGlow');
    const trailProg = document.getElementById('trailProg');

    if (trailBase) trailBase.setAttribute('d', splineD);
    if (trailGlow) trailGlow.setAttribute('d', splineD);
    if (trailProg) {
      trailProg.setAttribute('d', splineD);
      trailPathEl = trailProg;
      trailTotalLength = trailProg.getTotalLength();
      trailProg.style.strokeDasharray = `${trailTotalLength} ${trailTotalLength}`;
      trailProg.style.strokeDashoffset = `${trailTotalLength}`;
    }

    // 6. Checkpoint Markers on the mountain trail
    const markersG = document.getElementById('markers');
    const wlabels = document.getElementById('wlabels');
    if (markersG && trailProg && trailTotalLength > 0) {
      let markersMarkup = '';
      let wlabelsMarkup = '';

      CHECKPOINTS.forEach((cp, idx) => {
        const pt = trailProg.getPointAtLength(cp.progress * trailTotalLength);
        const isSummit = idx === CHECKPOINTS.length - 1;

        // Flag / marker geometry
        markersMarkup += `
          <g id="cp-marker-${idx}" transform="translate(${pt.x.toFixed(1)}, ${pt.y.toFixed(1)})" class="trail-marker" opacity="0.8">
            <circle cx="0" cy="0" r="14" fill="#ffd39b" opacity="0.2"/>
            <circle cx="0" cy="0" r="4.5" fill="#fff" stroke="#ff9f5a" stroke-width="2"/>
            <line x1="0" y1="0" x2="0" y2="-22" stroke="#fff" stroke-width="1.8"/>
            <path d="M0,-22 L11,-16 L0,-10 Z" fill="${isSummit ? '#ffc27a' : '#ff9f5a'}"/>
          </g>
        `;

        // HTML world-anchored label card
        const isLeft = idx % 2 === 1;
        wlabelsMarkup += `
          <div class="wl ${isLeft ? 'left' : ''} ${isSummit ? 'big' : ''}" id="wl-${idx}" data-x="${pt.x.toFixed(1)}" data-y="${pt.y.toFixed(1)}">
            <span class="node"></span>
            <div class="pill"><svg class="ic"><use href="${cp.icon}"/></svg>${cp.title} · ${cp.tag}</div>
          </div>
        `;
      });
      markersG.innerHTML = markersMarkup;
      if (wlabels) wlabels.innerHTML = wlabelsMarkup;
    }

    // 7. Clouds (drifting puffy SVG clouds)
    const cloudsBack = document.getElementById('cloudsBack');
    if (cloudsBack) {
      cloudsBack.innerHTML = `
        <g id="cb1" opacity="0.65" fill="#f0f5fc">
          <ellipse cx="320" cy="420" rx="180" ry="45"/>
          <ellipse cx="260" cy="400" rx="110" ry="40"/>
          <ellipse cx="380" cy="405" rx="120" ry="35"/>
        </g>
        <g id="cb2" opacity="0.75" fill="#eaf2fb">
          <ellipse cx="1460" cy="380" rx="220" ry="50"/>
          <ellipse cx="1380" cy="360" rx="130" ry="42"/>
          <ellipse cx="1540" cy="365" rx="140" ry="38"/>
        </g>
      `;
    }

    const cloudsFront = document.getElementById('cloudsFront');
    if (cloudsFront) {
      cloudsFront.innerHTML = `
        <g id="cf1" opacity="0.5" fill="#ffffff">
          <ellipse cx="820" cy="740" rx="260" ry="55"/>
          <ellipse cx="740" cy="720" rx="160" ry="48"/>
          <ellipse cx="900" cy="725" rx="180" ry="44"/>
        </g>
      `;
    }

    // 8. Foreground framing hills and pine trees
    const fgHills = document.getElementById('fgHills');
    if (fgHills) {
      fgHills.setAttribute('d',
        'M-100,1080 L-100,890 C 180,890 320,970 540,1030 C 720,1080 840,1080 840,1080 Z M1920,1080 L1920,880 C 1720,880 1560,960 1340,1040 L1920,1080 Z');
    }
    const fgTrees = document.getElementById('fgTrees');
    if (fgTrees) {
      let ftPath = '';
      const leftTrees = [20, 80, 150, 220, 300, 380];
      const rightTrees = [1620, 1700, 1780, 1850, 1910];

      leftTrees.forEach((tx, i) => {
        const th = 80 + (i % 3) * 25;
        const tw = th * 0.45;
        const ty = 980 + (i % 2) * 20;
        ftPath += `M${tx},${ty} L${tx - tw},${ty} L${tx},${ty - th} L${tx + tw},${ty} Z `;
      });
      rightTrees.forEach((tx, i) => {
        const th = 85 + (i % 3) * 22;
        const tw = th * 0.45;
        const ty = 980 + (i % 2) * 20;
        ftPath += `M${tx},${ty} L${tx - tw},${ty} L${tx},${ty - th} L${tx + tw},${ty} Z `;
      });
      fgTrees.setAttribute('d', ftPath);
    }

    // 9. Summit View behind climber: Sun rays, Sea of clouds, Waving flag
    const sRays = document.getElementById('sRays');
    if (sRays) {
      let raysMarkup = '';
      for (let i = 0; i < 18; i++) {
        const angle = -120 + i * 14;
        const rad = angle * Math.PI / 180;
        const x2 = 1180 + Math.cos(rad) * 1600;
        const y2 = 660 + Math.sin(rad) * 1600;
        raysMarkup += `<line x1="1180" y1="660" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#fff" stroke-width="48" stroke-opacity="0.15"/>`;
      }
      sRays.innerHTML = raysMarkup;
    }

    const sClouds = document.getElementById('sClouds');
    if (sClouds) {
      let scMarkup = '';
      // Layered cloud sea under summit
      for (let i = 0; i < 14; i++) {
        const cx = -100 + i * 170;
        const cy = 690 + ((i * 17) % 5) * 12;
        const rx = 160 + (i % 3) * 40;
        const ry = 48 + (i % 2) * 12;
        const op = 0.75 + (i % 3) * 0.08;
        scMarkup += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#f4e6d4" opacity="${op}"/>`;
      }
      for (let i = 0; i < 16; i++) {
        const cx = -140 + i * 150;
        const cy = 730 + ((i * 13) % 4) * 14;
        const rx = 180 + (i % 3) * 35;
        const ry = 55 + (i % 2) * 10;
        scMarkup += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#ecd2be" opacity="0.9"/>`;
      }
      sClouds.innerHTML = scMarkup;
    }

    // 10. Studio Topo lines
    const topo = document.getElementById('topo');
    if (topo) {
      let topoMarkup = '';
      for (let i = 0; i < 8; i++) {
        const cy = 650 + i * 60;
        const r = 380 + i * 80;
        topoMarkup += `<circle cx="960" cy="${cy}" r="${r}"/>`;
      }
      topo.innerHTML = topoMarkup;
    }

    // 11. 7 Day streak polyline in Scene 5 card
    const stBase = document.getElementById('stBase');
    const streakWrap = document.getElementById('streakWrap');
    if (stBase && streakWrap) {
      // 7 days: MON to SUN
      const sPoints = [
        { d: 'MON', x: 40,  y: 200 },
        { d: 'TUE', x: 120, y: 175 },
        { d: 'WED', x: 200, y: 155 },
        { d: 'THU', x: 280, y: 120 },
        { d: 'FRI', x: 360, y: 95  },
        { d: 'SAT', x: 440, y: 65  },
        { d: 'SUN', x: 520, y: 35  }
      ];
      stBase.setAttribute('points', sPoints.map(p => `${p.x},${p.y}`).join(' '));

      // Append HTML day badges
      sPoints.forEach((p, idx) => {
        const dayEl = document.createElement('div');
        dayEl.className = 'sday';
        dayEl.id = `sday-${idx}`;
        dayEl.style.left = `${p.x - 22}px`;
        dayEl.style.top = `${p.y - 22}px`;
        dayEl.innerHTML = `
          <div class="sd-ring"></div>
          <div class="sd-done" id="sd-done-${idx}" style="opacity:0; transform:scale(0.4)"><svg class="ic"><use href="#i-check"/></svg></div>
          <div class="sd-lbl">${p.d}</div>
        `;
        streakWrap.appendChild(dayEl);
      });

      // Animated glowing avatar marker on streak
      const me = document.createElement('div');
      me.className = 'sd-me';
      me.id = 'streakAvatar';
      me.style.opacity = '0';
      streakWrap.appendChild(me);
    }

    // 12. Distraction Scene: 6 Generic floating app cards (no trademarks)
    const distractContainer = document.getElementById('distract');
    if (distractContainer) {
      const appConfigs = [
        { icon: '#i-chat',   bg: 'linear-gradient(135deg, #4d7cf2, #3058b8)', x: 360,  y: 220, count: '99+' },
        { icon: '#i-camera', bg: 'linear-gradient(135deg, #e5537e, #b82a56)', x: 240,  y: 520, count: '48'  },
        { icon: '#i-play',   bg: 'linear-gradient(135deg, #e34343, #a81c1c)', x: 400,  y: 780, count: '12'  },
        { icon: '#i-music',  bg: 'linear-gradient(135deg, #2ecc71, #1e824c)', x: 1420, y: 240, count: '24'  },
        { icon: '#i-image',  bg: 'linear-gradient(135deg, #9b59b6, #6c3483)', x: 1560, y: 540, count: '105' },
        { icon: '#i-heart',  bg: 'linear-gradient(135deg, #f39c12, #d35400)', x: 1400, y: 800, count: '73'  }
      ];

      let iconsMarkup = '';
      appConfigs.forEach((cfg, i) => {
        iconsMarkup += `
          <div class="app-ico" id="app-ico-${i}" style="left:${cfg.x}px; top:${cfg.y}px;">
            <div class="ico-face" style="background:${cfg.bg};">
              <svg class="ic"><use href="${cfg.icon}"/></svg>
              <span class="badge">${cfg.count}</span>
            </div>
            <div class="ico-lock" id="app-lock-${i}"><svg class="ic"><use href="#i-lock"/></svg></div>
          </div>
        `;
      });
      distractContainer.innerHTML = iconsMarkup;
    }

    // 13. Feed Track mock items (generic unbranded vertical video / feed posts)
    const feedTrack = document.getElementById('feedTrack');
    if (feedTrack) {
      let feedMarkup = '';
      const hues = [
        ['#345995', '#03cea4'],
        ['#fb4d3d', '#eac435'],
        ['#540d6e', '#ee4266'],
        ['#0077b6', '#90e0ef'],
        ['#f77f00', '#d62828']
      ];
      for (let i = 0; i < 10; i++) {
        const h = hues[i % hues.length];
        feedMarkup += `
          <article class="post">
            <div class="p-head">
              <div class="p-ava" style="background:linear-gradient(135deg, ${h[0]}, ${h[1]});"></div>
              <div class="p-lines"><i style="width:${80 + (i % 3) * 20}px"></i><i style="width:${50 + (i % 2) * 20}px"></i></div>
            </div>
            <div class="p-media" style="background:linear-gradient(160deg, ${h[0]}, ${h[1]});">
              <u style="width:140px; height:140px; left:20px; top:30px; background:${h[1]}; filter:blur(40px)"></u>
            </div>
            <div class="p-acts">
              <svg class="ic"><use href="#i-heart"/></svg>
              <svg class="ic"><use href="#i-chat"/></svg>
              <svg class="ic"><use href="#i-share"/></svg>
              <svg class="ic"><use href="#i-bookmark"/></svg>
            </div>
            <div class="p-cap"><i style="width:90%"></i><i style="width:65%"></i></div>
          </article>
        `;
      }
      feedTrack.innerHTML = feedMarkup;
    }

    // 14. Scrubber ticks for the 12 scenes
    const ticksContainer = document.getElementById('ticks');
    if (ticksContainer) {
      let ticksMarkup = '';
      SCENES.forEach((sc, i) => {
        if (i === 0) return;
        const pct = (sc.start / TOTAL_DURATION) * 100;
        ticksMarkup += `<i style="left:${pct.toFixed(2)}%" title="Scene ${sc.id}: ${sc.name}"></i>`;
      });
      ticksContainer.innerHTML = ticksMarkup;
    }
  }

  // -------------------------------------------------------------
  // 4. PARTICLE ENGINE (Canvas based + high performance)
  // -------------------------------------------------------------
  const particlesCanvas = document.getElementById('particles');
  const pCtx = particlesCanvas ? particlesCanvas.getContext('2d') : null;

  class ParticleSystem {
    constructor() {
      this.particles = [];
      this.bursts = [];
    }

    spawnBurst(sourceX, sourceY, targetX, targetY, count = 28, color = '#ffc27a') {
      for (let i = 0; i < count; i++) {
        // Control point for quadratic curve with spread
        const midX = (sourceX + targetX) / 2 + (Math.random() - 0.5) * 320;
        const midY = Math.min(sourceY, targetY) - 120 - Math.random() * 200;

        this.particles.push({
          sx: sourceX + (Math.random() - 0.5) * 40,
          sy: sourceY + (Math.random() - 0.5) * 20,
          cx: midX,
          cy: midY,
          tx: targetX,
          ty: targetY,
          progress: 0,
          speed: 0.016 + Math.random() * 0.014,
          size: 3.5 + Math.random() * 4.5,
          color: Math.random() > 0.3 ? color : '#ffffff',
          alpha: 1,
          type: 'stream'
        });
      }
    }

    spawnSparks(x, y, count = 18, color = '#ffd39b') {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd = 2 + Math.random() * 6;
        this.particles.push({
          x: x,
          y: y,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd - 1.5,
          size: 2 + Math.random() * 3,
          color: color,
          alpha: 1,
          decay: 0.02 + Math.random() * 0.03,
          type: 'spark'
        });
      }
    }

    update() {
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        if (p.type === 'stream') {
          p.progress += p.speed;
          if (p.progress >= 1) {
            // Arrived at target -> spark explosion!
            this.spawnSparks(p.tx, p.ty, 4, p.color);
            this.particles.splice(i, 1);
            continue;
          }
          // Quadratic bezier interpolation
          const t = p.progress;
          const inv = 1 - t;
          p.x = inv * inv * p.sx + 2 * inv * t * p.cx + t * t * p.tx;
          p.y = inv * inv * p.sy + 2 * inv * t * p.cy + t * t * p.ty;
        } else if (p.type === 'spark') {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.12; // gravity
          p.alpha -= p.decay;
          if (p.alpha <= 0) {
            this.particles.splice(i, 1);
          }
        }
      }
    }

    render(ctx) {
      if (!ctx) return;
      ctx.clearRect(0, 0, 1920, 1080);

      // Render all active particles
      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    clear() {
      this.particles = [];
      if (pCtx) pCtx.clearRect(0, 0, 1920, 1080);
    }
  }

  const particleSys = new ParticleSystem();

  // -------------------------------------------------------------
  // 5. TIMELINE ENGINE: PARALLAX CAMERA, SKY LIGHTING & CLIMBER
  // -------------------------------------------------------------
  const stage = document.getElementById('stage');
  const world = document.getElementById('world');
  const sky = document.getElementById('sky');
  const phone = document.getElementById('phone');
  const dim = document.getElementById('dim');
  const summit = document.getElementById('summit');
  const studio = document.getElementById('studio');
  const flash = document.getElementById('flash');
  const endDark = document.getElementById('endDark');
  const fadeBlack = document.getElementById('fadeBlack');
  const disclaimerTop = document.getElementById('disclaimerTop');
  const climber = document.getElementById('climber');
  const climberFlip = document.getElementById('cFlip');
  const climberBob = document.getElementById('cBob');
  const climberLamp = document.getElementById('cLamp');
  const climbChip = document.getElementById('climbChip');
  const chipBar = document.getElementById('chipBar');
  const chipPlus = document.getElementById('chipPlus');
  const peakGlow = document.getElementById('peakGlow');

  // Sky Lighting Keyframes
  // Morning dawn -> Fresh daytime -> Sunset golden hour -> Twilight -> Summit Sunrise
  function computeSkyTheme(t) {
    let sky1, sky2, sky3, sunColor, haze, lit, shade, trailColor;

    if (t < 7.0) {
      // S1: Peaceful sunrise dawn
      sky1 = '#09152e'; sky2 = '#193059'; sky3 = '#e09872';
      sunColor = '#ffd9a8'; haze = '#d89476';
      lit = '#2d598e'; shade = '#13284c'; trailColor = '#ffd39b';
    } else if (t < 28.0) {
      // S2 - S4: Crisp motivating daytime mountain
      sky1 = '#132e5e'; sky2 = '#346ba3'; sky3 = '#93c2ec';
      sunColor = '#ffffff'; haze = '#7aaad6';
      lit = '#3b6ea8'; shade = '#173059'; trailColor = '#ffd39b';
    } else if (t < 35.0) {
      // S5: Daily Streak -> Transition from day into sunset!
      const p = clamp((t - 28.0) / 6.0);
      sky1 = lerpColor('#132e5e', '#16193d', p);
      sky2 = lerpColor('#346ba3', '#683f6b', p);
      sky3 = lerpColor('#93c2ec', '#f09865', p);
      sunColor = lerpColor('#ffffff', '#ffb070', p);
      haze = lerpColor('#7aaad6', '#d67554', p);
      lit = lerpColor('#3b6ea8', '#4d4670', p);
      shade = lerpColor('#173059', '#191c38', p);
      trailColor = '#ffd39b';
    } else if (t < 48.0) {
      // S6 - S7: Evening & Twilight (Distraction fighting & Reminders)
      sky1 = '#090e22'; sky2 = '#172242'; sky3 = '#423d5e';
      sunColor = '#ffcf98'; haze = '#36344d';
      lit = '#243b60'; shade = '#0d182e'; trailColor = '#ffd39b';
    } else if (t < 63.5) {
      // S8 - S9: Deep focused twilight turning towards pre-dawn
      sky1 = '#081126'; sky2 = '#14274c'; sky3 = '#3b4369';
      sunColor = '#ffd39b'; haze = '#263452';
      lit = '#264470'; shade = '#0d1d38'; trailColor = '#ffd39b';
    } else {
      // S10 - S12: Radiant golden summit sunrise!
      sky1 = '#0e1d40'; sky2 = '#2e4e84'; sky3 = '#f7ab76';
      sunColor = '#fff5de'; haze = '#e8a176';
      lit = '#3b6294'; shade = '#14274a'; trailColor = '#ffd39b';
    }

    return { sky1, sky2, sky3, sunColor, haze, lit, shade, trailColor };
  }

  // Camera Target interpolation { cx, cy, zoom }
  function computeCamera(t) {
    // 1920x1080 stage coordinates
    if (t < 4.0) {
      // S1: Wide serene landscape, camera slowly pushes toward mountain
      const p = easeInOutCubic(clamp(t / 4.0));
      return { cx: 960, cy: lerp(580, 540, p), zoom: lerp(0.96, 1.05, p) };
    }
    if (t < 6.8) {
      // S1 to S2: Focus toward basecamp
      const p = easeInOutCubic(clamp((t - 4.0) / 2.8));
      return { cx: lerp(960, 840, p), cy: lerp(540, 720, p), zoom: lerp(1.05, 1.25, p) };
    }
    if (t < 14.5) {
      // S2: Phone UI in focus, mountain blurred/dimmed behind
      return { cx: 800, cy: 620, zoom: 1.15 };
    }
    if (t < 22.5) {
      // S3: Complete a habit. Phone on right, mountain & climber on left!
      const p = easeInOutCubic(clamp((t - 14.5) / 2.0));
      return { cx: lerp(800, 780, p), cy: 680, zoom: lerp(1.15, 1.22, p) };
    }
    if (t < 28.0) {
      // S4: Zoom OUT to reveal entire mountain!
      const p = easeInOutCubic(clamp((t - 22.5) / 2.5));
      return { cx: lerp(780, 960, p), cy: lerp(680, 530, p), zoom: lerp(1.22, 0.94, p) };
    }
    if (t < 34.0) {
      // S5: Daily streak, frame trail on left and streak on right
      return { cx: 960, cy: 530, zoom: 0.94 };
    }
    if (t < 40.0) {
      // S6: Reminders on lock screen
      return { cx: 900, cy: 580, zoom: 1.02 };
    }
    if (t < 47.5) {
      // S7: Distraction scene: camera pulls in as scrolling overwhelms, then resets when Focus Mode is activated
      if (t < 44.0) {
        const p = easeInOutCubic(clamp((t - 40.0) / 3.0));
        return { cx: 960, cy: lerp(580, 600, p), zoom: lerp(1.02, 1.08, p) };
      } else {
        const p = easeInOutCubic(clamp((t - 44.0) / 2.5));
        return { cx: lerp(960, 880, p), cy: lerp(600, 480, p), zoom: lerp(1.08, 1.18, p) };
      }
    }
    if (t < 54.5) {
      // S8: Focus mode countdown. Phone right, mountain left with climber advancing
      return { cx: 880, cy: 460, zoom: 1.2 };
    }
    if (t < 63.5) {
      // S9: Checkpoint fly-through! Camera pans up the ridges along with the climber
      const p = easeInOutCubic(clamp((t - 54.5) / 9.0));
      return {
        cx: lerp(820, 980, p),
        cy: lerp(850, 220, p),
        zoom: lerp(1.28, 1.45, p)
      };
    }
    if (t < 69.0) {
      // S10: Summit reached (behind the climber view)
      return { cx: 960, cy: 540, zoom: 1.0 };
    }
    if (t < 76.5) {
      // S11: Full App Overview in studio
      return { cx: 960, cy: 540, zoom: 1.0 };
    }
    // S12: Final Summit reveal & branding
    const p = easeInOutCubic(clamp((t - 76.5) / 5.0));
    return { cx: 960, cy: lerp(580, 520, p), zoom: lerp(0.98, 1.04, p) };
  }

  // Climber Trail Progress (0.0 at base to 1.0 at summit)
  function computeClimberProgress(t) {
    if (t < 17.0) return 0.04; // At basecamp
    if (t < 21.0) {
      // S3: Complete habit +50 pts -> Moves up to Checkpoint 1
      const p = easeOutCubic(clamp((t - 17.0) / 3.0));
      return lerp(0.04, 0.18, p);
    }
    if (t < 28.0) {
      // S4: Mountain progress 750/1000 pts -> Moves to Checkpoint 2
      const p = easeOutCubic(clamp((t - 23.5) / 3.5));
      return lerp(0.18, 0.36, p);
    }
    if (t < 34.0) {
      // S5: 7 day streak -> Moves to Checkpoint 3
      const p = easeOutCubic(clamp((t - 29.0) / 4.0));
      return lerp(0.36, 0.55, p);
    }
    if (t < 49.0) return 0.55;
    if (t < 54.0) {
      // S8: Focus session complete (+100 pts) -> Moves to Checkpoint 4 (Snow line)
      const p = easeOutCubic(clamp((t - 49.5) / 4.0));
      return lerp(0.55, 0.74, p);
    }
    if (t < 63.5) {
      // S9: Checkpoint ascent -> Moves to Summit!
      const p = easeInOutCubic(clamp((t - 55.0) / 8.0));
      return lerp(0.74, 1.00, p);
    }
    return 1.00; // At summit
  }

  // Phone Mockup 3D placement across scenes
  function updatePhonePlacement(t) {
    if (!phone) return;

    let visible = false;
    let x = 960, y = 540, scale = 1.0, rotY = 0, rotX = 0, opacity = 1;

    if (t >= 6.8 && t < 22.3) {
      // Scenes 2 & 3: Add & Complete Habits
      visible = true;
      if (t < 14.5) {
        // Center view for habit creation
        const p = easeOutBack(clamp((t - 6.8) / 0.8));
        x = 960;
        y = lerp(1200, 540, p);
        scale = lerp(0.85, 1.0, p);
        rotY = 0;
      } else {
        // Transition to right side so mountain/climber is visible on left
        const p = easeInOutCubic(clamp((t - 14.5) / 1.0));
        x = lerp(960, 1380, p);
        y = 540;
        scale = 0.98;
        rotY = lerp(0, -6, p);
      }
    } else if (t >= 33.8 && t < 39.9) {
      // Scene 6: Reminders on lockscreen & Habit detail
      visible = true;
      const p = easeOutBack(clamp((t - 33.8) / 0.8));
      x = lerp(500, 560, p);
      y = lerp(1200, 540, p);
      scale = 0.98;
      rotY = 5;
    } else if (t >= 39.9 && t < 47.5) {
      // Scene 7: Distractions & Rapid scrolling
      visible = true;
      const p = easeOutBack(clamp((t - 39.9) / 0.7));
      x = 960;
      y = lerp(1100, 540, p);
      scale = 0.98;

      // Distraction jitter before focus mode is enabled
      if (t > 40.8 && t < 43.8) {
        const shake = Math.sin(t * 40) * 3;
        x += shake;
      }
    } else if (t >= 47.5 && t < 54.5) {
      // Scene 8: Focus Timer
      visible = true;
      const p = easeOutBack(clamp((t - 47.5) / 0.7));
      x = lerp(1500, 1360, p);
      y = 540;
      scale = 0.98;
      rotY = -7;
    } else if (t >= 69.0 && t < 76.5) {
      // Scene 11: Full App Overview
      visible = true;
      const p = easeOutBack(clamp((t - 69.0) / 0.9));
      x = 960;
      y = lerp(1200, 540, p);
      scale = lerp(0.85, 1.02, p);
      rotY = Math.sin(t * 1.5) * 3;
    }

    if (visible) {
      phone.style.visibility = 'visible';
      phone.style.opacity = opacity;
      phone.style.transform = `translate3d(${x - 195}px, ${y - 410}px, 0) scale(${scale}) perspective(1200px) rotateY(${rotY}deg) rotateX(${rotX}deg)`;
    } else {
      phone.style.visibility = 'hidden';
      phone.style.opacity = '0';
    }
  }

  // -------------------------------------------------------------
  // 6. DECLARATIVE DATA ATTRIBUTES ANIMATOR
  // -------------------------------------------------------------
  // Animates elements tagged with data-in, data-out, data-fx, data-type, data-count, etc.
  const animatedElements = [];
  function initDataDrivenElements() {
    document.querySelectorAll('[data-in]').forEach(el => {
      animatedElements.push({
        el,
        inTime: parseFloat(el.getAttribute('data-in')),
        outTime: el.hasAttribute('data-out') ? parseFloat(el.getAttribute('data-out')) : Infinity,
        fx: el.getAttribute('data-fx') || 'fade',
        dur: parseFloat(el.getAttribute('data-dur') || '0.5'),
        odur: parseFloat(el.getAttribute('data-odur') || '0.4')
      });
    });
  }

  function updateDataDrivenElements(t) {
    for (let i = 0; i < animatedElements.length; i++) {
      const item = animatedElements[i];
      const el = item.el;

      if (t < item.inTime || t > item.outTime + item.odur) {
        el.style.visibility = 'hidden';
        el.style.opacity = '0';
        continue;
      }

      el.style.visibility = 'visible';

      // Entry phase
      let progress = 1;
      if (t < item.inTime + item.dur) {
        progress = clamp((t - item.inTime) / item.dur);
      }

      // Exit phase
      let exitProgress = 0;
      if (t > item.outTime) {
        exitProgress = clamp((t - item.outTime) / item.odur);
      }

      const enterVal = item.fx === 'pop' ? easeOutBack(progress) : easeOutCubic(progress);
      const exitVal = easeInCubic(exitProgress);

      const op = clamp(progress - exitProgress);
      el.style.opacity = op.toFixed(3);

      switch (item.fx) {
        case 'up': {
          const dy = lerp(36, 0, enterVal) - exitVal * 30;
          el.style.transform = `translate3d(0, ${dy.toFixed(1)}px, 0)`;
          break;
        }
        case 'drop': {
          const dy = lerp(-40, 0, enterVal) + exitVal * 20;
          el.style.transform = `translate3d(0, ${dy.toFixed(1)}px, 0)`;
          break;
        }
        case 'mask': {
          const dy = lerp(105, 0, enterVal);
          el.style.transform = `translate3d(0, ${dy.toFixed(1)}%, 0)`;
          break;
        }
        case 'pop': {
          const s = lerp(0.5, 1, enterVal) * (1 - exitVal * 0.2);
          el.style.transform = `scale(${s.toFixed(3)})`;
          break;
        }
        case 'scale': {
          const s = lerp(0.8, 1, enterVal);
          el.style.transform = `scale(${s.toFixed(3)})`;
          break;
        }
        case 'sheet': {
          const dy = lerp(100, 0, enterVal) + exitVal * 100;
          el.style.transform = `translate3d(0, ${dy.toFixed(1)}%, 0)`;
          break;
        }
        case 'left': {
          const dx = lerp(-40, 0, enterVal) - exitVal * 30;
          el.style.transform = `translate3d(${dx.toFixed(1)}px, 0, 0)`;
          break;
        }
        case 'right': {
          const dx = lerp(40, 0, enterVal) + exitVal * 30;
          el.style.transform = `translate3d(${dx.toFixed(1)}px, 0, 0)`;
          break;
        }
        case 'zoom': {
          const s = lerp(0.86, 1, enterVal);
          el.style.transform = `scale(${s.toFixed(3)})`;
          break;
        }
        default:
          el.style.transform = 'none';
          break;
      }
    }

    // Typewriter effects: data-type="text"
    document.querySelectorAll('[data-type]').forEach(el => {
      const text = el.getAttribute('data-type');
      const tin = parseFloat(el.getAttribute('data-tin') || '0');
      const tdur = parseFloat(el.getAttribute('data-tdur') || '1');
      if (t < tin) {
        el.textContent = '';
      } else {
        const p = clamp((t - tin) / tdur);
        const charCount = Math.floor(p * text.length);
        el.textContent = text.slice(0, charCount);
      }
    });

    // Number counters: data-count="from,to,start,dur"
    document.querySelectorAll('[data-count]').forEach(el => {
      const parts = el.getAttribute('data-count').split(',').map(Number);
      const [from, to, start, dur] = parts;
      if (t < start) {
        el.textContent = from.toLocaleString();
      } else {
        const p = easeOutCubic(clamp((t - start) / dur));
        const val = Math.round(lerp(from, to, p));
        el.textContent = val.toLocaleString();
      }
    });

    // Bar fills: data-bar="from,to,start,dur"
    document.querySelectorAll('[data-bar]').forEach(el => {
      const parts = el.getAttribute('data-bar').split(',').map(Number);
      const [from, to, start, dur] = parts;
      if (t < start) {
        el.style.width = `${from}%`;
      } else {
        const p = easeOutCubic(clamp((t - start) / dur));
        const val = lerp(from, to, p);
        el.style.width = `${val.toFixed(1)}%`;
      }
    });

    // Tap ripples: data-tap="timestamp"
    document.querySelectorAll('[data-tap]').forEach(el => {
      const tapTime = parseFloat(el.getAttribute('data-tap'));
      const dt = t - tapTime;
      if (dt >= 0 && dt <= 0.6) {
        const p = dt / 0.6;
        const ring = el.querySelector('.ring') || el;
        el.style.opacity = (1 - p).toFixed(2);
        el.style.transform = `scale(${lerp(0.8, 2.2, easeOutCubic(p)).toFixed(2)})`;
      } else {
        el.style.opacity = '0';
        el.style.transform = 'scale(0.8)';
      }
    });
  }

  // -------------------------------------------------------------
  // 7. SPECIFIC SCENE INTERACTION LOGIC
  // -------------------------------------------------------------
  let prevTime = 0;

  function updateSpecialScenes(t) {
    // ---------------- S3 & S8: Particle burst triggers ----------------
    // When "Read 20 Minutes" is completed at t = 17.2s
    if (prevTime < 17.2 && t >= 17.2) {
      // Source: Phone habit card chip on right -> Target: Climber on mountain trail!
      particleSys.spawnBurst(1400, 380, 780, 840, 36, '#ffc27a');
    }
    // When "Focus Session Complete" +100 points at t = 52.3s
    if (prevTime < 52.3 && t >= 52.3) {
      particleSys.spawnBurst(1360, 520, 960, 410, 42, '#ffd39b');
    }

    // ---------------- S4: Today's Progress Bar ----------------
    // S4 fills to 750 / 1000 points
    if (t >= 22.5 && t < 28.0) {
      // Climber chip display
      if (climbChip) {
        climbChip.style.visibility = 'visible';
        climbChip.style.opacity = clamp((t - 23.0) / 0.5);
        if (chipBar) chipBar.style.width = '75%';
        if (chipPlus) chipPlus.textContent = '+150';
      }
    } else {
      if (climbChip) climbChip.style.visibility = 'hidden';
    }

    // ---------------- S5: 7 Day Streak Animation ----------------
    if (t >= 28.0 && t < 34.0) {
      const p = clamp((t - 28.5) / 4.0);
      const activeDays = Math.min(7, Math.floor(p * 7) + 1);

      const streakN = document.getElementById('streakN');
      if (streakN) streakN.textContent = activeDays;

      // Fill streak polyline
      const sPoints = [
        { x: 40, y: 200 }, { x: 120, y: 175 }, { x: 200, y: 155 },
        { x: 280, y: 120 }, { x: 360, y: 95 }, { x: 440, y: 65 }, { x: 520, y: 35 }
      ];
      const progPoints = sPoints.slice(0, activeDays);
      const stProg = document.getElementById('stProg');
      if (stProg && progPoints.length > 0) {
        stProg.setAttribute('points', progPoints.map(pt => `${pt.x},${pt.y}`).join(' '));
      }

      // Day checkmark pop-ins
      for (let i = 0; i < 7; i++) {
        const checkEl = document.getElementById(`sd-done-${i}`);
        if (checkEl) {
          if (i < activeDays) {
            checkEl.style.opacity = '1';
            checkEl.style.transform = 'scale(1)';
          } else {
            checkEl.style.opacity = '0';
            checkEl.style.transform = 'scale(0.4)';
          }
        }
      }

      // Avatar marker moving along streak
      const streakAvatar = document.getElementById('streakAvatar');
      if (streakAvatar && progPoints.length > 0) {
        const lastPt = progPoints[progPoints.length - 1];
        streakAvatar.style.opacity = '1';
        streakAvatar.style.transform = `translate3d(${lastPt.x}px, ${lastPt.y}px, 0)`;
      }
    }

    // ---------------- S7: Distractions & Rapid Scrolling ----------------
    const feedTrack = document.getElementById('feedTrack');
    const focusKnob = document.getElementById('focusKnob');
    const tgOn = document.getElementById('tgOn');
    const stTime = document.getElementById('stTime');
    const stBars = document.getElementById('stBars');

    if (t >= 39.9 && t < 47.5) {
      // Rapid endless scroll on the feed track
      if (feedTrack) {
        const scrollSpeed = t < 44.0 ? (t - 40.0) * 1400 : 4.0 * 1400;
        feedTrack.style.transform = `translate3d(0, -${(scrollSpeed % 1600).toFixed(1)}px, 0)`;
      }

      // App icons floating around phone
      for (let i = 0; i < 6; i++) {
        const appIco = document.getElementById(`app-ico-${i}`);
        const appLock = document.getElementById(`app-lock-${i}`);
        if (!appIco) continue;

        if (t < 40.5) {
          appIco.style.opacity = '0';
          appIco.style.transform = 'scale(0.4)';
        } else if (t < 44.2) {
          // Buzzing floating distraction apps
          const enter = easeOutBack(clamp((t - 40.5 - i * 0.1) / 0.5));
          const bob = Math.sin(t * 5 + i * 1.4) * 8;
          appIco.style.opacity = enter.toFixed(2);
          appIco.style.transform = `scale(${enter}) translate3d(0, ${bob.toFixed(1)}px, 0)`;
          if (appLock) appLock.style.opacity = '0';
        } else {
          // Focus mode toggled! Apps dim and lock
          const p = clamp((t - 44.2) / 0.5);
          appIco.style.opacity = lerp(1, 0.25, p).toFixed(2);
          appIco.style.filter = `grayscale(${p * 100}%)`;
          if (appLock) appLock.style.opacity = p.toFixed(2);
        }
      }

      // Screen time clock ticking up
      if (stTime) {
        const mins = Math.min(58, 12 + Math.floor((t - 40.0) * 11));
        stTime.textContent = `1h ${mins}m`;
      }
      if (stBars) {
        const bars = stBars.querySelectorAll('i');
        bars.forEach((b, i) => {
          const h = 20 + ((i * 19 + Math.floor(t * 10)) % 75);
          b.style.height = `${h}%`;
        });
      }

      // Focus toggle button animation
      if (t >= 44.0) {
        if (focusKnob) focusKnob.style.transform = 'translateX(20px)';
        if (tgOn) tgOn.style.opacity = '1';
      } else {
        if (focusKnob) focusKnob.style.transform = 'none';
        if (tgOn) tgOn.style.opacity = '0';
      }
    } else {
      // Hide distraction app icons when outside scene 7
      for (let i = 0; i < 6; i++) {
        const appIco = document.getElementById(`app-ico-${i}`);
        if (appIco) appIco.style.opacity = '0';
      }
    }

    // ---------------- S8: Focus Timer Countdown ----------------
    const foTime = document.getElementById('foTime');
    const foArc = document.getElementById('foArc');
    if (t >= 47.8 && t < 54.5) {
      if (t >= 49.2 && t < 52.0) {
        // Countdown from 25:00 down to 00:00 rapidly to show time passing
        const p = clamp((t - 49.2) / 2.8);
        const totalSecs = Math.max(0, Math.floor(lerp(1500, 0, p)));
        const mm = String(Math.floor(totalSecs / 60)).padStart(2, '0');
        const ss = String(totalSecs % 60).padStart(2, '0');
        if (foTime) foTime.textContent = `${mm}:${ss}`;

        // Ring progress arc: stroke-dasharray = 728.85
        if (foArc) {
          const offset = 728.85 * (1 - p);
          foArc.style.strokeDashoffset = offset.toFixed(1);
        }
      } else if (t >= 52.0) {
        if (foTime) foTime.textContent = '00:00';
        if (foArc) foArc.style.strokeDashoffset = '0';
      } else {
        if (foTime) foTime.textContent = '25:00';
        if (foArc) foArc.style.strokeDashoffset = '728.85';
      }
    }

    // ---------------- S10: Summit reached (Behind climber cinematic) ----------------
    if (t >= 63.5 && t < 69.0) {
      if (summit) {
        summit.style.visibility = 'visible';
        summit.style.opacity = '1';
      }
      if (world) world.style.opacity = '0';

      // Animated waving flag at the summit
      const sFlagPath = document.getElementById('sFlagPath');
      if (sFlagPath) {
        const wave = Math.sin(t * 8) * 8;
        const wave2 = Math.cos(t * 8) * 6;
        sFlagPath.setAttribute('d',
          `M0,-240 Q35,${-250 + wave} 70,-240 Q105,${-230 + wave2} 140,-240 L140,-160 Q105,${-150 + wave2} 70,-160 Q35,${-170 + wave} 0,-160 Z`);
      }

      // Camera breathing motion
      const sCam = document.getElementById('sCam');
      if (sCam) {
        const breathe = Math.sin(t * 1.5) * 6;
        sCam.style.transform = `translate3d(0, ${breathe.toFixed(1)}px, 0)`;
      }
    } else {
      if (summit) {
        summit.style.visibility = 'hidden';
        summit.style.opacity = '0';
      }
      if (world && (t < 69.0 || t >= 76.5)) {
        world.style.opacity = '1';
      }
    }

    // ---------------- S11: Full App Overview Studio ----------------
    if (t >= 69.0 && t < 76.5) {
      if (studio) {
        studio.style.visibility = 'visible';
        studio.style.opacity = '1';
      }
      if (world) world.style.opacity = '0';
    } else if (t < 63.5 || t >= 76.5) {
      if (studio) {
        studio.style.visibility = 'hidden';
        studio.style.opacity = '0';
      }
    }

    // ---------------- Flash & Fade transitions ----------------
    if (fadeBlack) {
      if (t < 0.6) {
        fadeBlack.style.opacity = (1 - t / 0.6).toFixed(2);
      } else if (t >= 85.0) {
        fadeBlack.style.opacity = clamp((t - 85.0) / 1.0).toFixed(2);
      } else {
        fadeBlack.style.opacity = '0';
      }
    }

    if (disclaimerTop) {
      if (t < 0.8) {
        disclaimerTop.style.opacity = clamp((t - 0.2) / 0.6).toFixed(2);
      } else if (t >= 83.5) {
        disclaimerTop.style.opacity = (1 - clamp((t - 83.5) / 1.0)).toFixed(2);
      } else {
        disclaimerTop.style.opacity = '1';
      }
    }

    // White flash when summit is revealed at t = 63.5s
    if (flash) {
      if (t >= 63.5 && t < 64.5) {
        const p = (t - 63.5) / 1.0;
        flash.style.opacity = (1 - p).toFixed(2);
      } else {
        flash.style.opacity = '0';
      }
    }

    // End dark backdrop at t = 83.5s
    if (endDark) {
      if (t >= 83.5) {
        endDark.style.opacity = clamp((t - 83.5) / 1.0).toFixed(2);
      } else {
        endDark.style.opacity = '0';
      }
    }
  }

  // -------------------------------------------------------------
  // 8. MAIN RENDER TICK FUNCTION
  // -------------------------------------------------------------
  function renderFrame(t) {
    // 1. Sky & lighting theme
    const theme = computeSkyTheme(t);
    if (stage) {
      stage.style.setProperty('--sky1', theme.sky1);
      stage.style.setProperty('--sky2', theme.sky2);
      stage.style.setProperty('--sky3', theme.sky3);
      stage.style.setProperty('--sun', theme.sunColor);
      stage.style.setProperty('--haze', theme.haze);
      stage.style.setProperty('--lit', theme.lit);
      stage.style.setProperty('--shade', theme.shade);
      stage.style.setProperty('--trail', theme.trailColor);
    }

    // 2. Parallax Camera
    const cam = computeCamera(t);
    const layers = document.querySelectorAll('#world [data-depth]');
    layers.forEach(layer => {
      const depth = parseFloat(layer.getAttribute('data-depth') || '1');
      const dx = (960 - cam.cx) * depth;
      const dy = (540 - cam.cy) * depth;
      const scale = 1 + (cam.zoom - 1) * depth;
      layer.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) scale(${scale.toFixed(3)})`;
    });

    // 3. Climber Position on Trail
    const progress = computeClimberProgress(t);
    if (trailPathEl && trailTotalLength > 0 && climber) {
      const currentDist = progress * trailTotalLength;
      const pt = trailPathEl.getPointAtLength(currentDist);

      // Tangent angle to flip climber in walking direction
      const ptAhead = trailPathEl.getPointAtLength(Math.min(trailTotalLength, currentDist + 4));
      const dx = ptAhead.x - pt.x;
      const flip = dx < 0 ? -1 : 1;

      climber.setAttribute('transform', `translate(${pt.x.toFixed(1)}, ${pt.y.toFixed(1)})`);
      if (climberFlip) climberFlip.setAttribute('transform', `scale(${flip}, 1)`);

      // Walking bob animation when progressing
      if (climberBob) {
        const isWalking = (t > 17.0 && t < 20.5) || (t > 23.5 && t < 27.5) ||
                          (t > 29.0 && t < 33.5) || (t > 49.5 && t < 53.5) ||
                          (t > 55.0 && t < 63.0);
        const bob = isWalking ? Math.sin(t * 16) * 2.2 : 0;
        climberBob.setAttribute('transform', `translate(0, ${bob.toFixed(1)})`);
      }

      // Lamp glow in dim lighting
      if (climberLamp) {
        climberLamp.style.opacity = (t >= 40.0 && t < 63.0) ? '0.75' : '0';
      }

      // Update trail progress stroke
      if (trailPathEl) {
        const offset = trailTotalLength * (1 - progress);
        trailPathEl.style.strokeDashoffset = offset.toFixed(1);
      }

      // Peak beacon glow
      if (peakGlow) {
        peakGlow.style.opacity = progress > 0.85 ? lerp(0, 0.9, (progress - 0.85) / 0.15) : '0';
      }
    }

    // 4. World-anchored checkpoint labels position
    document.querySelectorAll('.wl').forEach((wl, idx) => {
      const wx = parseFloat(wl.getAttribute('data-x'));
      const wy = parseFloat(wl.getAttribute('data-y'));
      const dx = (960 - cam.cx) * 1.0;
      const dy = (540 - cam.cy) * 1.0;
      const scale = cam.zoom;
      const sx = (wx - 960) * scale + 960 + dx;
      const sy = (wy - 540) * scale + 540 + dy;

      wl.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0)`;

      // Show checkpoint labels in Scene 9 (Mountain Checkpoints)
      if (t >= 54.5 && t < 63.5) {
        const cpTime = 55.0 + idx * 1.3;
        const enter = clamp((t - cpTime) / 0.5);
        wl.style.opacity = enter.toFixed(2);
        wl.style.visibility = enter > 0 ? 'visible' : 'hidden';
      } else {
        wl.style.opacity = '0';
        wl.style.visibility = 'hidden';
      }
    });

    // 5. Phone placement & 3D tilt
    updatePhonePlacement(t);

    // 6. Declarative data-in/data-out text & cards
    updateDataDrivenElements(t);

    // 7. Special scene triggers (particles, streak, scrolling, timers)
    updateSpecialScenes(t);

    // 8. Particle canvas system update & render
    particleSys.update();
    particleSys.render(pCtx);

    prevTime = t;
  }

  // -------------------------------------------------------------
  // 9. PLAYBACK CONTROLS, AUDIO ENGINE & TIMELINE LOOP
  // -------------------------------------------------------------
  let currentTime = 0.0;
  let isPlaying = true;
  let isLooping = true;
  let lastTimestamp = 0;
  let isMuted = false;
  let isVoiceOn = true;
  let audioUnlocked = false;

  const bgm = document.getElementById('bgm');
  const scrubInput = document.getElementById('scrub');
  const tcDisplay = document.getElementById('tc');
  const sceneNameDisplay = document.getElementById('sceneName');
  const btnPlay = document.getElementById('btnPlay');
  const playIcon = document.getElementById('playIcon');
  const btnRestart = document.getElementById('btnRestart');
  const btnAudio = document.getElementById('btnAudio');
  const audioIcon = document.getElementById('audioIcon');
  const btnVoice = document.getElementById('btnVoice');
  const voiceIcon = document.getElementById('voiceIcon');
  const btnLoop = document.getElementById('btnLoop');
  const btnFull = document.getElementById('btnFull');
  const controlsEl = document.getElementById('controls');

  const ICON_AUDIO_ON = 'M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z';
  const ICON_AUDIO_MUTED = 'M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z';
  const ICON_VOICE_ON = 'M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z';
  const ICON_VOICE_OFF = 'M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.24-5.3-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c1.33-.19 2.53-.74 3.53-1.54l2.2 2.2 1.27-1.27L4.27 3z';

  function formatTimecode(secs) {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  function getActiveScene(t) {
    for (let i = 0; i < SCENES.length; i++) {
      if (t >= SCENES[i].start && t < SCENES[i].end) {
        return SCENES[i];
      }
    }
    return SCENES[SCENES.length - 1];
  }

  function syncAudioClock(t) {
    if (bgm && Math.abs(bgm.currentTime - t) > 0.25) {
      try {
        bgm.currentTime = clamp(t, 0, TOTAL_DURATION);
      } catch (err) {}
    }
  }

  function toggleAudio() {
    isMuted = !isMuted;
    if (bgm) bgm.muted = isMuted;
    if (btnAudio) {
      btnAudio.classList.toggle('on', !isMuted);
      btnAudio.setAttribute('title', isMuted ? 'Sound: Muted (Click or press M to unmute)' : 'Sound: Playing (Click or press M to mute)');
    }
    if (audioIcon) {
      audioIcon.setAttribute('d', isMuted ? ICON_AUDIO_MUTED : ICON_AUDIO_ON);
    }
    if (!isMuted && isPlaying && bgm && bgm.paused) {
      bgm.play().catch(() => {});
    }
  }

  function toggleVoice() {
    isVoiceOn = !isVoiceOn;
    if (btnVoice) {
      btnVoice.classList.toggle('on', isVoiceOn);
      btnVoice.setAttribute('title', isVoiceOn ? 'Voiceover: On (Samantha) [Press V]' : 'Voiceover: Off (Music Only) [Press V]');
    }
    if (voiceIcon) {
      voiceIcon.setAttribute('d', isVoiceOn ? ICON_VOICE_ON : ICON_VOICE_OFF);
    }
    if (bgm) {
      const cur = bgm.currentTime;
      const wasPlaying = !bgm.paused;
      bgm.src = isVoiceOn ? 'soundtrack.wav' : 'soundtrack_music.wav';
      bgm.currentTime = cur;
      if (wasPlaying && isPlaying) {
        bgm.play().catch(() => {});
      }
    }
  }

  function setTime(t, syncScrub = true) {
    currentTime = clamp(t, 0, TOTAL_DURATION);
    renderFrame(currentTime);
    syncAudioClock(currentTime);

    if (syncScrub && scrubInput) {
      scrubInput.value = currentTime;
    }

    // Timecode and Scene title update
    if (tcDisplay) {
      tcDisplay.textContent = `${formatTimecode(currentTime)} / ${formatTimecode(TOTAL_DURATION)}`;
    }
    if (sceneNameDisplay) {
      const sc = getActiveScene(currentTime);
      sceneNameDisplay.textContent = `${sc.id}. ${sc.name}`;
    }
  }

  function play() {
    isPlaying = true;
    lastTimestamp = performance.now();
    if (playIcon) playIcon.setAttribute('d', 'M7 5h4v14H7zM13 5h4v14h-4z'); // Pause icon
    if (bgm) {
      syncAudioClock(currentTime);
      bgm.play().catch(() => {
        // Autoplay may be deferred until user interaction
      });
    }
    requestAnimationFrame(loop);
  }

  function pause() {
    isPlaying = false;
    if (playIcon) playIcon.setAttribute('d', 'M8 5.5v13l10-6.5z'); // Play triangle icon
    if (bgm) {
      bgm.pause();
    }
  }

  function togglePlay() {
    if (isPlaying) pause();
    else play();
  }

  function loop(timestamp) {
    if (!isPlaying) return;

    if (!lastTimestamp) lastTimestamp = timestamp;
    const delta = (timestamp - lastTimestamp) / 1000;
    lastTimestamp = timestamp;

    // Synchronize to hardware audio clock when audio is active for rock-solid sync
    if (bgm && !bgm.paused && !bgm.seeking) {
      currentTime = bgm.currentTime;
    } else {
      currentTime += Math.min(delta, 0.1);
    }

    if (currentTime >= TOTAL_DURATION) {
      if (isLooping) {
        currentTime = 0;
        if (bgm) {
          bgm.currentTime = 0;
          if (isPlaying) bgm.play().catch(() => {});
        }
        particleSys.clear();
      } else {
        currentTime = TOTAL_DURATION;
        pause();
      }
    }

    setTime(currentTime, true);
    requestAnimationFrame(loop);
  }

  // -------------------------------------------------------------
  // 10. RESPONSIVE STAGE RESIZING
  // -------------------------------------------------------------
  function resizeStage() {
    if (!stage) return;
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    const scale = Math.min(winW / 1920, winH / 1080);
    stage.style.setProperty('--s', scale);
  }

  // -------------------------------------------------------------
  // 11. EVENT LISTENERS & INITIALIZATION
  // -------------------------------------------------------------
  function bindEvents() {
    window.addEventListener('resize', resizeStage);

    if (scrubInput) {
      scrubInput.addEventListener('input', e => {
        pause();
        setTime(parseFloat(e.target.value), false);
      });
      scrubInput.addEventListener('change', () => {
        play();
      });
    }

    if (btnPlay) btnPlay.addEventListener('click', togglePlay);
    if (btnAudio) btnAudio.addEventListener('click', toggleAudio);
    if (btnVoice) btnVoice.addEventListener('click', toggleVoice);
    if (btnRestart) {
      btnRestart.addEventListener('click', () => {
        particleSys.clear();
        setTime(0);
        play();
      });
    }
    if (btnLoop) {
      btnLoop.addEventListener('click', () => {
        isLooping = !isLooping;
        btnLoop.classList.toggle('on', isLooping);
      });
    }
    if (btnFull) {
      btnFull.addEventListener('click', () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      });
    }

    const btnDownload = document.getElementById('btnDownload');
    const downloadModal = document.getElementById('downloadModal');
    const modalClose = document.getElementById('modalClose');

    if (btnDownload && downloadModal) {
      btnDownload.addEventListener('click', () => {
        downloadModal.classList.add('open');
      });
    }
    if (modalClose && downloadModal) {
      modalClose.addEventListener('click', () => {
        downloadModal.classList.remove('open');
      });
    }
    if (downloadModal) {
      downloadModal.addEventListener('click', e => {
        if (e.target === downloadModal) downloadModal.classList.remove('open');
      });
    }

    // Keyboard shortcuts
    window.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'Escape' && downloadModal) {
        downloadModal.classList.remove('open');
      } else if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'd' || e.key === 'D') {
        if (downloadModal) downloadModal.classList.toggle('open');
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggleAudio();
      } else if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        toggleVoice();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        setTime(currentTime + 2);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        setTime(currentTime - 2);
      } else if (e.code === 'Home') {
        e.preventDefault();
        setTime(0);
      } else if (e.key >= '1' && e.key <= '9') {
        const scIdx = parseInt(e.key, 10) - 1;
        if (SCENES[scIdx]) setTime(SCENES[scIdx].start);
      } else if (e.key === '0') {
        if (SCENES[9]) setTime(SCENES[9].start); // Scene 10
      }
    });

    // Auto-unlock audio on user gesture (bypasses browser autoplay restrictions)
    const unlockAudio = () => {
      if (audioUnlocked) return;
      audioUnlocked = true;
      if (bgm && isPlaying && !isMuted && bgm.paused) {
        bgm.play().catch(() => {});
      }
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });

    // Auto-hide controls bar when inactive for 3.5s
    let idleTimer = null;
    window.addEventListener('mousemove', () => {
      if (controlsEl) controlsEl.classList.remove('idle');
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (isPlaying && controlsEl) controlsEl.classList.add('idle');
      }, 3500);
    });
  }

  // DOM ready entrypoint
  window.addEventListener('DOMContentLoaded', () => {
    initProceduralSVG();
    initDataDrivenElements();
    resizeStage();
    bindEvents();

    // Check if running in headless video export mode (?export=1)
    const urlParams = new URLSearchParams(window.location.search);
    const isExport = urlParams.get('export') === '1';

    if (isExport) {
      if (controlsEl) controlsEl.style.display = 'none';
      if (stage) stage.style.setProperty('--s', '1');
      setTime(0);
      pause();
    } else {
      setTime(0);
      play();
    }

    // Expose engine controls for video renderer & testing
    window.setTime = setTime;
    window.renderFrame = renderFrame;
    window.play = play;
    window.pause = pause;
    window.TOTAL_DURATION = TOTAL_DURATION;
  });

})();
