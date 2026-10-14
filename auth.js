// LanClient — авторизация (Firebase Auth): вход/регистрация, Google, ник.
(function () {
  'use strict';

  var cfg = window.LANCLIENT_FIREBASE_CONFIG || {};
  function placeholder(v) { return !v || String(v).indexOf('PASTE') === 0; }
  var configured = !(placeholder(cfg.apiKey) || placeholder(cfg.projectId)) && !!window.firebase;

  var modal      = document.getElementById('authModal');
  var openBtn    = document.getElementById('authOpen');
  var msgEl      = document.getElementById('authMsg');
  var userChip   = document.getElementById('userChip');
  var userNameEl = document.getElementById('userName');
  var userAvatar = document.getElementById('userAvatar');
  var logoutBtn  = document.getElementById('authLogout');
  var profileBtn = document.getElementById('profileBtn');
  var profileModalEl = document.getElementById('profileModal');
  var nickModal  = document.getElementById('nickModal');
  var nickBtn    = document.getElementById('nickChange');
  var nickInput  = document.getElementById('nickInput');
  var nickSave   = document.getElementById('nickSave');
  var nickMsgEl  = document.getElementById('nickMsg');
  var deviceHwid = document.getElementById('deviceHwid');
  var premiumStatus = document.getElementById('premiumStatus');
  var premiumBuy = document.getElementById('premiumBuy');
  var premiumHint = document.getElementById('premiumHint');
  var RTDB_CONFIG = null;

  // Адрес Realtime Database проекта lanclient-26e2d (публичный, защита — правилами).
  var RTDB_BASE = 'https://lanclient-26e2d-default-rtdb.firebaseio.com';

  var auth = null;

  window.LanClientAuth = {
    configured: configured,
    loggedIn: false,
    user: null,
    openModal: null,
    onChange: null
  };

  function $(id) { return document.getElementById(id); }
  function val(id) { var el = $(id); return el ? el.value.trim() : ''; }

  function showMsg(text, kind) {
    if (!msgEl) return;
    msgEl.textContent = text || '';
    msgEl.className = 'auth-msg' + (kind ? ' ' + kind : '');
  }

  function openModal(reason) {
    if (!modal) return;
    modal.hidden = false;
    document.body.classList.add('modal-open');
    if (!configured) { showMsg('Авторизация пока не настроена — скоро включим.'); return; }
    if (reason === 'download') showMsg('Чтобы скачать LanClient, войдите или зарегистрируйтесь — это быстро.', 'ok');
    else showMsg('');
  }
  function closeModal() {
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove('modal-open');
    showMsg('');
  }

  function openProfile() {
    if (!profileModalEl) return;
    profileModalEl.hidden = false;
    document.body.classList.add('modal-open');
    var u = auth && auth.currentUser ? auth.currentUser : null;
    renderProfile(u);
  }
  function closeProfile() {
    if (!profileModalEl) return;
    profileModalEl.hidden = true;
    document.body.classList.remove('modal-open');
  }
  async function renderProfile(u) {
    try {
      var pUid = $('pUid'), pHwid=$('pHwid'), pHwidState=$('pHwidState'), pPrem=$('pPrem'), pPremInfo=$('pPremInfo');
      if (u) {
        if (pUid) pUid.textContent = u.uid;
        if (pHwid) pHwid.textContent = 'Загружаю…';
        if (pHwidState) pHwidState.textContent = '';
        if (pPrem) pPrem.textContent = 'Проверяю…';
        if (pPremInfo) pPremInfo.textContent = '';
        var token = await u.getIdToken();
        try {
          var r = await fetch(RTDB_BASE + '/users/' + u.uid + '.json?auth=' + encodeURIComponent(token));
          var ud = r && r.ok ? await r.json() : null;
          var hw = ud && ud.hwid ? String(ud.hwid) : '';
          if (pHwid) pHwid.textContent = hw || 'ещё не привязано — запустите лаунчер на устройстве';
          if (pHwidState) pHwidState.textContent = hw ? 'Привязано' : '';
        } catch(e) { if (pHwid) pHwid.textContent = 'не удалось получить'; }
        try {
          var cfgp = await loadConfig();
          var bot = cfgp && cfgp.bot ? cfgp.bot : 'LanClient0_bot';
          if (cfgp && cfgp.paywall === true) {
            if (pPremInfo) pPremInfo.textContent = cfgp.price ? ('Цена: ' + cfgp.price + ' звёзд') : '';
            var rp = await fetch(RTDB_BASE + '/premium/' + u.uid + '.json?auth=' + encodeURIComponent(token));
            var pd = rp && rp.ok ? await rp.json() : null;
            var until = pd && typeof pd.until !== 'undefined' ? Number(pd.until) : NaN;
            var act = !!pd && (until === 0 || until > Math.floor(Date.now()/1000));
            if (pPrem) pPrem.textContent = act ? 'Активен ✓' : 'Не оформлен';
          } else {
            if (pPrem) pPrem.textContent = 'Клиент бесплатный';
            if (pPremInfo) pPremInfo.textContent = 'Платный режим выключен';
          }
        } catch(e) { if (pPrem) pPrem.textContent = 'не удалось проверить'; }
      } else {
        if (pUid) pUid.textContent = '—';
        if (pHwid) pHwid.textContent = '—';
        if (pHwidState) pHwidState.textContent = '';
        if (pPrem) pPrem.textContent = '—';
        if (pPremInfo) pPremInfo.textContent = '';
      }
    } catch(e) {}
  }
  function loadConfig() {
    if (window.__RTDB_CFG) return Promise.resolve(window.__RTDB_CFG);
    return fetch(RTDB_BASE + '/config.json').then(r=>r&&r.ok?r.json():null).then(c=>{window.__RTDB_CFG=c||{};return window.__RTDB_CFG}).catch(()=>{window.__RTDB_CFG={};return {}});
  }

  function switchTab(name) {
    Array.prototype.forEach.call(document.querySelectorAll('.auth-tab'), function (t) {
      t.classList.toggle('active', t.getAttribute('data-tab') === name);
    });
    Array.prototype.forEach.call(document.querySelectorAll('.auth-pane'), function (p) {
      p.hidden = p.getAttribute('data-pane') !== name;
    });
    showMsg('');
  }

  function ruError(e) {
    var c = (e && e.code) || '';
    var map = {
      'auth/invalid-email': 'Некорректный email.',
      'auth/missing-email': 'Введите email.',
      'auth/user-disabled': 'Аккаунт заблокирован.',
      'auth/user-not-found': 'Пользователь с таким email не найден.',
      'auth/wrong-password': 'Неверный пароль.',
      'auth/invalid-credential': 'Неверный email или пароль.',
      'auth/invalid-login-credentials': 'Неверный email или пароль.',
      'auth/email-already-in-use': 'Этот email уже зарегистрирован.',
      'auth/weak-password': 'Пароль слишком короткий (минимум 6 символов).',
      'auth/popup-closed-by-user': 'Окно входа Google было закрыто.',
      'auth/cancelled-popup-request': 'Запрос Google отменён.',
      'auth/popup-blocked': 'Браузер заблокировал окно Google. Разрешите всплывающие окна.',
      'auth/network-request-failed': 'Нет связи с сервером. Проверьте интернет.',
      'auth/too-many-requests': 'Слишком много попыток. Попробуйте позже.',
      'auth/unauthorized-domain': 'Домен не добавлен в Firebase (Authentication -> Settings -> Authorized domains).',
      'auth/operation-not-allowed': 'Этот способ входа не включён в Firebase.',
      'auth/redirect-cancelled-by-user': 'Вход через Google отменён.'
    };
    return map[c] || ('Ошибка: ' + ((e && e.message) || 'неизвестная'));
  }

  function validNick(n) { return /^[A-Za-z0-9_]{3,16}$/.test(n); }
  function validEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

  function renderUser(user) {
    if (openBtn) openBtn.hidden = !!user;
    if (userChip) userChip.hidden = !user;
    if (userNameEl) userNameEl.textContent = user ? (user.displayName || (user.email || '').split('@')[0]) : '';
    if (userAvatar) {
      if (user && user.photoURL) { userAvatar.src = user.photoURL; userAvatar.hidden = false; }
      else { userAvatar.removeAttribute('src'); userAvatar.hidden = true; }
    }
    window.LanClientAuth.loggedIn = !!user;
    window.LanClientAuth.user = user || null;
    if (typeof window.LanClientAuth.onChange === 'function') window.LanClientAuth.onChange();
  }

  function needConfig() {
    if (!configured) { showMsg('Авторизация пока не настроена — скоро включим.'); return true; }
    return false;
  }

  function doRegister() {
    if (needConfig()) return;
    var nick = val('regNick'), email = val('regEmail'), pass = $('regPass') ? $('regPass').value : '';
    if (!validNick(nick)) return showMsg('Ник: 3–16 символов, латиница, цифры и «_».', 'err');
    if (!validEmail(email)) return showMsg('Введите корректный email.', 'err');
    if (pass.length < 6) return showMsg('Пароль: минимум 6 символов.', 'err');
    showMsg('Создаю аккаунт…');
    auth.createUserWithEmailAndPassword(email, pass)
      .then(function (cred) { return cred.user.updateProfile({ displayName: nick }); })
      .then(function () { return auth.currentUser.reload(); })
      .then(function () {
        renderUser(auth.currentUser);
        showMsg('Аккаунт создан! Добро пожаловать, ' + nick, 'ok');
      })
      .catch(function (e) { showMsg(ruError(e), 'err'); });
  }

  function doLogin() {
    if (needConfig()) return;
    var email = val('loginEmail'), pass = $('loginPass') ? $('loginPass').value : '';
    if (!validEmail(email)) return showMsg('Введите корректный email.', 'err');
    if (!pass) return showMsg('Введите пароль.', 'err');
    showMsg('Вхожу…');
    auth.signInWithEmailAndPassword(email, pass)
      .then(function () { showMsg('Вы вошли!', 'ok'); })
      .catch(function (e) { showMsg(ruError(e), 'err'); });
  }

  function doForgot() {
    if (needConfig()) return;
    var email = val('loginEmail');
    if (!validEmail(email)) return showMsg('Введите email, и мы пришлём ссылку для сброса.', 'err');
    auth.sendPasswordResetEmail(email)
      .then(function () { showMsg('Ссылка для сброса пароля отправлена на ' + email, 'ok'); })
      .catch(function (e) { showMsg(ruError(e), 'err'); });
  }

  function doGoogle() {
    if (needConfig()) return;
    var provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    showMsg('Открываю Google…');
    auth.signInWithPopup(provider)
      .then(function () { showMsg('Вы вошли через Google!', 'ok'); })
      .catch(function (e) {
        if (e && e.code === 'auth/popup-blocked') {
          auth.signInWithRedirect(provider).catch(function (e2) { showMsg(ruError(e2), 'err'); });
          return;
        }
        showMsg(ruError(e), 'err');
      });
  }

  function doLogout() {
    if (!auth) { renderUser(null); return; }
    auth.signOut().then(function () { showMsg('Вы вышли.', 'ok'); }).catch(function (e) { showMsg(ruError(e), 'err'); });
  }

  // --- ник задаётся и меняется только на сайте ---
  function nickMsg(text, kind) {
    if (!nickMsgEl) return;
    nickMsgEl.textContent = text || '';
    nickMsgEl.className = 'auth-msg' + (kind ? ' ' + kind : '');
  }

  function openNickModal() {
    var u = auth && auth.currentUser;
    if (!u) { openModal(); return; }
    if (!nickModal) return;
    if (nickInput) nickInput.value = u.displayName || (u.email || '').split('@')[0];
    nickMsg('');
    nickModal.hidden = false;
    document.body.classList.add('modal-open');
    loadDevice(u);
    loadPremium(u);
    if (nickInput) { try { nickInput.focus(); } catch (e) {} }
  }

  function closeNickModal() {
    if (!nickModal) return;
    nickModal.hidden = true;
    document.body.classList.remove('modal-open');
    nickMsg('');
  }

  function doSaveNick() {
    if (needConfig()) return;
    var u = auth && auth.currentUser;
    if (!u) { closeNickModal(); openModal(); return; }
    var nick = nickInput ? nickInput.value.trim() : '';
    if (!validNick(nick)) return nickMsg('Ник: 3–16 символов, латиница, цифры и «_».', 'err');
    if (nick === (u.displayName || '')) return nickMsg('Это ваш текущий ник.', 'ok');
    nickMsg('Сохраняю…');
    u.updateProfile({ displayName: nick })
      .then(function () { return u.reload(); })
      .then(function () {
        renderUser(auth.currentUser);
        nickMsg('Ник сохранён: ' + nick, 'ok');
      })
      .catch(function (e) { nickMsg(ruError(e), 'err'); });
  }

  // --- устройство (привязка HWID), только просмотр ---
  function loadDevice(user) {
    if (!deviceHwid) return;
    if (!user) {
      deviceHwid.textContent = '—';
      deviceHwid.className = 'device-hwid pending';
      return;
    }

    deviceHwid.textContent = 'Загружаю…';
    deviceHwid.className = 'device-hwid pending';

    user.getIdToken()
      .then(function (token) {
        return fetch(RTDB_BASE + '/users/' + user.uid + '.json?auth=' + encodeURIComponent(token));
      })
      .then(function (r) { return r && r.ok ? r.json() : null; })
      .then(function (data) {
        var hwid = data && data.hwid ? String(data.hwid) : '';
        if (hwid) {
          deviceHwid.textContent = hwid;
          deviceHwid.className = 'device-hwid';
        } else {
          deviceHwid.textContent = 'ещё не привязано — запустите лаунчер на устройстве';
          deviceHwid.className = 'device-hwid pending';
        }
      })
      .catch(function () {
        deviceHwid.textContent = 'не удалось получить данные';
        deviceHwid.className = 'device-hwid pending';
      });
  }

  // --- доступ (платный режим: config/paywall + premium/<uid>) ---
  function loadConfig() {
    if (RTDB_CONFIG) return Promise.resolve(RTDB_CONFIG);
    return fetch(RTDB_BASE + '/config.json')
      .then(function (r) { return r && r.ok ? r.json() : null; })
      .then(function (c) { RTDB_CONFIG = c || {}; return RTDB_CONFIG; })
      .catch(function () { RTDB_CONFIG = {}; return RTDB_CONFIG; });
  }

  function loadPremium(user) {
    if (!premiumStatus) return;
    premiumBuy.style.display = 'none';
    premiumBuy.href = '#';

    if (!user) {
      premiumStatus.textContent = '—';
      premiumStatus.className = 'premium-status';
      return;
    }

    premiumStatus.textContent = 'Проверяю…';
    premiumStatus.className = 'premium-status';

    Promise.all([loadConfig(), user.getIdToken()])
      .then(function (res) {
        var cfg = res[0] || {};
        var token = res[1];
        var bot = cfg.bot || 'LanClient0_bot';

        if (cfg.paywall !== true) {
          premiumStatus.textContent = 'Клиент бесплатный';
          premiumStatus.className = 'premium-status ok';
          premiumHint.textContent = 'Платный режим выключен.';
          return null;
        }

        premiumBuy.href = 'https://t.me/' + bot + '?start=' + user.uid;
        premiumBuy.style.display = '';
        if (cfg.price) {
          premiumHint.textContent = 'Цена: ' + cfg.price + ' звёзд Telegram. Доступ активируется автоматически.';
        }

        return fetch(RTDB_BASE + '/premium/' + user.uid + '.json?auth=' + encodeURIComponent(token))
          .then(function (r) { return r && r.ok ? r.json() : null; });
      })
      .then(function (data) {
        if (data === null) return; // платный режим выключен
        var until = data && typeof data.until !== 'undefined' ? Number(data.until) : NaN;
        var active = !!data && (until === 0 || until > Math.floor(Date.now() / 1000));
        if (active) {
          premiumStatus.textContent = 'Активен ✓';
          premiumStatus.className = 'premium-status ok';
        } else {
          premiumStatus.textContent = 'Не оформлен';
          premiumStatus.className = 'premium-status none';
        }
      })
      .catch(function () {
        premiumStatus.textContent = 'не удалось проверить';
        premiumStatus.className = 'premium-status';
      });
  }

  // --- инициализация ---
  window.LanClientAuth.openModal = openModal;
  if (openBtn) openBtn.addEventListener('click', function () { openModal(); });
  if (logoutBtn) logoutBtn.addEventListener('click', doLogout);
  if (profileBtn) profileBtn.addEventListener('click', openProfile);
  var pc = $('pCopyUid');
  if (pc) pc.addEventListener('click', function(){ var v=$('pUid'); if(v&&v.textContent&&v.textContent!=='—') { try{navigator.clipboard.writeText(v.textContent); showMsg('UID скопирован','ok');}catch(e){alert(v.textContent);} } });
  Array.prototype.forEach.call(document.querySelectorAll('[data-close-profile]'), function (el) {
    el.addEventListener('click', closeProfile);
  });
  if (nickBtn) nickBtn.addEventListener('click', openNickModal);
  if (nickSave) nickSave.addEventListener('click', doSaveNick);
  if (nickInput) nickInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') doSaveNick(); });
  if (nickModal) {
    Array.prototype.forEach.call(nickModal.querySelectorAll('[data-close]'), function (el) {
      el.addEventListener('click', closeNickModal);
    });
  }
  if (modal) {
    Array.prototype.forEach.call(modal.querySelectorAll('[data-close]'), function (el) {
      el.addEventListener('click', closeModal);
    });
  }
  Array.prototype.forEach.call(document.querySelectorAll('.auth-tab'), function (t) {
    t.addEventListener('click', function () { switchTab(t.getAttribute('data-tab')); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (modal && !modal.hidden) closeModal();
    if (nickModal && !nickModal.hidden) closeNickModal();
  });

  var bLogin = $('btnLogin');     if (bLogin) bLogin.addEventListener('click', doLogin);
  var bReg   = $('btnRegister');  if (bReg) bReg.addEventListener('click', doRegister);
  var bFor   = $('btnForgot');    if (bFor) bFor.addEventListener('click', doForgot);
  var bGoo   = $('btnGoogle');    if (bGoo) bGoo.addEventListener('click', doGoogle);
  ['loginPass', 'regPass'].forEach(function (id) {
    var el = $(id);
    if (el) el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { if (id === 'loginPass') doLogin(); else doRegister(); }
    });
  });

  if (configured) {
    try {
      if (!firebase.apps.length) firebase.initializeApp(cfg);
      auth = firebase.auth();
      auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function () {});
      auth.onAuthStateChanged(function (user) { renderUser(user); if (user) closeModal(); });
      auth.getRedirectResult().catch(function () {});
    } catch (e) {
      configured = false;
      renderUser(null);
    }
  } else {
    renderUser(null);
  }
})();
