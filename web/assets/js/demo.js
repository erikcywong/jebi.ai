/* 业务演示台交互逻辑（i18n 集成版） */
(function () {
  var api = window.JebiApi;
  var esc = api.escapeHtml;
  var i18n = window.JebiI18N;
  var t = function (k, v) { return i18n ? i18n.t(k, v) : k; };
  var lang = function () { return i18n ? i18n.lang : 'en'; };

  var state = {
    userId: 'demo_user',
    role: 'business',
    balance: null,
    subscription: false,
    history: ['Latte'],
    diet: [],
  };

  var $ = function (id) { return document.getElementById(id); };
  var msgBox = $('msgBox');

  function showMsg(text, kind) {
    msgBox.className = 'msg-banner ' + (kind || 'err');
    msgBox.textContent = text;
  }
  function clearMsg() { msgBox.className = 'msg-banner'; msgBox.textContent = ''; }

  /* 后端错误码 → 本地化文案 */
  function friendly(err) {
    if (!err) return t('err.HTTP', { code: '?' });
    if (err.code === 'NETWORK') return t('err.NETWORK');
    var mapped = t('err.' + err.code);
    if (mapped !== 'err.' + err.code) return mapped;
    if (err.code === 'HTTP') return t('err.HTTP', { code: err.status || '?' });
    return err.message || t('err.HTTP', { code: err.status || '?' });
  }

  function setConn(ok, text) {
    var dot = $('connDot');
    if (dot) dot.className = 'dot' + (ok ? ' ok' : '');
    var txt = $('connText');
    if (txt) txt.textContent = text;
  }

  /* ---------- 用户 / 余额 ---------- */
  async function refreshBalance() {
    try {
      var u = await api.balance(state.userId, state.role);
      state.balance = u.jbp_balance;
      state.subscription = !!u.subscription_active;
      $('kpiBalance').textContent = String(u.jbp_balance);
      $('kpiSub').textContent = u.subscription_active ? t('status.subOn') : t('status.subOff');
      var subBtn = $('btnSubscribe');
      if (subBtn) subBtn.style.display = (state.role === 'consumer_bundle' && !u.subscription_active) ? 'inline-flex' : 'none';
    } catch (e) {
      setConn(false, t('status.offline'));
      showMsg(friendly(e), 'err');
    }
  }

  function bindRoles() {
    var cards = document.querySelectorAll('.role-card');
    cards.forEach(function (c) {
      c.addEventListener('click', function () {
        cards.forEach(function (x) { x.classList.remove('on'); });
        c.classList.add('on');
        state.role = c.getAttribute('data-role');
        refreshBalance();
      });
    });
    var def = document.querySelector('.role-card[data-role="business"]');
    if (def) def.classList.add('on');
  }

  function bindChips(containerId, key) {
    document.querySelectorAll('#' + containerId + ' .chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        chip.classList.toggle('on');
        var v = chip.getAttribute('data-v');
        var arr = state[key];
        var i = arr.indexOf(v);
        if (i >= 0) { arr.splice(i, 1); } else { arr.push(v); }
      });
    });
  }

  function payload() {
    return {
      user_id: state.userId,
      store_id: 's_001',
      location: 'Shenzhen Nanshan',
      weather: ($('weather') ? $('weather').value : '晴') + ' 28°C',
      time_of_day: $('timeOfDay') ? $('timeOfDay').value : 'afternoon',
      history: state.history,
      dietary_prefs: state.diet,
      budget: parseFloat($('budget') ? $('budget').value : '30') || 30,
      lang: lang(),
    };
  }

  /* ---------- 预报价 ---------- */
  async function doQuote() {
    clearMsg();
    try {
      var q = await api.quote(payload(), state.role);
      $('qCost').textContent = q.cost_cny.toFixed(4);
      $('qJbp').textContent = String(q.charged_jbp);
      $('qMarkup').textContent = (q.markup === Infinity || q.markup > 9999) ? '∞' : q.markup.toFixed(1) + '×';
      $('qNote').textContent = q.note + t('demo.noteAppend', { cny: q.charged_cny.toFixed(2) });
    } catch (e) { showMsg(friendly(e), 'err'); }
  }

  /* ---------- 推荐 ---------- */
  function renderRec(r) {
    var conf = Math.max(0, Math.min(1, r.confidence)) * 100;
    var alts = (r.alternatives || []).map(function (a) { return '<span class="tag">' + esc(a) + '</span>'; }).join(' ');
    var chargedHtml = r.charged_jbp > 0
      ? t('rec.charged', { jbp: r.charged_jbp }) + ' (' + (r.charged_jbp * 0.1).toFixed(1) + ' CNY)'
      : t('rec.charged', { jbp: 0 }) + ' ' + t('rec.free');
    $('recCard').innerHTML =
      '<div class="rec-card">' +
        '<div class="name">' + esc(r.recommendation) + '</div>' +
        '<div class="reason">' + esc(r.reason) + '</div>' +
        '<div style="font-size:12px;color:var(--text-2);">' + t('rec.confidence', { p: conf.toFixed(0) }) + '</div>' +
        '<div class="conf-bar"><i style="width:' + conf + '%"></i></div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">' + alts + '</div>' +
        '<div style="font-size:13px;color:var(--text-2);">' + chargedHtml + ' ｜ ' + t('rec.inventory', { s: r.inventory_status }) + '</div>' +
      '</div>';
    $('recCard').style.display = 'block';
  }

  async function doRecommend() {
    clearMsg();
    $('btnRecommend').disabled = true;
    $('btnRecommend').textContent = t('demo.recommendBtnRun');
    try {
      var r = await api.recommend(payload(), state.role, state.userId);
      renderRec(r);
      refreshBalance();
      refreshSummary();
    } catch (e) {
      showMsg(friendly(e), 'err');
    } finally {
      $('btnRecommend').disabled = false;
      $('btnRecommend').textContent = t('demo.recommendBtn');
    }
  }

  /* ---------- 对账 ---------- */
  async function refreshSummary() {
    try {
      var s = await api.summary();
      $('sCalls').textContent = String(s.calls);
      $('sCost').textContent = s.total_cost_cny.toFixed(4);
      $('sCharged').textContent = String(s.total_charged_jbp);
    } catch (e) { /* 静默 */ }
  }

  /* ---------- 充值 / 退款 / 订阅 ---------- */
  async function doTopup() {
    clearMsg();
    var amt = parseInt($('topupAmt').value, 10);
    if (!amt || amt <= 0) { showMsg(t('msg.invalidAmount'), 'err'); return; }
    if (amt > 10000) { showMsg(t('msg.frontLimit'), 'err'); return; }
    try {
      var r = await api.topup(state.userId, amt, state.role);
      showMsg(t('msg.topupOk', { amt: amt, bal: r.jbp_balance }), 'info');
      refreshBalance();
    } catch (e) { showMsg(friendly(e), 'err'); }
  }

  async function doRefund() {
    clearMsg();
    try {
      var r = await api.refund(state.userId);
      showMsg(t('msg.refundOk', { amt: r.refunded_jbp, bal: r.jbp_balance }), 'info');
      refreshBalance();
    } catch (e) { showMsg(friendly(e), 'err'); }
  }

  async function doSubscribe() {
    clearMsg();
    try {
      await api.subscribe(state.userId, true, state.role);
      showMsg(t('msg.subscribeOk'), 'info');
      refreshBalance();
    } catch (e) { showMsg(friendly(e), 'err'); }
  }

  function genId() {
    state.userId = 'u_' + Math.random().toString(36).slice(2, 8);
    $('userId').value = state.userId;
    refreshBalance();
  }

  function init() {
    bindRoles();
    bindChips('historyChips', 'history');
    bindChips('dietChips', 'diet');
    var defChip = document.querySelector('#historyChips .chip[data-v="Latte"]');
    if (defChip) defChip.classList.add('on');

    $('genId').addEventListener('click', genId);
    $('userId').addEventListener('change', function () { state.userId = $('userId').value.trim() || 'demo_user'; refreshBalance(); });
    $('btnTopup').addEventListener('click', doTopup);
    $('btnRefund').addEventListener('click', doRefund);
    $('btnSubscribe').addEventListener('click', doSubscribe);
    $('btnSummary').addEventListener('click', refreshSummary);
    $('btnRecommend').addEventListener('click', doRecommend);
    $('btnQuote').addEventListener('click', doQuote);

    /* 语言切换后：清理动态结果并刷新 */
    document.addEventListener('jebi:langchange', function () {
      var rc = $('recCard');
      if (rc) { rc.style.display = 'none'; rc.innerHTML = ''; }
      clearMsg();
      refreshBalance();
      refreshSummary();
      doQuote();
    });

    api.health().then(function () {
      setConn(true, t('status.connected', { url: api.base }));
      refreshBalance();
      refreshSummary();
      doQuote();
    }).catch(function (e) {
      setConn(false, t('status.offline'));
      showMsg(friendly(e), 'err');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
