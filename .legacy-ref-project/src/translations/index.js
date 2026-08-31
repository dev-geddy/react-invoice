import {labels as en} from './en-UK'
import {labels as lt} from './lt-LT'

const translations = {
  en,
  lt,
}

export const getActiveLang = () => {
  const urlSearchParams = new URLSearchParams(window.location.search);
  const {lang} = Object.fromEntries(urlSearchParams.entries());

  return ['en', 'lt'].includes(String(lang).toLowerCase()) ? String(lang).toLowerCase() : 'en'
}

export const loadTranslations = (setToLang = activeLang) => {
  if (translations[setToLang]) {
    return translations[setToLang]
  }
  console.error(`Translations for "${setToLang}" not found. ${activeLang} will remain the active language.`)
}


// export const setActiveLang = (lang) => {
//   if (translations[lang]) {
//     activeLang = lang
//   } else {
//     console.error(`Translations for "${lang}" not found. "${activeLang}" will remain the active language.`)
//   }
//
// }

// export const t = (key) => {
//   return labels[key] ? labels[key] : '•translation missing•'
// }

export default loadTranslations(getActiveLang())