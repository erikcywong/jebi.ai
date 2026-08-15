/* Jebi Brain API 客户端
   同源部署时自动使用当前源；file:// 打开时回退到 127.0.0.1:8000。
   错误统一为 { code, message, status }，前端按 code 映射本地化文案。
*/
(function () {
  var API_BASE = (location.protocol === 'file:') ? 'http://127.0.0.1:8000' : location.origin;

  function ApiError(code, message, status) {
    var e = new Error(message || code);
    e.code = code;
    e.status = status;
    return e;
  }

  async function request(path, options) {
    var res;
    try {
      res = await fetch(API_BASE + path, options);
    } catch (e) {
      throw ApiError('NETWORK', 'network error');
    }
    var body = null;
    try { body = await res.json(); } catch (e) { body = null; }
    if (!res.ok) {
      var code = 'HTTP';
      var msg = 'HTTP ' + res.status;
      if (body && body.detail) {
        if (typeof body.detail === 'string') {
          msg = body.detail;
        } else {
          code = body.detail.code || code;
          msg = body.detail.message || JSON.stringify(body.detail);
        }
      }
      throw ApiError(code, msg, res.status);
    }
    return body;
  }

  function headers(opts) {
    var h = { 'Content-Type': 'application/json' };
    if (opts && opts.role) h['X-Jebi-Role'] = opts.role;
    if (opts && opts.userId) h['X-Jebi-User'] = opts.userId;
    return h;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  window.JebiApi = {
    base: API_BASE,
    escapeHtml: esc,
    health: function () { return request('/healthz'); },
    topup: function (userId, amountJbp, role) {
      return request('/api/v1/users/' + encodeURIComponent(userId) + '/topup', {
        method: 'POST', headers: headers({ role: role, userId: userId }),
        body: JSON.stringify({ user_id: userId, amount_jbp: amountJbp, reason: 'recharge' })
      });
    },
    balance: function (userId, role) {
      return request('/api/v1/users/' + encodeURIComponent(userId) + '/balance', { headers: headers({ role: role, userId: userId }) });
    },
    refund: function (userId) {
      return request('/api/v1/users/' + encodeURIComponent(userId) + '/refund', { method: 'POST', headers: headers({ userId: userId }) });
    },
    subscribe: function (userId, active, role) {
      return request('/api/v1/users/' + encodeURIComponent(userId) + '/subscribe', {
        method: 'POST', headers: headers({ role: role, userId: userId }),
        body: JSON.stringify({ active: !!active })
      });
    },
    quote: function (payload, role) {
      return request('/api/v1/billing/quote', { method: 'POST', headers: headers({ role: role }), body: JSON.stringify(payload) });
    },
    recommend: function (payload, role, userId) {
      return request('/api/v1/recommend/personalized', {
        method: 'POST', headers: headers({ role: role, userId: userId }), body: JSON.stringify(payload)
      });
    },
    summary: function () { return request('/api/v1/admin/usage/summary'); },
  };
})();
