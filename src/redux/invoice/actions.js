import actionTypes from '../../decorators/actionTypes'

export const types = actionTypes('invoice')({
  UPDATE_INVOICE_SECTION: 'UPDATE_INVOICE_SECTION',
  UPDATE_INVOICE_ENTRY: 'UPDATE_INVOICE_ENTRY',
  ADD_INVOICE_ENTRY: 'ADD_INVOICE_ENTRY',
  REMOVE_INVOICE_ENTRY: 'REMOVE_INVOICE_ENTRY',
  GET_STORED_INVOICES: 'GET_STORED_INVOICES',
  GET_STORED_INVOICE: 'GET_STORED_INVOICE',
  GET_ACTIVE_INVOICE: 'GET_ACTIVE_INVOICE',
  SET_INVOICE: 'SET_INVOICE',
  SET_INVOICES: 'SET_INVOICES',
  STORE_NEW_INVOICE: 'STORE_NEW_INVOICE',
  START_NEW_INVOICE: 'START_NEW_INVOICE',
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  LOCK_INVOICE: 'LOCK_INVOICE',
  DELETE_INVOICE: 'DELETE_INVOICE',
})

export const invoiceActions = {
  updateInvoiceSection: (section, sectionData) => ({type: types.UPDATE_INVOICE_SECTION, payload: {section, sectionData}}),
  updateInvoiceEntry: (entryIndex, entryData) => ({type: types.UPDATE_INVOICE_ENTRY, payload: {entryIndex, entryData}}),
  removeInvoiceEntry: (entryIndex) => ({type: types.REMOVE_INVOICE_ENTRY, payload: {entryIndex}}),
  addInvoiceEntry: (entryData) => ({type: types.ADD_INVOICE_ENTRY, payload: {entryData}}),
  lockInvoice: (uuid) => ({type: types.LOCK_INVOICE, payload: {uuid}}),
  deleteInvoice: (uuid) => ({type: types.DELETE_INVOICE, payload: {uuid}}),

  getInvoices: () => ({
    type: types.GET_STORED_INVOICES,
    payload: {
    }
  }),
  getInvoice: (invoiceId) => ({
    type: types.GET_STORED_INVOICE,
    payload: {
      invoiceId
    }
  }),
  getActiveInvoice: (invoiceId) => ({
    type: types.GET_ACTIVE_INVOICE,
    payload: {
      invoiceId
    }
  }),
  setInvoice: (invoice) => ({
    type: types.SET_INVOICE,
    payload: {
      invoice
    }
  }),
  storeNewInvoice: (invoice) => ({
    type: types.STORE_NEW_INVOICE,
    payload: {
      invoice
    }
  }),
  setInvoices: (invoices) => ({
    type: types.SET_INVOICES,
    payload: {
      invoices
    }
  }),
  startNewInvoice: () => ({
    type: types.START_NEW_INVOICE,
    payload: {
    }
  }),
  setLoading: (isLoading) => ({
    type: types.SET_LOADING,
    payload: {
      isLoading
    }
  }),
  setError: (error) => ({
    type: types.SET_ERROR,
    payload: {
      error
    }
  }),
}

export default invoiceActions