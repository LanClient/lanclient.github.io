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
  var nickModal  = document.getElementById('nickModal');
  var nickBtn    = document.getElementById('nickChange');
  var nickInput  = document.getElementById('nickInput');
  var nickSave   = document.getElementById('nickSave');
  var nickMsgEl  = document.getElementById('nickMsg');

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

  // --- инициализация ---
  window.LanClientAuth.openModal = openModal;
  if (openBtn) openBtn.addEventListener('click', function () { openModal(); });
  if (logoutBtn) logoutBtn.addEventListener('click', doLogout);
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
