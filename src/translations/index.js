import {labels as en} from './en-UK'
import {labels as lt} from './lt-LT'

const urlSearchParams = new URLSearchParams(window.location.search);
const params = Object.fromEntries(urlSearchParams.entries());

console.log(params.lang)

const translations = {
  en,
  lt,
}

let activeLang = ['en', 'lt'].includes(String(params.lang).toLowerCase()) ? String(params.lang).toLowerCase() : 'en'
// let labels = loadTranslations()

export const loadTranslations = (setToLang = activeLang) => {
  if (translations[setToLang]) {
    return translations[setToLang]
  }
  console.error(`Translations for "${setToLang}" not found. ${activeLang} will remain the active language.`)
}

export const setActiveLang = (lang) => {
  if (translations[lang]) {
    activeLang = lang
  } else {
    console.error(`Translations for "${lang}" not found. "${activeLang}" will remain the active language.`)
  }

}

// export const t = (key) => {
//   return labels[key] ? labels[key] : '•translation missing•'
// }

export default loadTranslations()