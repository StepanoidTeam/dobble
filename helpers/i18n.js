const LANG_STORAGE_KEY = 'dobble_lang';
const DEFAULT_LANG = 'ru';
const SUPPORTED_LANGS = [
  { key: 'ru', label: '🇷🇺 Русский' },
  { key: 'en', label: '🇬🇧 English' },
];

let currentLang = DEFAULT_LANG;
let translations = {};

async function loadTranslations(lang) {
  const res = await fetch(`./i18n/${lang}.json`);
  return res.json();
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(($el) => {
    const key = $el.dataset.i18n;
    if (translations[key]) {
      $el.textContent = translations[key];
    }
  });
  document.documentElement.lang = currentLang;
}

export function t(key, params) {
  let text = translations[key] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, v);
    }
  }
  return text;
}

export function getLang() {
  return currentLang;
}

export function getSupportedLangs() {
  return SUPPORTED_LANGS;
}

export async function setLang(lang, onApplied) {
  if (!SUPPORTED_LANGS.find((l) => l.key === lang)) return;
  translations = await loadTranslations(lang);
  currentLang = lang;
  localStorage.setItem(LANG_STORAGE_KEY, lang);
  applyTranslations();
  if (onApplied) onApplied();
}

export async function initI18n(onApplied) {
  const saved = localStorage.getItem(LANG_STORAGE_KEY);
  const lang =
    saved && SUPPORTED_LANGS.find((l) => l.key === saved)
      ? saved
      : DEFAULT_LANG;
  await setLang(lang, onApplied);
}
