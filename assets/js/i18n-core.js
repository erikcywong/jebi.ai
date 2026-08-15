/* Jebi I18N 核心：三语词库加载、应用、语言弹窗、RTL 切换 */
(function (global) {
  var STORAGE_KEY = 'jebi_lang';
  var DEFAULTS = { en: 'English', zh: '简体中文', ar: 'العربية' };

  var I18N = {
    data: { en: {}, zh: {}, ar: {} },
    lang: 'en',

    /* 取词：扁平键直查（词典以 'a.b.c' 为完整键）+ 变量替换 + en 兜底 */
    t: function (key, vars) {
      var val = this.data[this.lang][key];
      if (typeof val !== 'string') val = this.data.en[key];
      if (typeof val !== 'string') return key;
      if (vars) {
        Object.keys(vars).forEach(function (k) {
          val = val.split('{' + k + '}').join(String(vars[k]));
        });
      }
      return val;
    },

    /* 应用语言：lang/dir + 全站 data-i18n 节点 */
    apply: function (lang) {
      if (!this.data[lang]) lang = 'en';
      this.lang = lang;
      if (typeof document === 'undefined') return;

      var root = document.documentElement;
      root.setAttribute('lang', lang);
      root.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');

      document.querySelectorAll('[data-i18n]').forEach(function (el) {
        el.textContent = I18N.t(el.getAttribute('data-i18n'));
      });
      document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
        el.innerHTML = I18N.t(el.getAttribute('data-i18n-html'));
      });
      document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
        el.setAttribute('placeholder', I18N.t(el.getAttribute('data-i18n-placeholder')));
      });
      document.querySelectorAll('[data-i18n-title]').forEach(function (el) {
        el.setAttribute('title', I18N.t(el.getAttribute('data-i18n-title')));
      });
      document.querySelectorAll('[data-i18n-aria]').forEach(function (el) {
        el.setAttribute('aria-label', I18N.t(el.getAttribute('data-i18n-aria')));
      });

      var langBtn = document.getElementById('langLabel');
      if (langBtn) langBtn.textContent = DEFAULTS[lang] || lang.toUpperCase();

      try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* 隐私模式忽略 */ }
      document.dispatchEvent(new CustomEvent('jebi:langchange', { detail: { lang: lang } }));
    },

    current: function () {
      var stored = null;
      try { stored = localStorage.getItem(STORAGE_KEY); } catch (e) { /* ignore */ }
      return stored && this.data[stored] ? stored : 'en';
    },

    showModal: function () {
      var m = document.getElementById('langModal');
      if (m) {
        m.hidden = false;
        document.body.style.overflow = 'hidden';
      }
    },

    hideModal: function () {
      var m = document.getElementById('langModal');
      if (m) {
        m.hidden = true;
        document.body.style.overflow = '';
      }
    },

    init: function (autoModal) {
      if (typeof document === 'undefined') return;
      var stored = this.current();
      this.apply(stored);

      /* 语言弹窗 */
      var overlay = document.getElementById('langModal');
      if (overlay) {
        overlay.addEventListener('click', function (e) {
          if (e.target === overlay) I18N.hideModal();
        });
        overlay.querySelectorAll('.lang-option').forEach(function (btn) {
          btn.addEventListener('click', function () {
            I18N.apply(btn.getAttribute('data-lang'));
            I18N.hideModal();
          });
        });
      }
      var reopen = document.getElementById('langBtn');
      if (reopen) reopen.addEventListener('click', function (e) { e.preventDefault(); I18N.showModal(); });

      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') I18N.hideModal();
      });

      /* 首次访问首页：显示语言选择弹窗 */
      if (autoModal && !stored) {
        setTimeout(function () { I18N.showModal(); }, 350);
      }
    },
  };

  global.JebiI18N = I18N;

  /* 供 Node 覆盖率检查器使用 */
  if (typeof module !== 'undefined' && module.exports) module.exports = I18N;
})(typeof window !== 'undefined' ? window : globalThis);