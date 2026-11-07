// Wraps the Kliimora logo (public/favicon.svg, 48x46) into a square 1024x1024
// SVG canvas, centered and scaled, so `tauri icon` produces clean app icons
// instead of a letterboxed render.
import { readFileSync, writeFileSync } from 'node:fs';

const svg = readFileSync('public/favicon.svg', 'utf8');
const inner = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
const SCALE = 15; // 48*15 = 720px logo on a 1024 canvas (~15% padding)
const wrapped =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">' +
  `<g transform="translate(512 512) scale(${SCALE}) translate(-24 -23)">${inner}</g>` +
  '</svg>';
writeFileSync('public/app-icon-1024.svg', wrapped);
console.log('wrote public/app-icon-1024.svg (' + wrapped.length + ' bytes)');
