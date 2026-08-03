const fs = require('fs');
const path = require('path');

const baseDir = 'C:/Users/ayush/Desktop/vibethon_project';

// 1. Reserve Page
const reservePath = path.join(baseDir, 'app/reserve/page.tsx');
let reserveContent = fs.readFileSync(reservePath, 'utf8');
reserveContent = reserveContent.replace('text-2xl font-bold', 'text-2xl font-extrabold tracking-tight');
reserveContent = reserveContent.replace('bg-gray-900/50 border border-gray-800 p-6 rounded-2xl', 'bg-surface border border-surface-border p-6 rounded-card shadow-card');
reserveContent = reserveContent.replace(/focus:ring-indigo-500/g, 'focus:ring-accent-indigo');
reserveContent = reserveContent.replace('bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl', 'bg-accent-indigo hover:bg-accent-indigo-hover text-white rounded-xl');
fs.writeFileSync(reservePath, reserveContent, 'utf8');

// 2. AuthForm Component
const authPath = path.join(baseDir, 'components/AuthForm.tsx');
let authContent = fs.readFileSync(authPath, 'utf8');
authContent = authContent.replace(/backdrop-blur-md bg-gray-900\/40 border border-gray-800 rounded-2xl shadow-xl/g, 'backdrop-blur-md bg-surface border border-surface-border rounded-card shadow-card');
authContent = authContent.replace(/bg-indigo-600 hover:bg-indigo-500/g, 'bg-accent-indigo hover:bg-accent-indigo-hover');
authContent = authContent.replace(/focus:ring-indigo-500/g, 'focus:ring-accent-indigo');
authContent = authContent.replace(/border-indigo-500 bg-indigo-500\/10/g, 'border-accent-indigo bg-accent-indigo/10 shadow-[0_0_15px_rgba(99,102,241,0.2)]');
authContent = authContent.replace(/border-gray-700 bg-gray-800\/30/g, 'border-surface-border bg-surface');
authContent = authContent.replace(/bg-gray-800\/50 hover:bg-gray-800 border border-gray-700 text-white/g, 'bg-transparent hover:bg-surface border border-surface-border text-text-secondary');
fs.writeFileSync(authPath, authContent, 'utf8');

// 3. Select Role Page
const selectRolePath = path.join(baseDir, 'app/auth/select-role/page.tsx');
let selectRoleContent = fs.readFileSync(selectRolePath, 'utf8');
selectRoleContent = selectRoleContent.replace(/backdrop-blur-md bg-gray-900\/40 border border-gray-800 rounded-2xl shadow-xl/g, 'backdrop-blur-md bg-surface border border-surface-border rounded-card shadow-card');
selectRoleContent = selectRoleContent.replace(/bg-indigo-600 hover:bg-indigo-500/g, 'bg-accent-indigo hover:bg-accent-indigo-hover');
selectRoleContent = selectRoleContent.replace(/focus:ring-indigo-500/g, 'focus:ring-accent-indigo');
selectRoleContent = selectRoleContent.replace(/border-indigo-500 bg-indigo-500\/10/g, 'border-accent-indigo bg-accent-indigo/10 shadow-[0_0_15px_rgba(99,102,241,0.2)]');
selectRoleContent = selectRoleContent.replace(/border-gray-700 bg-gray-800\/30/g, 'border-surface-border bg-surface');
fs.writeFileSync(selectRolePath, selectRoleContent, 'utf8');

// 4. Insights Page
const insightsPath = path.join(baseDir, 'app/dashboard/insights/page.tsx');
let insightsContent = fs.readFileSync(insightsPath, 'utf8');
insightsContent = insightsContent.replace('<h1 className="text-2xl font-bold">AI Insights</h1>', '<h1 className="text-2xl font-extrabold tracking-tight">AI Insights</h1>');
insightsContent = insightsContent.replace(/bg-indigo-600 hover:bg-indigo-500/g, 'bg-accent-indigo hover:bg-accent-indigo-hover');
insightsContent = insightsContent.replace(/className={`p-4 border rounded-xl \${borderClass} \${bgClass}`}/g, 'className="p-4 bg-surface border border-surface-border rounded-card shadow-card"');
insightsContent = insightsContent.replace(/className={`text-3xl font-bold \${textClass}`}/g, 'className="text-3xl font-bold text-accent-amber"');
insightsContent = insightsContent.replace(/className="p-6 bg-gray-900\/50 border border-blue-500\/30 rounded-xl text-gray-300 text-sm"/g, 'className="p-6 bg-surface border border-surface-border rounded-card shadow-card text-gray-300 text-sm"');
insightsContent = insightsContent.replace(/className="p-6 bg-gray-900\/50 border border-yellow-500\/30 rounded-xl"/g, 'className="p-6 bg-surface border border-surface-border rounded-card shadow-card"');
insightsContent = insightsContent.replace(/className="p-6 bg-gray-900\/50 border border-red-500\/30 rounded-xl"/g, 'className="p-6 bg-surface border border-surface-border rounded-card shadow-card"');
insightsContent = insightsContent.replace(/className="p-6 bg-gray-900\/50 border border-gray-800 rounded-xl text-gray-400"/g, 'className="p-6 bg-surface border border-surface-border rounded-card shadow-card text-gray-400"');
fs.writeFileSync(insightsPath, insightsContent, 'utf8');

console.log("Tokens replaced for Node 5b.");
