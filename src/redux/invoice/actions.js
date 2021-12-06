import actionTypes from '../../decorators/actionTypes'

/*
  @TODO
  Scope name for actions (i.e. app): invoice
  Actions name (i.e. appActions): invoiceActions
*/

export const types = actionTypes('invoice')({
  GET_STORED_INVOICES: 'GET_STORED_INVOICES',
  GET_STORED_INVOICE: 'GET_STORED_INVOICE',
  SET_INVOICE: 'SET_INVOICE',
  SET_INVOICES: 'SET_INVOICES',
  SAVE_INVOICE: 'SAVE_INVOICE',
  START_NEW_INVOICE: 'START_NEW_INVOICE',
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
})

export const invoiceActions = {
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
  setInvoice: (invoice) => ({
    type: types.SET_INVOICE,
    payload: {
      invoice
    }
  }),
  saveInvoice: (invoice) => ({
    type: types.SAVE_INVOICE,
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