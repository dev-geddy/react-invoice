import React, {PureComponent, Fragment} from 'react'
import PropTypes from 'prop-types'
import {
  Divider,
  Grid,
  Skeleton, Button,
} from '@mui/material'

import connectWithRedux from '../../decorators/connectWithRedux'
import invoiceActions from '../../redux/invoice/actions'
import {selectors as invoiceSelector} from '../../redux/invoice/reducer'
import InvoiceParty from "../InvoiceParty";
import InvoiceMeta from "../InvoiceMeta";
import InvoiceEntries from "../InvoiceEntries";
import SaveIcon from '@mui/icons-material/Save';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import LockIcon from '@mui/icons-material/Lock';
import LockResetIcon from '@mui/icons-material/LockReset';

@connectWithRedux((state) => ({
  isLoading: invoiceSelector.isLoading(state),
  error: invoiceSelector.error(state),
  uuid: invoiceSelector.uuid(state),
  invoiceMeta: invoiceSelector.invoiceMeta(state),
  provider: invoiceSelector.provider(state),
  customer: invoiceSelector.customer(state),
  invoiceEntries: invoiceSelector.invoiceEntries(state),
}), {
  addInvoiceEntry: invoiceActions.addInvoiceEntry,
  removeInvoiceEntry: invoiceActions.removeInvoiceEntry,
  updateInvoiceEntry: invoiceActions.updateInvoiceEntry,
  updateInvoiceSection: invoiceActions.updateInvoiceSection,
  storeNewInvoice: invoiceActions.storeNewInvoice,
  lockInvoice: invoiceActions.lockInvoice,
  deleteInvoice: invoiceActions.deleteInvoice,
})

class StoredInvoicesList extends PureComponent {
  static propTypes = {
    isLoading: PropTypes.bool,
    getInvoices: PropTypes.func,
    getInvoice: PropTypes.func,
    storeNewInvoice: PropTypes.func,
    updateInvoiceSection: PropTypes.func,
    addInvoiceEntry: PropTypes.func,
    updateInvoiceEntry: PropTypes.func,
    removeInvoiceEntry: PropTypes.func,
    invoices: PropTypes.array
  }

  handleAddEntry = () => {
    const newInvoiceEntry = {
      dateProvided: '',
      description: '',
      qty: '',
      qtyType: '',
      rate: '0',
      total: '0',
    }

    // TODO: refactor to require no entry itself, implement it in the reducer to take defaultState
    this.props.addInvoiceEntry(newInvoiceEntry)
  }

  handleInvoiceUpdate = (dataSection) => (subjectField, subjectValue) => {
    // TODO: move logic to reducer, refactor action to send only section, fieldName, value
    const updatedSectionData = {
      ...this.props[dataSection],
      [subjectField]: subjectValue
    }

    this.props.updateInvoiceSection(dataSection, updatedSectionData)
  }

  handleEntryUpdate = (entryIndex, entryRow) => {
    this.props.updateInvoiceEntry(entryIndex, entryRow)
  }

  handleEntryRemove = (entryIndex) => {
    this.props.removeInvoiceEntry(entryIndex)
  }

  handleInvoiceSave = () => {
    const {invoiceMeta, invoiceEntries, provider, customer, uuid} = this.props

    const newInvoice = {
      invoiceMeta,
      invoiceEntries,
      provider,
      customer,
      uuid,
    }

    this.props.storeNewInvoice(newInvoice)
  }

  handleInvoiceLock = (uuid) => () => {
    this.props.lockInvoice(uuid)
  }

  handleInvoiceDelete = (uuid) => () => {
    this.props.deleteInvoice(uuid)
  }

  render = () => {
    const {isLoading} = this.props
    const {provider, customer, invoiceMeta, invoiceEntries, uuid} = this.props
    const locked = invoiceMeta?.locked

    return (
      <Fragment>
        {isLoading && <Skeleton width="100%" height="30" variant="wave" />}
        <Grid sx={{ flexGrow: 1 }} container>
          <Grid item xs={12}>
            <Grid container justifyContent="center" spacing={1} sx={{p: 1}}>
              <Grid item sx={{width: '50%', p: 1}}>
                <InvoiceParty
                  locked={locked}
                  subject={provider}
                  subjectType={'provider'}
                  editMode={true}
                  onUpdate={this.handleInvoiceUpdate('provider')}
                />
              </Grid>
              <Grid item sx={{width: '50%', p: 1}}>
                <InvoiceParty
                  locked={locked}
                  subject={customer}
                  subjectType={'customer'}
                  editMode={true}
                  onUpdate={this.handleInvoiceUpdate('customer')}
                />
              </Grid>
            </Grid>
            <Divider />
            <Grid container justifyContent="center" spacing={1} sx={{p: 1}}>
              <Grid item sx={{width: '100%', p: 1}}>
                <InvoiceEntries
                  locked={locked}
                  entries={invoiceEntries}
                  onAdd={this.handleAddEntry}
                  onUpdate={this.handleEntryUpdate}
                  onRemove={this.handleEntryRemove}
                />
              </Grid>
            </Grid>
            <Divider />
            <Grid container justifyContent="center" spacing={1} sx={{p: 1}}>
              <Grid item sx={{width: '100%', p: 1}}>
                <InvoiceMeta
                  meta={invoiceMeta}
                  provider={provider}
                  locked={locked}
                  onUpdate={this.handleInvoiceUpdate('invoiceMeta')}
                  onUpdateProvider={this.handleInvoiceUpdate('provider')}
                />
              </Grid>
            </Grid>
            <Divider />
            <Grid container justifyContent="left" spacing={1} sx={{p: 1}}>
              {!locked &&
                <Grid item sx={{width: 'auto'}}>
                  <Button variant="contained" color="primary" size="small" startIcon={<SaveIcon />} onClick={this.handleInvoiceSave}>
                    Save invoice
                  </Button>
                </Grid>
              }
              {uuid &&
                <Grid item sx={{width: 'auto'}}>
                  <Button variant="contained" color="secondary" size="small"
                          startIcon={locked ? <LockResetIcon/> : <LockIcon/>} onClick={this.handleInvoiceLock(uuid)}>
                    {locked ? 'Unlock' : 'Lock'}
                  </Button>
                </Grid>
              }
              {uuid && !locked &&
                <Grid item sx={{width: 'auto'}}>
                  <Button variant="contained" color="error" size="small" startIcon={<DeleteForeverIcon/>}
                          onClick={this.handleInvoiceDelete(uuid)}>
                    Delete invoice
                  </Button>
                </Grid>
              }
            </Grid>
          </Grid>
        </Grid>
      </Fragment>
    )
  }
}

export default StoredInvoicesList
