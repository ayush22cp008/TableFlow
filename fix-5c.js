const fs = require('fs');
const path = require('path');

const baseDir = 'C:/Users/ayush/Desktop/vibethon_project';

// 1. Tables Page (Add Table / Reserve Table Modal + Waitlist section)
const tablesPath = path.join(baseDir, 'app/dashboard/tables/page.tsx');
let tablesContent = fs.readFileSync(tablesPath, 'utf8');
tablesContent = tablesContent.replace(/bg-gray-900 border border-gray-800 rounded-2xl/g, 'bg-surface border border-surface-border rounded-card shadow-card');
tablesContent = tablesContent.replace(/bg-gray-800 hover:bg-gray-700 text-white rounded-xl/g, 'bg-transparent hover:bg-surface border border-surface-border text-text-secondary rounded-xl');
tablesContent = tablesContent.replace(/bg-indigo-600 hover:bg-indigo-500/g, 'bg-accent-indigo hover:bg-accent-indigo-hover');
tablesContent = tablesContent.replace(/focus:ring-indigo-500/g, 'focus:ring-accent-indigo');
tablesContent = tablesContent.replace(/bg-gray-900\/50 border border-gray-800 rounded-xl/g, 'bg-surface border border-surface-border rounded-card shadow-card');
tablesContent = tablesContent.replace(/bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg/g, 'bg-transparent hover:bg-surface border border-surface-border text-text-secondary rounded-lg');
fs.writeFileSync(tablesPath, tablesContent, 'utf8');

// 2. Menu Management Page (Add Menu Item Modal)
const menuPath = path.join(baseDir, 'app/dashboard/menu/page.tsx');
let menuContent = fs.readFileSync(menuPath, 'utf8');
menuContent = menuContent.replace(/bg-gray-900 border border-gray-800 rounded-2xl/g, 'bg-surface border border-surface-border rounded-card shadow-card');
menuContent = menuContent.replace(/bg-gray-800 hover:bg-gray-700 text-white rounded-card shadow-card/g, 'bg-transparent hover:bg-surface border border-surface-border text-text-secondary rounded-card shadow-card');
menuContent = menuContent.replace(/focus:ring-indigo-500/g, 'focus:ring-accent-indigo');
fs.writeFileSync(menuPath, menuContent, 'utf8');

// 3. Reservation Status Page
const statusPath = path.join(baseDir, 'app/reserve/status/page.tsx');
let statusContent = fs.readFileSync(statusPath, 'utf8');
statusContent = statusContent.replace('text-2xl font-bold', 'text-2xl font-extrabold tracking-tight');
statusContent = statusContent.replace(/bg-gray-900 border border-gray-800/g, 'bg-gray-800/50 border border-gray-700'); // Input field
statusContent = statusContent.replace(/focus:ring-indigo-500/g, 'focus:ring-accent-indigo');
statusContent = statusContent.replace(/bg-indigo-600 hover:bg-indigo-500/g, 'bg-accent-indigo hover:bg-accent-indigo-hover');
statusContent = statusContent.replace(/bg-gray-900\/50 border border-gray-800 rounded-xl/g, 'bg-surface border border-surface-border rounded-card shadow-card');
statusContent = statusContent.replace(/text-indigo-400/g, 'text-accent-amber');
fs.writeFileSync(statusPath, statusContent, 'utf8');

console.log("Tokens replaced for Node 5c.");
