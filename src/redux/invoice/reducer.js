import {types} from './actions'
/*
  TODO:
  Reducer name (i.e. setProject): setInvoice
  Payload variable name(s) (i.e. project, id, status): invoice
*/

const defaultState = {}

export const selectors = {
  state: (state) => state.invoice,
  isLoading: (state) => selectors.state(state).isLoading
}

const setInvoice = (state, {invoice}) => ({
  ...state,
  invoice
})

const setInvoices = (state, {invoices}) => ({
  ...state,
  invoices
})

export default (state = defaultState, {type, payload}) => {
  switch (type) {
    case types.SET_INVOICES: return setInvoices(state, payload)
    case types.SET_INVOICE: return setInvoice(state, payload)
    default: return state
  }
}
