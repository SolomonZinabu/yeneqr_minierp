// ============================================================
// YeneQR Pitch Deck — Standard PowerPoint compatible
// Uses Calibri/Times New Roman, large readable fonts
// 10 x 7.5 inches (standard 4:3 — works everywhere)
// ============================================================

const PptxGenJS = require('pptxgenjs');
const path = require('path');
const fs = require('fs');

const pptx = new PptxGenJS();
// Standard 4:3 — 10 x 7.5 inches (most compatible with all PowerPoint versions)
pptx.defineLayout({ name: 'STD_4x3', width: 10, height: 7.5 });
pptx.layout = 'STD_4x3';

const W = 10, H = 7.5, M = 0.5;

const C = {
  bg: 'FAFBFC', white: 'FFFFFF',
  brand: '389654', brandLight: '6EE7B7', brandDark: '065F46', brandBg: 'ECFDF5',
  orange: 'F3631F', orangeLight: 'FB923C', orangeDark: 'C2410C', orangeBg: 'FFF7ED',
  blue: '3B82F6', blueBg: 'DBEAFE',
  purple: '8B5CF6', purpleBg: 'EDE9FE',
  rose: 'F43F5E', roseBg: 'FFE4E6',
  cyan: '06B6D4',
  text: '111827', textMuted: '4B5563', textDim: '9CA3AF',
  border: 'E5E7EB', borderLight: 'D1D5DB',
};

// Use Calibri — standard on all PowerPoint installations since 2007
const FONT = 'Calibri';
const FM = 'Consolas';

function setBg(s) { s.background = { color: C.bg }; }
function card(s, x, y, w, h, fill, line) {
  s.addShape('roundRect', { x, y, w, h, fill: { color: fill || C.white }, line: { color: line || C.border, width: 1 }, rectRadius: 0.08 });
}

const IMG = path.join(__dirname, '..', 'docs', 'screenshot');
function img(n) { const p = path.join(IMG, n); return fs.existsSync(p) ? p : null; }

// ═══ SLIDE 1: COVER ═══
{
  const s = pptx.addSlide();
  s.background = { color: C.white };
  s.addShape('ellipse', { x: -1, y: -1, w: 3, h: 3, fill: { color: C.brand, transparency: 90 } });
  s.addShape('ellipse', { x: 8, y: 5, w: 3, h: 3, fill: { color: C.orange, transparency: 90 } });

  const repuxLogo = img('repux-logo.png');
  if (repuxLogo) { s.addImage({ path: repuxLogo, x: 0.5, y: 0.4, w: 2.0, h: 0.6, sizing: { type: 'contain', w: 2.0, h: 0.6 } }); }

  // YeneQR — large, centered
  s.addText([
    { text: 'Yene', options: { color: C.brand, bold: true } },
    { text: 'QR', options: { color: C.orange, bold: true } },
  ], { x: 0, y: 1.5, w: W, h: 1.2, fontFace: FONT, fontSize: 54, align: 'center' });

  s.addText('The All-in-One Restaurant Management Platform', {
    x: 0.5, y: 2.7, w: 9, h: 0.5, fontFace: FONT, fontSize: 22, color: C.brand, align: 'center',
  });

  s.addText('A comprehensive platform to digitize and streamline daily restaurant operations — menus, orders, reservations, kitchen workflow, staff, CRM, analytics, and multi-branch management from one centralized system.', {
    x: 1.5, y: 3.4, w: 7, h: 0.9, fontFace: FONT, fontSize: 14, color: C.brand, align: 'center', lineSpacingMultiple: 1.4,
  });

  s.addText('Vision: Empower restaurants with technology that improves efficiency, customer experience, and business growth.', {
    x: 1.5, y: 4.4, w: 7, h: 0.5, fontFace: FONT, fontSize: 14, italic: true, color: C.brand, align: 'center',
  });

  s.addShape('line', { x: 4, y: 5.1, w: 2, h: 0, line: { color: C.brand, width: 1 } });

  s.addText("Ethiopia's leading restaurant technology platform", {
    x: M, y: 5.5, w: 5, h: 0.3, fontFace: FONT, fontSize: 12, color: C.brand,
  });

  const yeneqrLogo = img('yeneqr-logo.png');
  if (yeneqrLogo) { s.addImage({ path: yeneqrLogo, x: 7.2, y: 5.3, w: 2.5, h: 1.0, sizing: { type: 'contain', w: 2.5, h: 1.0 } }); }
}

// ═══ SLIDE 2: CHALLENGES ═══
{
  const s = pptx.addSlide(); setBg(s);

  // Badge
  s.addText('THE CHALLENGE', { x: M, y: 0.4, w: 2, h: 0.35, fontFace: FONT, fontSize: 11, bold: true, color: C.rose, fill: { color: C.roseBg }, line: { color: C.rose, width: 1 }, shape: 'roundRect', rectRadius: 0.08, align: 'center', valign: 'middle' });

  s.addText('Common Challenges in Restaurant Operations', { x: M, y: 0.9, w: 9, h: 0.5, fontFace: FONT, fontSize: 24, bold: true, color: C.text });
  s.addText('While global restaurants digitize, most Ethiopian restaurants still rely on manual processes.', { x: M, y: 1.4, w: 9, h: 0.3, fontFace: FONT, fontSize: 13, color: C.textMuted });

  const challenges = [
    ['Printed Menus', 'Costly to print, hard to update', C.roseBg, C.rose],
    ['Manual Orders', 'Slow, errors, illegible to kitchen', C.orangeBg, C.orangeDark],
    ['Kitchen Chaos', 'No ticket system, missed orders', C.roseBg, C.rose],
    ['Manual Reservations', 'No-shows, double-bookings', C.orangeBg, C.orangeDark],
    ['No Analytics', 'No data on bestsellers or revenue', C.purpleBg, C.purple],
    ['No CRM', 'Cannot track customers or loyalty', C.purpleBg, C.purple],
    ['Multi-Branch Chaos', 'Cannot manage locations centrally', C.roseBg, C.rose],
    ['Limited Payments', 'No Telebirr, Chapa, CBE Birr', C.orangeBg, C.orangeDark],
  ];
  const cw = 2.1, rh = 1.3, g = 0.15, sx = M, sy = 1.9;
  challenges.forEach((item, i) => {
    const col = i % 4, row = Math.floor(i / 4);
    const x = sx + col * (cw + g), y = sy + row * (rh + 0.2);
    card(s, x, y, cw, rh, C.white, C.border);
    s.addShape('roundRect', { x, y, w: cw, h: 0.1, fill: { color: item[3] }, rectRadius: 0.05 });
    s.addText(item[0], { x: x + 0.15, y: y + 0.2, w: cw - 0.3, h: 0.35, fontFace: FONT, fontSize: 13, bold: true, color: C.text });
    s.addText(item[1], { x: x + 0.15, y: y + 0.6, w: cw - 0.3, h: 0.55, fontFace: FONT, fontSize: 11, color: C.textMuted, lineSpacingMultiple: 1.3 });
  });

  s.addText('YeneQR solves all of this', { x: 7, y: 6.9, w: 2.8, h: 0.35, fontFace: FONT, fontSize: 13, bold: true, color: C.brand, align: 'right' });
}

// ═══ SLIDE 3: GUEST EXPERIENCE ═══
{
  const s = pptx.addSlide(); setBg(s);

  s.addText('GUEST EXPERIENCE', { x: M, y: 0.3, w: 2.5, h: 0.35, fontFace: FONT, fontSize: 11, bold: true, color: C.brandDark, fill: { color: C.brandBg }, line: { color: C.brandLight, width: 1 }, shape: 'roundRect', rectRadius: 0.08, align: 'center', valign: 'middle' });

  s.addText('End-to-End Guest Journey — From Scan to Pay', { x: M, y: 0.8, w: 9, h: 0.45, fontFace: FONT, fontSize: 22, bold: true, color: C.text });
  s.addText('Scan QR → browse menu → customize order → track status → pay → play games.', { x: M, y: 1.25, w: 9, h: 0.3, fontFace: FONT, fontSize: 13, color: C.textMuted });

  const shots = [
    { file: 'photo_1_2026-07-05_10-57-14.jpg', label: '1. Scan QR &\nChoose Dine In', color: C.blue },
    { file: 'photo_6_2026-07-05_10-57-14.jpg', label: '2. Browse Menu\n& Categories', color: C.brand },
    { file: 'photo_8_2026-07-05_10-57-14.jpg', label: '3. Customize &\nAdd to Order', color: C.cyan },
    { file: 'photo_11_2026-07-05_10-57-14.jpg', label: '4. Track Order\nStatus Live', color: C.orange },
    { file: 'photo_12_2026-07-05_10-57-14.jpg', label: '5. Pay: Cash,\nTelebirr, Chapa', color: C.purple },
    { file: 'photo_14_2026-07-05_10-57-14.jpg', label: '6. Play Games\nWhile Waiting', color: C.rose },
  ];
  const iw = 1.4, ih = 2.5, g = 0.18;
  const tw = shots.length * iw + (shots.length - 1) * g;
  const sx = (W - tw) / 2, sy = 1.8;
  shots.forEach((sh, i) => {
    const x = sx + i * (iw + g), ip = img(sh.file);
    s.addShape('roundRect', { x, y: sy, w: iw, h: ih, fill: { color: C.white }, line: { color: sh.color, width: 2 }, rectRadius: 0.08 });
    if (ip) { s.addImage({ path: ip, x: x + 0.03, y: sy + 0.03, w: iw - 0.06, h: ih - 0.06, sizing: { type: 'contain', w: iw - 0.06, h: ih - 0.06 } }); }
    s.addShape('ellipse', { x: x + iw / 2 - 0.18, y: sy - 0.18, w: 0.36, h: 0.36, fill: { color: sh.color } });
    s.addText(String(i + 1), { x: x + iw / 2 - 0.18, y: sy - 0.18, w: 0.36, h: 0.36, fontFace: FM, fontSize: 12, bold: true, color: C.white, align: 'center', valign: 'middle' });
    s.addText(sh.label, { x: x - 0.1, y: sy + ih + 0.12, w: iw + 0.2, h: 0.5, fontFace: FONT, fontSize: 11, bold: true, color: C.text, align: 'center', valign: 'top', lineSpacingMultiple: 1.2 });
    if (i < shots.length - 1) { s.addText('→', { x: x + iw - 0.02, y: sy + ih / 2 - 0.15, w: g + 0.04, h: 0.3, fontFace: FONT, fontSize: 16, color: C.brand, align: 'center', valign: 'middle' }); }
  });

  s.addText('Multilingual · Telebirr · Chapa · CBE Birr · StarPay · Cash', { x: M, y: 6.9, w: 9, h: 0.3, fontFace: FONT, fontSize: 11, color: C.textDim, align: 'center' });
}

// ═══ SLIDE 4: ADMIN OPERATIONS ═══
{
  const s = pptx.addSlide(); setBg(s);

  s.addText('OPERATIONS', { x: M, y: 0.3, w: 1.8, h: 0.35, fontFace: FONT, fontSize: 11, bold: true, color: C.blue, fill: { color: C.blueBg }, line: { color: C.blue, width: 1 }, shape: 'roundRect', rectRadius: 0.08, align: 'center', valign: 'middle' });

  s.addText('Complete Operational Control From One Dashboard', { x: M, y: 0.8, w: 9, h: 0.45, fontFace: FONT, fontSize: 22, bold: true, color: C.text });
  s.addText('QR Menus, Online Ordering, Kitchen Mgmt, Waiter Mgmt, Tables, Staff, Multi-Branch, CRM, Analytics, Waitlist.', { x: M, y: 1.25, w: 9, h: 0.3, fontFace: FONT, fontSize: 12, color: C.textMuted });

  const features = [['Live Orders Dashboard', C.brand], ['Menu & Category Mgmt', C.brand], ['Kitchen Display System', C.orange], ['Staff & Role Management', C.orange], ['Table & Floor Plan', C.blue], ['Analytics & Reports', C.blue], ['Multi-Branch Management', C.purple], ['CRM, Promotions & Loyalty', C.purple]];
  features.forEach((item, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = M + col * 2.3, y = 1.8 + row * 0.5;
    s.addText('✓', { x, y, w: 0.3, h: 0.4, fontFace: FONT, fontSize: 16, bold: true, color: item[1], valign: 'middle' });
    s.addText(item[0], { x: x + 0.3, y, w: 2.0, h: 0.4, fontFace: FONT, fontSize: 13, bold: true, color: C.text, valign: 'middle' });
  });

  const a1 = img('photo_2026-07-05_11-08-54.jpg');
  if (a1) {
    card(s, 5.3, 1.8, 4.5, 2.6, C.white, C.brand);
    s.addImage({ path: a1, x: 5.36, y: 1.86, w: 4.38, h: 2.48, sizing: { type: 'contain', w: 4.38, h: 2.48 } });
    s.addText('Admin Dashboard — Real-time orders, revenue, table status', { x: 5.3, y: 4.45, w: 4.5, h: 0.25, fontFace: FONT, fontSize: 10, color: C.textMuted, align: 'center' });
  }
  const a2 = img('photo_11_2026-07-05_10-57-14.jpg');
  if (a2) {
    card(s, 5.3, 4.8, 2.2, 2.0, C.white, C.orange);
    s.addImage({ path: a2, x: 5.36, y: 4.86, w: 2.08, h: 1.88, sizing: { type: 'contain', w: 2.08, h: 1.88 } });
    s.addText('Kitchen Tracking', { x: 5.3, y: 6.85, w: 2.2, h: 0.25, fontFace: FONT, fontSize: 10, color: C.textMuted, align: 'center' });
  }
  card(s, 7.8, 4.8, 2.0, 2.0, C.brandBg, C.brandLight);
  s.addText('One platform replaces 5+ tools', { x: 7.9, y: 4.9, w: 1.8, h: 0.4, fontFace: FONT, fontSize: 13, bold: true, color: C.brandDark });
  s.addText('No more switching between POS, spreadsheets, and paper tickets. Real-time from one login.', { x: 7.9, y: 5.3, w: 1.8, h: 1.3, fontFace: FONT, fontSize: 11, color: C.textMuted, lineSpacingMultiple: 1.3 });
}

// ═══ SLIDE 5: COMPETITIVE LANDSCAPE ═══
{
  const s = pptx.addSlide(); setBg(s);

  s.addText('COMPETITIVE LANDSCAPE', { x: M, y: 0.3, w: 2.5, h: 0.35, fontFace: FONT, fontSize: 11, bold: true, color: C.purple, fill: { color: C.purpleBg }, line: { color: C.purple, width: 1 }, shape: 'roundRect', rectRadius: 0.08, align: 'center', valign: 'middle' });

  s.addText('How YeneQR Compares to Global Leaders', { x: M, y: 0.8, w: 9, h: 0.45, fontFace: FONT, fontSize: 22, bold: true, color: C.text });
  s.addText('Same operational power as Toast and Lightspeed — with a revenue model built for emerging markets.', { x: M, y: 1.25, w: 9, h: 0.3, fontFace: FONT, fontSize: 12, color: C.textMuted });

  const headers = ['Feature', 'Toast', 'Shopify', 'Square', 'Lightspeed', 'YeneQR'];
  const cw = [2.0, 1.3, 1.4, 1.3, 1.6, 1.9];
  const tx = M, ty = 1.8, rh = 0.35;
  let cx = tx;
  headers.forEach((h, i) => {
    s.addText(h, { x: cx, y: ty, w: cw[i], h: rh, fontFace: FONT, fontSize: 10, bold: true, color: i === 5 ? C.brandDark : C.textMuted, fill: { color: i === 5 ? C.brandBg : C.card }, align: 'left', valign: 'middle', line: { color: C.border, width: 0.5 } });
    cx += cw[i];
  });

  const rows = [
    ['POS & Order Mgmt', '✓', '—', '✓', '✓', '✓'],
    ['Kitchen Display', '✓', '—', '—', '✓', '✓'],
    ['QR Menu Ordering', '—', '—', '—', '—', '✓'],
    ['Multi-Branch', '✓', '✓', '—', '✓', '✓'],
    ['CRM & Loyalty', '✓', '✓', '—', '✓', '✓'],
    ['Reservations', '✓', '—', '—', '✓', '✓'],
    ['Games & Entertainment', '—', '—', '—', '—', '✓'],
    ['Telebirr/Chapa/CBE', '—', '—', '—', '—', '✓'],
    ['Amharic/Multilingual', '—', 'Partial', '—', 'Partial', '✓'],
    ['Revenue Model', 'Sub+Tx', 'Sub+Tx', 'Free+Tx', 'Sub+Tx', 'Decoupled'],
  ];
  rows.forEach((row, ri) => {
    let cx = tx; const isLast = ri === rows.length - 1;
    row.forEach((cell, ci) => {
      const isY = ci === 5;
      s.addText(cell, { x: cx, y: ty + (ri + 1) * rh, w: cw[ci], h: rh, fontFace: FONT, fontSize: isLast ? 11 : 10, bold: isLast || isY, color: isY ? C.brand : (cell === '✓' ? C.brand : (cell === '—' ? C.textDim : C.text)), fill: { color: isY ? C.brandBg : (ri % 2 === 0 ? C.white : 'F9FAFB') }, align: 'left', valign: 'middle', line: { color: C.border, width: 0.5 } });
      cx += cw[ci];
    });
  });

  const iy = ty + (rows.length + 1) * rh + 0.15;
  card(s, M, iy, 9, 0.7, C.brandBg, C.brandLight);
  s.addText('Key difference: Global platforms couple subscription to transaction fees. YeneQR decouples them — fee rate is negotiated per-restaurant, independent of the subscription plan.', { x: M + 0.15, y: iy + 0.08, w: 8.7, h: 0.55, fontFace: FONT, fontSize: 12, color: C.text, lineSpacingMultiple: 1.3 });
}

// ═══ SLIDE 6: BUSINESS MODEL ═══
{
  const s = pptx.addSlide(); setBg(s);

  s.addText('BUSINESS MODEL', { x: M, y: 0.3, w: 2, h: 0.35, fontFace: FONT, fontSize: 11, bold: true, color: C.brandDark, fill: { color: C.brandBg }, line: { color: C.brandLight, width: 1 }, shape: 'roundRect', rectRadius: 0.08, align: 'center', valign: 'middle' });

  s.addText('A Revenue Model Built for Emerging Markets', { x: M, y: 0.8, w: 9, h: 0.45, fontFace: FONT, fontSize: 22, bold: true, color: C.text });

  // Card 1: Fee
  card(s, M, 1.5, 4.3, 2.3, C.white, C.brand);
  s.addShape('roundRect', { x: M, y: 1.5, w: 4.3, h: 0.1, fill: { color: C.brand }, rectRadius: 0.05 });
  s.addText('PER-TRANSACTION FEE', { x: M + 0.2, y: 1.65, w: 3, h: 0.3, fontFace: FONT, fontSize: 12, bold: true, color: C.brand });
  s.addText('0.5% — 3%', { x: M + 0.2, y: 1.95, w: 3, h: 0.5, fontFace: FM, fontSize: 28, bold: true, color: C.brand });
  s.addText('Charged on every captured payment. Rate set per-restaurant — negotiable. Excludes tips and tax.', { x: M + 0.2, y: 2.5, w: 3.9, h: 0.7, fontFace: FONT, fontSize: 12, color: C.textMuted, lineSpacingMultiple: 1.3 });
  s.addText('Default: 3%', { x: M + 0.2, y: 3.3, w: 1.1, h: 0.28, fontFace: FONT, fontSize: 10, bold: true, color: C.white, fill: { color: C.brand }, align: 'center', valign: 'middle', shape: 'roundRect', rectRadius: 0.05 });
  s.addText('Enterprise: 1%', { x: M + 1.4, y: 3.3, w: 1.2, h: 0.28, fontFace: FONT, fontSize: 10, bold: true, color: C.white, fill: { color: C.blue }, align: 'center', valign: 'middle', shape: 'roundRect', rectRadius: 0.05 });
  s.addText('Charity: 0%', { x: M + 2.7, y: 3.3, w: 1.1, h: 0.28, fontFace: FONT, fontSize: 10, bold: true, color: C.white, fill: { color: C.purple }, align: 'center', valign: 'middle', shape: 'roundRect', rectRadius: 0.05 });

  // Card 2: Subscription
  card(s, M, 4.1, 4.3, 2.3, C.white, C.orange);
  s.addShape('roundRect', { x: M, y: 4.1, w: 4.3, h: 0.1, fill: { color: C.orange }, rectRadius: 0.05 });
  s.addText('VOLUNTARY SUBSCRIPTION', { x: M + 0.2, y: 4.25, w: 3.5, h: 0.3, fontFace: FONT, fontSize: 12, bold: true, color: C.orangeDark });
  s.addText('0 — 5,000 ETB/mo', { x: M + 0.2, y: 4.55, w: 3.5, h: 0.5, fontFace: FM, fontSize: 28, bold: true, color: C.orangeDark });
  s.addText('Optional monthly subscription for advanced features. No hard limits — all get full access.', { x: M + 0.2, y: 5.1, w: 3.9, h: 0.7, fontFace: FONT, fontSize: 12, color: C.textMuted, lineSpacingMultiple: 1.3 });
  s.addText('Basic: Free', { x: M + 0.2, y: 5.9, w: 1.0, h: 0.28, fontFace: FONT, fontSize: 10, bold: true, color: C.white, fill: { color: C.brand }, align: 'center', valign: 'middle', shape: 'roundRect', rectRadius: 0.05 });
  s.addText('Pro: 2K', { x: M + 1.3, y: 5.9, w: 0.8, h: 0.28, fontFace: FONT, fontSize: 10, bold: true, color: C.white, fill: { color: C.blue }, align: 'center', valign: 'middle', shape: 'roundRect', rectRadius: 0.05 });
  s.addText('Premium: 5K', { x: M + 2.2, y: 5.9, w: 1.0, h: 0.28, fontFace: FONT, fontSize: 10, bold: true, color: C.white, fill: { color: C.orange }, align: 'center', valign: 'middle', shape: 'roundRect', rectRadius: 0.05 });
  s.addText('Custom', { x: M + 3.3, y: 5.9, w: 0.8, h: 0.28, fontFace: FONT, fontSize: 10, bold: true, color: C.white, fill: { color: C.purple }, align: 'center', valign: 'middle', shape: 'roundRect', rectRadius: 0.05 });

  // Vision panel
  card(s, 5.2, 1.5, 4.5, 4.9, C.brandBg, C.brandLight);
  s.addText('MISSION', { x: 5.4, y: 1.65, w: 4, h: 0.3, fontFace: FONT, fontSize: 13, bold: true, color: C.brandDark });
  s.addText("Become Ethiopia's leading restaurant technology platform by delivering modern digital solutions for the hospitality industry.", { x: 5.4, y: 1.95, w: 4.2, h: 0.8, fontFace: FONT, fontSize: 13, color: C.text, lineSpacingMultiple: 1.3 });
  s.addShape('line', { x: 5.4, y: 2.8, w: 4.2, h: 0, line: { color: C.brandLight, width: 1 } });
  s.addText('WHY DECOUPLED?', { x: 5.4, y: 2.9, w: 4, h: 0.3, fontFace: FONT, fontSize: 13, bold: true, color: C.brandDark });
  s.addText('Fee rate and subscription are independent. Set any fee rate for any restaurant without changing their plan. Lower barrier. Higher conversion.', { x: 5.4, y: 3.2, w: 4.2, h: 0.9, fontFace: FONT, fontSize: 13, color: C.text, lineSpacingMultiple: 1.3 });
  s.addShape('line', { x: 5.4, y: 4.15, w: 4.2, h: 0, line: { color: C.brandLight, width: 1 } });
  s.addText('BENEFITS', { x: 5.4, y: 4.25, w: 4, h: 0.3, fontFace: FONT, fontSize: 13, bold: true, color: C.brandDark });
  s.addText('Reduce printing · Speed up service · Minimize errors · Better CX · Real-time insights · Multi-branch', { x: 5.4, y: 4.55, w: 4.2, h: 0.9, fontFace: FONT, fontSize: 13, color: C.text, lineSpacingMultiple: 1.3 });
  s.addText('No hard limits. No feature gating. Pure value.', { x: 5.4, y: 5.55, w: 4.2, h: 0.35, fontFace: FONT, fontSize: 14, bold: true, color: C.brand });
}

// ═══ SLIDE 7: CLOSING ═══
{
  const s = pptx.addSlide();
  s.background = { color: C.white };
  s.addShape('ellipse', { x: -1, y: 5, w: 3, h: 3, fill: { color: C.brand, transparency: 90 } });
  s.addShape('ellipse', { x: 8, y: -1, w: 3, h: 3, fill: { color: C.orange, transparency: 90 } });

  const repuxLogo = img('repux-logo.png');
  if (repuxLogo) { s.addImage({ path: repuxLogo, x: 0.5, y: 0.4, w: 2.0, h: 0.6, sizing: { type: 'contain', w: 2.0, h: 0.6 } }); }

  s.addText('OUR VISION', { x: 4.0, y: 1.2, w: 2, h: 0.35, fontFace: FONT, fontSize: 11, bold: true, color: C.brandDark, fill: { color: C.brandBg }, line: { color: C.brandLight, width: 1 }, shape: 'roundRect', rectRadius: 0.08, align: 'center', valign: 'middle' });

  s.addText("Become Ethiopia's Leading\nRestaurant Technology Platform", { x: 0.5, y: 1.8, w: 9, h: 1.0, fontFace: FONT, fontSize: 30, bold: true, color: C.text, align: 'center', lineSpacingMultiple: 1.15 });
  s.addText('Delivering modern digital solutions for the hospitality industry — from QR menus to full operational intelligence.', { x: 1.5, y: 2.9, w: 7, h: 0.5, fontFace: FONT, fontSize: 14, color: C.brand, align: 'center', lineSpacingMultiple: 1.3 });
  s.addShape('line', { x: 4.5, y: 3.5, w: 1, h: 0, line: { color: C.brand, width: 2 } });

  const highlights = [['All-in-One Platform', 'Menu, orders, kitchen, CRM, analytics', C.brand], ['Local Payment Integration', 'Telebirr, Chapa, CBE Birr, StarPay, cash', C.orange], ['Unique Guest Engagement', 'Games, loyalty, multilingual, waiter call', C.purple]];
  highlights.forEach((h, i) => {
    const x = 0.8 + i * 3.1;
    card(s, x, 3.8, 2.7, 1.2, C.white, h[2]);
    s.addShape('roundRect', { x, y: 3.8, w: 2.7, h: 0.08, fill: { color: h[2] }, rectRadius: 0.04 });
    s.addText(h[0], { x, y: 3.95, w: 2.7, h: 0.3, fontFace: FONT, fontSize: 13, bold: true, color: C.text, align: 'center' });
    s.addText(h[1], { x: x + 0.15, y: 4.3, w: 2.4, h: 0.55, fontFace: FONT, fontSize: 11, color: C.textMuted, align: 'center', lineSpacingMultiple: 1.3 });
  });

  card(s, 0.8, 5.3, 8.4, 0.6, C.white, C.brandLight);
  s.addText('Repux Technologies PLC', { x: 1.0, y: 5.33, w: 4.5, h: 0.53, fontFace: FONT, fontSize: 14, bold: true, color: C.text, valign: 'middle' });
  s.addText('repuxt@gmail.com', { x: 5.0, y: 5.33, w: 3.5, h: 0.53, fontFace: FONT, fontSize: 14, color: C.brand, align: 'right', valign: 'middle' });

  if (repuxLogo) { s.addImage({ path: repuxLogo, x: 0.5, y: 6.2, w: 1.8, h: 0.5, sizing: { type: 'contain', w: 1.8, h: 0.5 } }); }
  const yeneqrLogo = img('yeneqr-logo.png');
  if (yeneqrLogo) { s.addImage({ path: yeneqrLogo, x: 7.2, y: 6.1, w: 2.5, h: 0.8, sizing: { type: 'contain', w: 2.5, h: 0.8 } }); }
}

const out = path.join(__dirname, '..', 'download', 'YeneQR_Pitch_Deck.pptx');
pptx.writeFile({ fileName: out }).then(() => console.log('✅ Saved:', out)).catch(e => console.error('❌', e));
