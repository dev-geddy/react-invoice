import {put, call, takeLatest} from 'redux-saga/effects'
import actions, {types} from './actions'
// import api from '../../utils/api';

/*
  TODO
  First function name (i.e. setMessage): getStoredInvoices
  First action name (i.e. SET_MESSAGE): GET_STORED_INVOICES
  First action payload param (i.e. guid): query
*/

export const getStoredInvoices = function *({payload: {}}) {

  try {
    const invoices = JSON.parse(localStorage.getItem('invoicesHistory'))

    yield put(actions.setInvoices(invoices))
  } catch (error) {
    yield put(actions.setError(`${error?.status} ${error?.message}`))
  } finally {

  }
}

export const getStoredInvoice = function *({payload: {invoiceId}}) {
  try {
    const invoices = JSON.parse(localStorage.getItem('invoicesHistory'))

    const invoice = invoices.find((invoice, index) => (Number(invoice.id) === Number(invoiceId) || Number(invoiceId) === index))

    yield put(actions.setInvoice(invoice))
  } catch (error) {
    yield put(actions.setError(`${error?.status} ${error?.message}`))
  } finally {

  }
}

export default [
  takeLatest(types.GET_STORED_INVOICES, getStoredInvoices),
  takeLatest(types.GET_STORED_INVOICE, getStoredInvoice),
]
