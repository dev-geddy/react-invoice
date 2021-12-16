import {types} from './actions'
import invoiceConfig from '../../invoiceConfig'
import {getActiveLang} from '../../translations'

const date = new Date()
const day = date.getDate()
const month = date.getMonth()
const year = date.getFullYear()
const today = `${day}/${month}/${year}`
const defaultInvoiceState = {
  uuid: '',
  lang: getActiveLang() || 'en',
  provider: {
    companyName: invoiceConfig.provider.companyName,
    name: invoiceConfig.provider.name,
    role: invoiceConfig.provider.role,
    addressLine1: invoiceConfig.provider.addressLine1,
    addressLine2: invoiceConfig.provider.addressLine2,
    addressLine3: invoiceConfig.provider.addressLine3,
    addressLine4: invoiceConfig.provider.addressLine4,
    companyRegNo: invoiceConfig.provider.companyRegNo,
    companyVatNo: invoiceConfig.provider.companyVatNo,
    billingBankAccountIban: invoiceConfig.provider.billingBankAccountIban,
    billingBankAccountBic: invoiceConfig.provider.billingBankAccountBic,
    billingBankAccountNo: invoiceConfig.provider.billingBankAccountNo,
    billingBankAccountSortCode: invoiceConfig.provider.billingBankAccountSortCode,
  },
  customer: {
    companyName: '',
    name: '',
    role: '',
    addressLine1: '',
    addressLine2: '',
    addressLine3: '',
    addressLine4: '',
    companyRegNo: '',
    companyVatNo: '',
    billingBankAccountIban: '',
    billingBankAccountBic: '',
    billingBankAccountNo: '',
    billingBankAccountSortCode: '',
    // ...invoiceConfig.customer
  },
  invoiceMeta: {
    invoiceDate: today || '',
    invoiceSeries: invoiceConfig.invoiceMeta.invoiceSeries || '',
    invoiceNo: 0,
    currency: invoiceConfig.invoiceMeta.currency,
    brandName: invoiceConfig.invoiceMeta.brandName,
    brandSubName: invoiceConfig.invoiceMeta.brandSubName,
    vatRate: invoiceConfig.invoiceMeta.vatRate,
    locked: false
  },
  invoiceEntries: [
    {
      dateProvided: today || '',
      description: '',
      qty: '1',
      qtyType: 'days',
      rate: '0',
      total: '0',
    }
  ],
}
const defaultState = {
  invoice: {},
  invoices: [],
  isLoading: false,
  displaySection: {
    provider: true,
    customer: true,
  },
  ...defaultInvoiceState
}

export const selectors = {
  state: (state) => state.invoice,
  isLoading: (state) => selectors.state(state).isLoading,
  error: (state) => selectors.state(state).error,
  invoiceEntries: (state) => selectors.state(state).invoiceEntries,
  displaySection: (state) => selectors.state(state).displaySection,
  invoiceMeta: (state) => selectors.state(state).invoiceMeta,
  provider: (state) => selectors.state(state).provider,
  customer: (state) => selectors.state(state).customer,
  uuid: (state) => selectors.state(state).uuid,
  invoice: (state) => ({
    invoiceEntries: selectors.state(state).invoiceEntries,
    invoiceMeta: selectors.state(state).invoiceMeta,
    provider: selectors.state(state).provider,
    customer: selectors.state(state).customer,
  }),
  invoices: (state) => selectors.state(state).invoices,
}

const setInvoice = (state, {invoice}) => ({
  ...state,
  ...invoice, // rewrite the state values
})

const setLoading = (state, {isLoading}) => ({
  ...state,
  isLoading
})

const displaySectionSwitch = (state, {section, display}) => ({
  ...state,
  displaySection: {
    ...state.displaySection,
    [section]: display !== undefined ? display : !state.displaySection[section]
  }
})

const setInvoices = (state, {invoices}) => ({
  ...state,
  invoices
})

const lockInvoice = (state, {uuid}) => ({
  ...state,
  invoiceMeta: {
    ...state.invoiceMeta,
    locked: !state.invoiceMeta.locked
  }
})

const updateInvoiceSection = (state, {section, sectionData}) => ({
  ...state,
  [section]: {
    ...state[section],
    ...sectionData
  }
})

const updateInvoiceEntry = (state, {entryIndex, entryData}) => {
  const updatedEntries = [
    ...state.invoiceEntries,
  ]

  updatedEntries[entryIndex] = {...entryData}

  return {
    ...state,
    invoiceEntries: [
      ...updatedEntries
    ]
  }
}

const removeInvoiceEntry = (state, {entryIndex}) => {
  const invoiceEntries = [...state.invoiceEntries]

  invoiceEntries.splice(entryIndex, 1)

  return {
    ...state,
    invoiceEntries
  }
}

const addInvoiceEntry = (state, {entryData}) => ({
  ...state,
  invoiceEntries: [
    ...state.invoiceEntries,
    {...entryData}
  ]
})

const startNewInvoice = (state, {}) => ({
  ...state,
  ...defaultInvoiceState
})

export default (state = defaultState, {type, payload}) => {
  switch (type) {
    case types.SET_LOADING: return setLoading(state, payload)
    case types.SET_INVOICES: return setInvoices(state, payload)
    case types.SET_INVOICE: return setInvoice(state, payload)
    case types.UPDATE_INVOICE_SECTION: return updateInvoiceSection(state, payload)
    case types.UPDATE_INVOICE_ENTRY: return updateInvoiceEntry(state, payload)
    case types.REMOVE_INVOICE_ENTRY: return removeInvoiceEntry(state, payload)
    case types.ADD_INVOICE_ENTRY: return addInvoiceEntry(state, payload)
    case types.LOCK_INVOICE: return lockInvoice(state, payload)
    case types.START_NEW_INVOICE: return startNewInvoice(state, payload)
    case types.DISPLAY_SECTION_SWITCH: return displaySectionSwitch(state, payload)
    default: return state
  }
}
