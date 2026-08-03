const fs = require('fs');
const path = require('path');

const files = [
  'app/dashboard/analytics/page.tsx',
  'app/dashboard/billing/[orderId]/page.tsx',
  'app/dashboard/menu/page.tsx',
  'app/dashboard/orders/page.tsx',
  'app/order/cart/page.tsx',
  'app/order/my-orders/page.tsx'
];

files.forEach(f => {
  const fp = path.join(__dirname, f);
  if (!fs.existsSync(fp)) return;
  let content = fs.readFileSync(fp, 'utf8');

  // 1. Prices to var(--accent-amber)
  // Replaces text-indigo-400, text-white, text-gray-400 when followed by ₹
  content = content.replace(/text-indigo-400(.*?>₹)/g, 'text-accent-amber$1');
  content = content.replace(/text-white(.*?>₹)/g, 'text-accent-amber$1');
  content = content.replace(/text-gray-400(.*?>₹)/g, 'text-accent-amber$1');
  
  // For analytics page (color: 'text-indigo-400')
  content = content.replace(/color:\s*'text-indigo-400'/g, "color: 'text-accent-amber'");
  content = content.replace(/text-xs text-gray-500(.*?>.*?\{.*?₹)/g, 'text-xs text-accent-amber$1'); // chart labels

  // 2. All card containers
  content = content.replace(/bg-gray-900\/50 border border-gray-800/g, 'bg-surface border border-surface-border');
  content = content.replace(/rounded-xl/g, 'rounded-card shadow-card');

  // 3. Primary buttons
  content = content.replace(/bg-indigo-600 hover:bg-indigo-500/g, 'bg-accent-indigo hover:bg-accent-indigo-hover');

  // 4. Secondary / destructive buttons
  // Cancel button in orders
  content = content.replace(/bg-red-900\/50 hover:bg-red-800 text-red-200/g, 'bg-transparent border border-surface-border text-red-500 hover:bg-surface');
  // Edit/Remove buttons in menu
  content = content.replace(/bg-gray-700 hover:bg-gray-600 text-white/g, 'bg-transparent border border-surface-border text-text-secondary hover:bg-surface');
  content = content.replace(/bg-red-900\/30 hover:bg-red-900\/50 text-red-300/g, 'bg-transparent border border-surface-border text-red-400 hover:bg-surface');
  content = content.replace(/bg-gray-800 hover:bg-gray-700 text-gray-300/g, 'bg-transparent border border-surface-border text-text-secondary hover:bg-surface');

  fs.writeFileSync(fp, content, 'utf8');
});

console.log("Tokens replaced.");
