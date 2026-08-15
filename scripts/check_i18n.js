/* i18n 覆盖率校验：扫描 4 个页面的 data-i18n* 键，逐一核对 en/zh/ar 词库。
   用法：node scripts/check_i18n.js */
const fs = require('fs');
const path = require('path');

global.window = global; // 字典文件依赖 window.JebiI18N

const core = require('../web/assets/js/i18n-core.js');

function t_key_exists(lang, key) {
  return typeof core.data[lang][key] === 'string';
}
core.t_key_exists = t_key_exists;
require('../web/assets/js/i18n-shared.js');
require('../web/assets/js/i18n-index.js');
require('../web/assets/js/i18n-franchise.js');
require('../web/assets/js/i18n-demo.js');
require('../web/assets/js/i18n-arch.js');

const webDir = path.join(__dirname, '..', 'web');
const pages = ['index.html', 'franchise.html', 'demo.html', 'architecture.html'];
const attrRe = /data-i18n(?:-html|-placeholder|-title|-aria)?="([^"]+)"/g;

const used = new Set();
for (const page of pages) {
  const html = fs.readFileSync(path.join(webDir, page), 'utf8');
  let m;
  while ((m = attrRe.exec(html)) !== null) {
    m[1].split(/\s+/).filter(Boolean).forEach(function (k) { used.add(k); });
  }
}

let missing = 0;
const missingByLang = { en: [], zh: [], ar: [] };
for (const key of Array.from(used).sort()) {
  for (const lang of ['en', 'zh', 'ar']) {
    if (!core.t_key_exists(lang, key)) { missingByLang[lang].push(key); missing++; }
  }
}

for (const lang of ['en', 'zh', 'ar']) {
  console.log('[' + lang + '] missing: ' + missingByLang[lang].length);
  missingByLang[lang].forEach(function (k) { console.log('   ' + k); });
}

// 未使用键（信息性）
const defined = new Set();
Object.keys(core.data).forEach(function (lang) {
  (function walk(obj, prefix) {
    Object.keys(obj).forEach(function (k) {
      const full = prefix ? prefix + '.' + k : k;
      if (typeof obj[k] === 'string') defined.add(full);
      else walk(obj[k], full);
    });
  })(core.data[lang], '');
});
const unused = Array.from(defined).filter(function (k) { return !used.has(k); });
console.log('defined-but-unused keys: ' + unused.length);
unused.slice(0, 20).forEach(function (k) { console.log('   ' + k); });

console.log('\nTOTAL used keys: ' + used.size + '  |  missing: ' + missing);
process.exit(missing > 0 ? 1 : 0);