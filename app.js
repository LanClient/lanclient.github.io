// LanClient — lanclient.ru
(function () {
  'use strict';

  // Год в подвале
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Тень у навигации при скролле
  var nav = document.getElementById('nav');
  function onScroll() {
    if (!nav) return;
    nav.classList.toggle('scrolled', window.scrollY > 8);
  }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // Мобильное меню
  var burger = document.getElementById('burger');
  var links = document.getElementById('navLinks');
  if (burger && links) {
    burger.addEventListener('click', function () {
      links.classList.toggle('open');
    });
    links.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { links.classList.remove('open'); });
    });
  }

  // Плавное появление блоков
  var items = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    items.forEach(function (el) { io.observe(el); });
  } else {
    items.forEach(function (el) { el.classList.add('in'); });
  }

  // --- Автоопределение системы: Windows -> .exe, Android -> .apk ---
  var ua = navigator.userAgent || '';
  var pf = navigator.platform || '';
  var isAndroid = /android/i.test(ua) || /android/i.test(pf);
  var isWindows = /win/i.test(pf) || /windows/i.test(ua);

  document.querySelectorAll('.js-download').forEach(function (a) {
    var url = isAndroid ? a.getAttribute('data-apk') : a.getAttribute('data-exe');
    if (url) a.setAttribute('href', url);
    var text = a.querySelector('.dl-text');
    if (text) {
      var t = isAndroid ? a.getAttribute('data-text-android') : a.getAttribute('data-text-win');
      if (t) text.textContent = t;
    }
  });

  var note = document.getElementById('dl-note');
  var heroOs = document.getElementById('hero-os');
  var heroSize = document.getElementById('hero-size');
  if (isAndroid) {
    if (note) note.textContent = 'Версия 1.2 · Android 7.0+ · ~17 МБ (APK)';
    if (heroOs) heroOs.textContent = 'Android 7.0+';
    if (heroSize) heroSize.textContent = '~17 МБ';
  } else if (!isWindows) {
    if (note) note.textContent = 'Версия 1.2 · Windows 10/11 (.exe) или Android (.apk)';
  }

  // --- Скачивание только после входа/регистрации ---
  var AUTH = window.LanClientAuth;

  function isLocked() {
    return !!(AUTH && AUTH.configured && !AUTH.loggedIn);
  }

  function renderGate() {
    var locked = isLocked();
    document.querySelectorAll('.js-gate').forEach(function (a) {
      a.classList.toggle('locked', locked);
      if (locked) a.setAttribute('aria-disabled', 'true');
      else a.removeAttribute('aria-disabled');
    });
    var lockNote = document.getElementById('dlLock');
    if (lockNote) lockNote.hidden = !locked;
  }

  // Перехватываем клик до перехода по ссылке
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('.js-gate') : null;
    if (!a) return;
    if (!isLocked()) return;
    e.preventDefault();
    e.stopPropagation();
    if (AUTH && AUTH.openModal) AUTH.openModal('download');
  }, true);

  if (AUTH) AUTH.onChange = renderGate;
  renderGate();
})();
