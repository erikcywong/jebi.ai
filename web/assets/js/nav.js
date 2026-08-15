/* 顶栏：移动端菜单 + 触控下拉 + 滚动显现 + 页脚年份 + i18n 初始化 */
(function () {
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () { nav.classList.toggle('open'); });
  }

  /* 下拉：桌面 hover（CSS），触屏点击展开；点击外部收起 */
  document.querySelectorAll('.nav-item').forEach(function (item) {
    var link = item.querySelector('.nav-link');
    if (!link) return;
    link.addEventListener('click', function (e) {
      var dd = item.querySelector('.dropdown');
      if (dd && window.innerWidth < 641) {
        e.preventDefault();
        item.classList.toggle('open');
      }
    });
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.nav-item')) {
      document.querySelectorAll('.nav-item.open').forEach(function (i) { i.classList.remove('open'); });
    }
  });

  /* 滚动显现 */
  var items = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && items.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.1 });
    items.forEach(function (el) { io.observe(el); });
  } else {
    items.forEach(function (el) { el.classList.add('in'); });
  }

  var yr = document.getElementById('year');
  if (yr) yr.textContent = String(new Date().getFullYear());

  /* 复制按钮（微信等） */
  document.querySelectorAll('[data-copy]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      var text = el.getAttribute('data-copy');
      var orig = el.textContent;
      var done = function () {
        var label = (window.JebiI18N ? window.JebiI18N.t('contact.copied') : 'Copied!');
        el.textContent = label;
        setTimeout(function () { el.textContent = orig; }, 1500);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, done);
      } else {
        var ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (err) {}
        document.body.removeChild(ta);
        done();
      }
    });
  });

  /* 页脚语言切换 */
  document.querySelectorAll('[data-lang-link]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      if (window.JebiI18N) window.JebiI18N.apply(btn.getAttribute('data-lang-link'));
    });
  });

  /* i18n 初始化（脚本位于 body 末尾，DOM 已就绪） */
  if (window.JebiI18N) {
    var auto = document.body && document.body.getAttribute('data-automodal') === '1';
    window.JebiI18N.init(auto);
  }
})();