/* 子页面生成器：为导航下拉菜单的每个分区生成独立子页 + 联系页
   用法：node scripts/gen_subpages.js（幂等，可重复执行）
   主页面顶栏会被替换为新的下拉导航（指向子页 + Contact 菜单）。
*/
const fs = require('fs');
const path = require('path');

const webDir = path.join(__dirname, '..', 'web');

/* ---------- 联系信息 ---------- */
const CONTACT = {
  whatsapp: { href: 'https://wa.me/85293188252', value: '+852 9318 8252' },
  wechat: { value: '+86 158 0022 2338', copy: '+8615800222338' },
  email: { href: 'mailto:erik.wong@napell.bio', value: 'erik.wong@napell.bio' },
};

/* ---------- 顶栏（含下拉子菜单 → 独立子页 + Contact） ---------- */
function topbar(active) {
  var navItem = function (href, key, subItems, strongHref, strongKey, activeFlag) {
    var lines = [
      '      <div class="nav-item">',
      '        <a class="nav-link' + (activeFlag ? ' active' : '') + '" href="' + href + '"><span data-i18n="' + key + '"></span><span class="caret">▾</span></a>',
      '        <div class="dropdown">',
      '          <div class="dd-label" data-i18n="' + key + '"></div>',
    ];
    subItems.forEach(function (it) {
      if (it.copy) {
        lines.push('          <a href="#" data-copy="' + it.copy + '" data-i18n="' + it.key + '"></a>');
      } else if (it.href && it.target) {
        lines.push('          <a href="' + it.href + '" target="_blank" rel="noopener" data-i18n="' + it.key + '"></a>');
      } else {
        lines.push('          <a href="' + it.href + '" data-i18n="' + it.key + '"></a>');
      }
    });
    lines.push('          <a class="dd-strong" href="' + strongHref + '" data-i18n="' + strongKey + '"></a>');
    lines.push('        </div>');
    lines.push('      </div>');
    return lines.join('\n');
  };

  var contactSub = [
    { href: CONTACT.whatsapp.href, target: '_blank', key: 'nav.contactSub.whatsapp' },
    { copy: CONTACT.wechat.copy, key: 'nav.contactSub.wechat' },
    { href: CONTACT.email.href, key: 'nav.contactSub.email' },
  ];

  return [
  '<header class="topbar">',
  '  <div class="container">',
  '    <a class="brand" href="index.html">JEBI<span class="tagline" data-i18n="common.brandTag"></span></a>',
  '    <nav class="nav">',
  navItem('index.html', 'nav.home', [
    { href: 'concept.html', key: 'nav.homeSub.concept' },
    { href: 'token-economy.html', key: 'nav.homeSub.tokens' },
    { href: 'revenue.html', key: 'nav.homeSub.revenue' },
    { href: 'roadmap.html', key: 'nav.homeSub.roadmap' },
    { href: 'compliance.html', key: 'nav.homeSub.compliance' },
  ], 'index.html', 'nav.home', active === 'home'),
  navItem('franchise.html', 'nav.franchise', [
    { href: 'franchise-models.html', key: 'nav.franchiseSub.models' },
    { href: 'ai-services.html', key: 'nav.franchiseSub.services' },
    { href: 'daily-sop.html', key: 'nav.franchiseSub.sop' },
    { href: 'data-rewards.html', key: 'nav.franchiseSub.data' },
    { href: 'faq.html', key: 'nav.franchiseSub.faq' },
  ], 'franchise.html', 'nav.franchise', active === 'franchise'),
  navItem('demo.html', 'nav.demo', [
    { href: 'price-quote.html', key: 'nav.demoSub.quote' },
    { href: 'ai-recommendation.html', key: 'nav.demoSub.recommend' },
    { href: 'usage-audit.html', key: 'nav.demoSub.audit' },
  ], 'demo.html', 'nav.demo', active === 'demo'),
  navItem('architecture.html', 'nav.arch', [
    { href: 'system-layers.html', key: 'nav.archSub.layers' },
    { href: 'api-routes.html', key: 'nav.archSub.api' },
    { href: 'smart-contracts.html', key: 'nav.archSub.contracts' },
    { href: 'data-flow.html', key: 'nav.archSub.dataflow' },
  ], 'architecture.html', 'nav.arch', active === 'arch'),
  navItem('contact.html', 'nav.contact', contactSub, 'contact.html', 'nav.contact', active === 'contact'),
  '    </nav>',
  '    <button class="lang-btn" id="langBtn" data-i18n-title="nav.langTitle" aria-label="Language"><span>🌐</span><span id="langLabel">EN</span></button>',
  '    <button class="nav-toggle" aria-label="Menu">☰</button>',
  '  </div>',
  '</header>',
  ].join('\n');
}

/* ---------- 页脚 ---------- */
function footer() {
  return [
  '<footer class="foot">',
  '  <div class="container">',
  '    <div class="grid grid-3">',
  '      <div><div class="brand" style="font-size:24px;">JEBI</div><p style="font-size:13.5px; color:var(--text-2); margin-top:10px;" data-i18n="common.brandTag"></p></div>',
  '      <div><h4 data-i18n="common.links"></h4><a href="index.html" data-i18n="common.backHome"></a><a href="franchise.html" data-i18n="common.franchiseManual"></a><a href="demo.html" data-i18n="common.viewDemo"></a><a href="architecture.html" data-i18n="common.techArch"></a><a href="contact.html" data-i18n="nav.contact"></a></div>',
  '      <div><h4 data-i18n="common.lang"></h4><a href="#" data-lang-link="en">English</a><a href="#" data-lang-link="zh">简体中文</a><a href="#" data-lang-link="ar">العربية السعودية</a></div>',
  '    </div>',
  '    <div class="disclaimer" data-i18n="common.disclaimer"></div>',
  '    <div style="margin-top:10px; font-size:12.5px; color:var(--text-2);" data-i18n="common.copyright">© <span id="year">2025</span> JEBI · jebi.one</div>',
  '  </div>',
  '</footer>',
  ].join('\n');
}

/* ---------- 语言弹窗 ---------- */
function modal() {
  return [
  '<div class="modal-overlay" id="langModal" hidden>',
  '  <div class="modal">',
  '    <div class="brand" style="font-size:30px;">JEBI</div>',
  '    <h2 data-i18n="modal.title"></h2>',
  '    <p class="sub" data-i18n="modal.subtitle"></p>',
  '    <div class="lang-options">',
  '      <button class="lang-option" data-lang="en"><span class="flag">🇺🇸</span><span><b data-i18n="modal.en"></b><span data-i18n="modal.enDesc"></span></span></button>',
  '      <button class="lang-option" data-lang="zh"><span class="flag">🇨🇳</span><span><b data-i18n="modal.zh"></b><span data-i18n="modal.zhDesc"></span></span></button>',
  '      <button class="lang-option" data-lang="ar"><span class="flag">🇸🇦</span><span><b data-i18n="modal.ar"></b><span data-i18n="modal.arDesc"></span></span></button>',
  '    </div>',
  '  </div>',
  '</div>',
  ].join('\n');
}

/* ---------- 页面外壳 ---------- */
function shell(opts) {
  var hero = '';
  if (opts.hero) {
    hero = opts.hero;
  }
  var scripts = [
  '  <script src="assets/js/i18n-core.js"></script>',
  '  <script src="assets/js/i18n-shared.js"></script>',
  '  <script src="assets/js/' + opts.dict + '"></script>',
  '  <script src="assets/js/nav.js"></script>',
  ];
  (opts.extraScripts || []).forEach(function (s) {
    scripts.splice(scripts.length - 1, 0, '  <script src="assets/js/' + s + '"></script>');
  });
  return [
  '<!DOCTYPE html>',
  '<html lang="en" dir="ltr">',
  '<head>',
  '  <meta charset="UTF-8" />',
  '  <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
  '  <title data-i18n="' + opts.titleKey + '">JEBI</title>',
  '  <link rel="stylesheet" href="assets/css/style.css" />',
  '</head>',
  '<body' + (opts.bodyAttr || '') + '>',
  '',
  topbar(opts.active),
  '',
  hero,
  '',
  opts.content,
  '',
  footer(),
  '',
  modal(),
  '',
  scripts.join('\n'),
  '</body>',
  '</html>',
  ].join('\n');
}

/* ---------- 静态分区子页 hero ---------- */
function sectionHero(kickerKey, titleKey, leadKey) {
  var lead = leadKey
    ? '    <p class="lead" data-i18n="' + leadKey + '"></p>'
    : '';
  return [
  '<section class="hero alt">',
  '  <div class="container">',
  '    <span class="badge gold" data-i18n="' + kickerKey + '"></span>',
  '    <h1 data-i18n="' + titleKey + '"></h1>',
  lead,
  '  </div>',
  '</section>',
  ].join('\n');
}

/* ---------- 从主页面提取分区内容 ---------- */
function extractSection(page, id) {
  var html = fs.readFileSync(path.join(webDir, page), 'utf8');
  var re = new RegExp('<section[^>]*id="' + id + '"[^>]*>[\\s\\S]*?<\\/section>');
  var m = html.match(re);
  if (!m) { console.error('section not found: ' + page + ' #' + id); process.exit(1); }
  return m[0];
}

/* ---------- 主页面顶栏替换 ---------- */
function replaceTopbar(page, active) {
  var p = path.join(webDir, page);
  var html = fs.readFileSync(p, 'utf8');
  var re = /<header class="topbar">[\s\S]*?<\/header>/;
  var m = html.match(re);
  if (!m) { console.error('topbar not found: ' + page); process.exit(1); }
  fs.writeFileSync(p, html.replace(re, topbar(active)));
  console.log('topbar updated: ' + page);
}

/* ---------- 演示页共用组件（来自 demo.html） ---------- */
function demoHero(titleKey, leadKey) {
  return [
  '<section class="demo-hero">',
  '  <div class="container">',
  '    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">',
  '      <div>',
  '        <span class="kicker" data-i18n="demo.heroKicker"></span>',
  '        <h1 style="font-size:clamp(26px,3.6vw,38px); margin-top:8px;" data-i18n="' + titleKey + '"></h1>',
  '        <p style="color:var(--text-2); margin-top:6px; max-width:640px;" data-i18n="' + leadKey + '"></p>',
  '      </div>',
  '      <span class="demo-status"><span class="dot" id="connDot"></span><span id="connText" data-i18n="status.connecting"></span></span>',
  '    </div>',
  '  </div>',
  '</section>',
  ].join('\n');
}

function flowStrip() {
  return [
  '    <div class="flow-strip">',
  '      <div class="card"><b data-i18n="demo.flow1.b"></b><span data-i18n="demo.flow1.s"></span></div>',
  '      <div class="card"><b data-i18n="demo.flow2.b"></b><span data-i18n="demo.flow2.s"></span></div>',
  '      <div class="card"><b data-i18n="demo.flow3.b"></b><span data-i18n="demo.flow3.s"></span></div>',
  '      <div class="card"><b data-i18n="demo.flow4.b"></b><span data-i18n="demo.flow4.s"></span></div>',
  '    </div>',
  ].join('\n');
}

function userPanel() {
  return [
  '      <div class="panel">',
  '        <h3 data-i18n="demo.user.h3"> <span class="hint" data-i18n="demo.user.hint"></span></h3>',
  '        <div class="role-cards">',
  '          <button class="role-card" data-role="business"><b data-i18n="demo.role.business.b"></b><span data-i18n="demo.role.business.s"></span></button>',
  '          <button class="role-card" data-role="consumer_bundle"><b data-i18n="demo.role.bundle.b"></b><span data-i18n="demo.role.bundle.s"></span></button>',
  '          <button class="role-card" data-role="consumer_payg"><b data-i18n="demo.role.payg.b"></b><span data-i18n="demo.role.payg.s"></span></button>',
  '        </div>',
  '        <div class="field-row">',
  '          <div class="field" style="margin:0;"><label data-i18n="demo.userId"></label><input id="userId" value="demo_user" /></div>',
  '          <button class="btn outline small" id="genId" data-i18n="demo.gen"></button>',
  '        </div>',
  '        <div class="field" style="margin-top:12px;">',
  '          <label data-i18n="demo.topupLabel"></label>',
  '          <div class="field-row"><input id="topupAmt" type="number" min="1" max="10000" value="1000" /><button class="btn primary small" id="btnTopup" data-i18n="demo.topupBtn"></button></div>',
  '        </div>',
  '        <div class="kpi-grid" style="grid-template-columns:1fr 1fr;">',
  '          <div class="kpi"><b id="kpiBalance">–</b><span data-i18n="demo.kpiBalance"></span></div>',
  '          <div class="kpi"><b id="kpiSub">–</b><span data-i18n="demo.kpiSub"></span></div>',
  '        </div>',
  '        <div style="display:flex; gap:8px; flex-wrap:wrap;">',
  '          <button class="btn outline small" id="btnSubscribe" style="display:none;" data-i18n="demo.subBtn"></button>',
  '          <button class="btn outline small" id="btnRefund" data-i18n="demo.refundBtn"></button>',
  '        </div>',
  '        <hr class="divider" />',
  '        <div class="mono" data-i18n-html="demo.legend" style="font-size:12px; color:var(--text-2); line-height:1.9;"></div>',
  '      </div>',
  ].join('\n');
}

function demoNote() {
  return [
  '    <div class="card" style="margin-top:22px; border-color:rgba(212,168,84,0.4);">',
  '      <h3 style="font-size:15px;" data-i18n="demo.note.h3"></h3>',
  '      <p style="font-size:13.5px; color:var(--text-2); margin-top:6px;" data-i18n-html="demo.noteP"></p>',
  '    </div>',
  ].join('\n');
}

function quotePanel() {
  return [
  '      <div>',
  '        <div id="msgBox" class="msg-banner"></div>',
  '        <div class="panel" id="quote">',
  '          <h3 data-i18n="demo.quote.h3"> <span class="hint" data-i18n="demo.quote.hint"></span></h3>',
  '          <div class="kpi-grid">',
  '            <div class="kpi"><b id="qCost">–</b><span data-i18n="demo.kpiCost"></span></div>',
  '            <div class="kpi"><b id="qJbp">–</b><span data-i18n="demo.kpiJbp"></span></div>',
  '            <div class="kpi"><b id="qMarkup">–</b><span data-i18n="demo.kpiMarkup"></span></div>',
  '          </div>',
  '          <p id="qNote" class="mono" style="font-size:12.5px; color:var(--text-2); margin-bottom:12px;"></p>',
  '          <button class="btn outline small" id="btnQuote" data-i18n="demo.refreshQuote"></button>',
  '        </div>',
  '      </div>',
  ].join('\n');
}

function recommendPanel() {
  return [
  '      <div>',
  '        <div id="msgBox" class="msg-banner"></div>',
  '        <div class="panel" id="recommend">',
  '          <h3 data-i18n="demo.rec.h3"> <span class="hint" data-i18n="demo.rec.hint"></span></h3>',
  '          <div class="field"><label data-i18n="demo.history"></label><div class="chips" id="historyChips">',
  '            <span class="chip" data-v="Latte">Latte</span><span class="chip" data-v="Cold Brew">Cold Brew</span><span class="chip" data-v="Espresso">Espresso</span><span class="chip" data-v="Mocha">Mocha</span><span class="chip" data-v="Americano">Americano</span><span class="chip" data-v="Cappuccino">Cappuccino</span>',
  '          </div></div>',
  '          <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px;">',
  '            <div class="field"><label data-i18n="demo.weather"></label><select id="weather"><option data-i18n="demo.weatherOpt.sunny"></option><option data-i18n="demo.weatherOpt.cloudy"></option><option data-i18n="demo.weatherOpt.overcast"></option><option data-i18n="demo.weatherOpt.rain"></option><option data-i18n="demo.weatherOpt.snow"></option></select></div>',
  '            <div class="field"><label data-i18n="demo.time"></label><select id="timeOfDay"><option value="morning" data-i18n="demo.timeOpt.morning"></option><option value="afternoon" data-i18n="demo.timeOpt.afternoon"></option><option value="evening" data-i18n="demo.timeOpt.evening"></option><option value="night" data-i18n="demo.timeOpt.night"></option></select></div>',
  '            <div class="field"><label data-i18n="demo.budget"></label><input id="budget" type="number" min="0" value="30" /></div>',
  '          </div>',
  '          <div class="field"><label data-i18n="demo.diet"></label><div class="chips" id="dietChips"><span class="chip" data-v="plant-milk" data-i18n="demo.dietOpt.plantMilk"></span><span class="chip" data-v="low-sugar" data-i18n="demo.dietOpt.lowSugar"></span><span class="chip" data-v="no-caffeine" data-i18n="demo.dietOpt.noCaffeine"></span></div></div>',
  '          <button class="btn dark" id="btnRecommend" style="width:100%;" data-i18n="demo.recommendBtn"></button>',
  '          <div id="recCard" style="display:none; margin-top:16px;"></div>',
  '        </div>',
  '      </div>',
  ].join('\n');
}

function auditPanel() {
  return [
  '      <div>',
  '        <div id="msgBox" class="msg-banner"></div>',
  '        <div class="panel" id="audit">',
  '          <h3 data-i18n="demo.audit.h3"> <span class="hint" data-i18n="demo.audit.hint"></span></h3>',
  '          <div class="kpi-grid">',
  '            <div class="kpi"><b id="sCalls">–</b><span data-i18n="demo.kpiCalls"></span></div>',
  '            <div class="kpi"><b id="sCost">–</b><span data-i18n="demo.kpiCostSum"></span></div>',
  '            <div class="kpi"><b id="sCharged">–</b><span data-i18n="demo.kpiCharged"></span></div>',
  '          </div>',
  '          <button class="btn outline small" id="btnSummary" style="width:100%;" data-i18n="demo.refreshAudit"></button>',
  '        </div>',
  '      </div>',
  ].join('\n');
}

function demoContent(panelFn) {
  return [
  '<section class="section" style="padding-top:36px;">',
  '  <div class="container">',
  flowStrip(),
  '    <div class="demo-layout">',
  userPanel(),
  panelFn(),
  '    </div>',
  demoNote(),
  '  </div>',
  '</section>',
  ].join('\n');
}

/* ---------- 联系页 ---------- */
function contactPage() {
  var card = function (icon, labelKey, value, noteKey, actionHtml) {
    return [
    '      <div class="card">',
    '        <div class="icon">' + icon + '</div>',
    '        <h3 data-i18n="' + labelKey + '"></h3>',
    '        <p class="mono" style="font-size:17px; margin:8px 0 4px;">' + value + '</p>',
    '        <p style="font-size:13px; color:var(--text-2);" data-i18n="' + noteKey + '"></p>',
    '        <div style="margin-top:14px;">' + actionHtml + '</div>',
    '      </div>',
    ].join('\n');
  };
  var content = [
  '<section class="section" style="padding-top:52px;">',
  '  <div class="container">',
  '    <div class="grid grid-3">',
  card('💬', 'contact.whatsapp.label', CONTACT.whatsapp.value, 'contact.whatsapp.note',
    '<a class="btn primary small" href="' + CONTACT.whatsapp.href + '" target="_blank" rel="noopener" data-i18n="nav.contactSub.whatsapp"></a>'),
  card('💬', 'contact.wechat.label', CONTACT.wechat.value, 'contact.wechat.note',
    '<button class="btn outline small" data-copy="' + CONTACT.wechat.copy + '" data-i18n="contact.copyBtn"></button>'),
  card('✉️', 'contact.email.label', CONTACT.email.value, 'contact.email.note',
    '<a class="btn outline small" href="' + CONTACT.email.href + '" data-i18n="nav.contactSub.email"></a>'),
  '    </div>',
  '    <div class="card" style="margin-top:22px; text-align:center; border-color:rgba(212,168,84,0.4);">',
  '      <p style="color:var(--text-2);" data-i18n="contact.responseTime"></p>',
  '    </div>',
  '  </div>',
  '</section>',
  ].join('\n');
  return shell({
    titleKey: 'contact.title',
    active: 'contact',
    dict: 'i18n-shared.js',
    hero: sectionHero('common.brandTag', 'contact.title', 'contact.lead'),
    content: content,
  });
}

/* ---------- 页面定义 ---------- */
function main() {
  /* 1) 更新主页面顶栏 */
  replaceTopbar('index.html', 'home');
  replaceTopbar('franchise.html', 'franchise');
  replaceTopbar('demo.html', 'demo');
  replaceTopbar('architecture.html', 'arch');

  /* 2) 静态分区子页 */
  var subs = [
    { page: 'index.html', id: 'concept', file: 'concept.html', k: 'index.conceptKicker', t: 'index.conceptTitle', l: 'index.conceptDesc', dict: 'i18n-index.js', act: 'home' },
    { page: 'index.html', id: 'tokens', file: 'token-economy.html', k: 'index.dualKicker', t: 'index.dualTitle', l: 'index.dualDesc', dict: 'i18n-index.js', act: 'home' },
    { page: 'index.html', id: 'revenue', file: 'revenue.html', k: 'index.revKicker', t: 'index.revTitle', l: 'index.revDesc', dict: 'i18n-index.js', act: 'home' },
    { page: 'index.html', id: 'roadmap', file: 'roadmap.html', k: 'index.roadKicker', t: 'index.roadTitle', l: '', dict: 'i18n-index.js', act: 'home' },
    { page: 'index.html', id: 'compliance', file: 'compliance.html', k: 'index.compKicker', t: 'index.compTitle', l: '', dict: 'i18n-index.js', act: 'home' },
    { page: 'franchise.html', id: 'models', file: 'franchise-models.html', k: 'franchise.modelsKicker', t: 'franchise.modelsTitle', l: '', dict: 'i18n-franchise.js', act: 'franchise' },
    { page: 'franchise.html', id: 'services', file: 'ai-services.html', k: 'franchise.svcKicker', t: 'franchise.svcTitle', l: 'franchise.svcDesc', dict: 'i18n-franchise.js', act: 'franchise' },
    { page: 'franchise.html', id: 'sop', file: 'daily-sop.html', k: 'franchise.sopKicker', t: 'franchise.sopTitle', l: '', dict: 'i18n-franchise.js', act: 'franchise' },
    { page: 'franchise.html', id: 'data', file: 'data-rewards.html', k: 'franchise.dataKicker', t: 'franchise.dataTitle', l: '', dict: 'i18n-franchise.js', act: 'franchise' },
    { page: 'franchise.html', id: 'faq', file: 'faq.html', k: 'franchise.faqKicker', t: 'franchise.faqTitle', l: '', dict: 'i18n-franchise.js', act: 'franchise' },
    { page: 'architecture.html', id: 'layers', file: 'system-layers.html', k: 'arch.layersKicker', t: 'arch.layersTitle', l: '', dict: 'i18n-arch.js', act: 'arch' },
    { page: 'architecture.html', id: 'api', file: 'api-routes.html', k: 'arch.apiKicker', t: 'arch.apiTitle', l: '', dict: 'i18n-arch.js', act: 'arch' },
    { page: 'architecture.html', id: 'contracts', file: 'smart-contracts.html', k: 'arch.ctKicker', t: 'arch.ctTitle', l: '', dict: 'i18n-arch.js', act: 'arch' },
    { page: 'architecture.html', id: 'dataflow', file: 'data-flow.html', k: 'arch.flowKicker', t: 'arch.flowTitle', l: '', dict: 'i18n-arch.js', act: 'arch' },
  ];
  subs.forEach(function (s) {
    var html = shell({
      titleKey: s.t,
      active: s.act,
      dict: s.dict,
      hero: sectionHero(s.k, s.t, s.l),
      content: extractSection(s.page, s.id),
    });
    fs.writeFileSync(path.join(webDir, s.file), html);
    console.log('generated: ' + s.file);
  });

  /* 3) 演示子页 */
  var demos = [
    { file: 'price-quote.html', titleKey: 'demo.quote.h3', leadKey: 'demo.quote.hint', panel: quotePanel, scripts: ['api.js', 'demo.js'] },
    { file: 'ai-recommendation.html', titleKey: 'demo.rec.h3', leadKey: 'demo.rec.hint', panel: recommendPanel, scripts: ['api.js', 'demo.js'] },
    { file: 'usage-audit.html', titleKey: 'demo.audit.h3', leadKey: 'demo.audit.hint', panel: auditPanel, scripts: ['api.js', 'demo.js'] },
  ];
  demos.forEach(function (d) {
    var html = shell({
      titleKey: d.titleKey,
      active: 'demo',
      dict: 'i18n-demo.js',
      hero: demoHero(d.titleKey, d.leadKey),
      content: demoContent(d.panel),
      extraScripts: d.scripts,
    });
    fs.writeFileSync(path.join(webDir, d.file), html);
    console.log('generated: ' + d.file);
  });

  /* 4) 联系页 */
  fs.writeFileSync(path.join(webDir, 'contact.html'), contactPage());
  console.log('generated: contact.html');
  console.log('DONE');
}

main();