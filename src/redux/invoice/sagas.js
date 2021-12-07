import {put, call, takeLatest} from 'redux-saga/effects'
import { v4 as uuidv4 } from 'uuid'
import actions, {types} from './actions'
// import api from '../../utils/api';

/*
  TODO
  First function name (i.e. setMessage): getStoredInvoices
  First action name (i.e. SET_MESSAGE): GET_STORED_INVOICES
  First action payload param (i.e. guid): query
*/

export const updateInvoiceSection = function *({payload: {section, sectionData}}) {

}

export const updateInvoiceEntry = function *({payload: {entryIndex, entryData}}) {

}

export const addInvoiceEntry = function *({payload: {entryData}}) {

}

export const removeInvoiceEntry = function *({payload: {entryIndex}}) {

}

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
    const invoice = invoices.find((invoice, index) => (String(invoice.uuid) === String(invoiceId) || Number(invoiceId) === index))

    yield put(actions.setInvoice(invoice))
  } catch (error) {
    yield put(actions.setError(`${error?.status} ${error?.message}`))
  } finally {

  }
}

export const lockInvoice = function *({payload: {uuid}}) {
  try {
    const invoices = JSON.parse(localStorage.getItem('invoicesHistory'))
    const invoiceIndex = invoices.findIndex((invoice, index) => (String(invoice.uuid) === String(uuid)))
    invoices[invoiceIndex].invoiceMeta.locked = true

    console.log('lockInvoice', invoiceIndex, uuid)

    localStorage.setItem('invoicesHistory', JSON.stringify(invoices))
    yield put(actions.setInvoices(invoices))

  } catch (error) {
    yield put(actions.setError(`${error?.status} ${error?.message}`))
  } finally {

  }
}

export const deleteInvoice = function *({payload: {uuid}}) {
  try {
    const invoices = JSON.parse(localStorage.getItem('invoicesHistory'))
    const invoiceIndex = invoices.findIndex((invoice, index) => (String(invoice.uuid) === String(uuid)))
    invoices.splice(invoiceIndex, 1)

    localStorage.setItem('invoicesHistory', JSON.stringify(invoices))
    yield put(actions.setInvoices(invoices))

  } catch (error) {
    yield put(actions.setError(`${error?.status} ${error?.message}`))
  } finally {

  }
}

export const storeNewInvoice = function *({payload: {invoice}}) {
  try {
    const invoices = localStorage.getItem('invoicesHistory') ? JSON.parse(localStorage.getItem('invoicesHistory')) : []

    if (invoice.uuid) {
      const invoiceIndex = invoices.findIndex((item, index) => (String(invoice.uuid) === String(item.uuid)))
      invoices[invoiceIndex] = {...invoice}
    } else {
      // generate ID for this new invoice
      const uniqueInvoice = {
        ...invoice,
        uuid: uuidv4()
      }

      invoices.push(uniqueInvoice)
    }

    localStorage.setItem('invoicesHistory', JSON.stringify(invoices))

    yield put(actions.setInvoices(invoices))
    yield put(actions.setInvoice(uniqueInvoice))
  } catch (error) {
    yield put(actions.setError(`${error?.status} ${error?.message}`))
  } finally {

  }
}

export default [
  takeLatest(types.GET_STORED_INVOICES, getStoredInvoices),
  takeLatest(types.GET_STORED_INVOICE, getStoredInvoice),
  takeLatest(types.STORE_NEW_INVOICE, storeNewInvoice),
  takeLatest(types.UPDATE_INVOICE_SECTION, updateInvoiceSection),
  takeLatest(types.UPDATE_INVOICE_ENTRY, updateInvoiceEntry),
  takeLatest(types.ADD_INVOICE_ENTRY, addInvoiceEntry),
  takeLatest(types.REMOVE_INVOICE_ENTRY, removeInvoiceEntry),
  takeLatest(types.LOCK_INVOICE, lockInvoice),
  takeLatest(types.DELETE_INVOICE, deleteInvoice),
]
