import React, {PureComponent, Fragment} from 'react'
import PropTypes from 'prop-types'
import {
  Alert,
  Box,
  Divider,
  Grid,
  Skeleton,
  Button,
  Typography,
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
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import {labels} from "../Invoice/en-UK";

@connectWithRedux((state) => ({
  isLoading: invoiceSelector.isLoading(state),
  error: invoiceSelector.error(state),
  uuid: invoiceSelector.uuid(state),
  invoiceMeta: invoiceSelector.invoiceMeta(state),
  provider: invoiceSelector.provider(state),
  customer: invoiceSelector.customer(state),
  invoiceEntries: invoiceSelector.invoiceEntries(state),
  displaySection: invoiceSelector.displaySection(state),
}), {
  addInvoiceEntry: invoiceActions.addInvoiceEntry,
  removeInvoiceEntry: invoiceActions.removeInvoiceEntry,
  updateInvoiceEntry: invoiceActions.updateInvoiceEntry,
  updateInvoiceSection: invoiceActions.updateInvoiceSection,
  storeNewInvoice: invoiceActions.storeNewInvoice,
  lockInvoice: invoiceActions.lockInvoice,
  deleteInvoice: invoiceActions.deleteInvoice,
  displaySectionSwitch: invoiceActions.displaySectionSwitch,
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

  handleSectionVisibility = (section) => () => {
    this.props.displaySectionSwitch(section)
  }

  render = () => {
    const {isLoading} = this.props
    const {provider, customer, invoiceMeta, invoiceEntries, uuid, displaySection} = this.props
    const locked = invoiceMeta?.locked

    return (
      <Fragment>
        {uuid &&
          <Fragment>
            <Alert severity="info"><strong>Note:</strong> Editing existing invoice ${uuid}</Alert>
            <Divider />
          </Fragment>
        }
        {!uuid &&
          <Fragment>
            <Alert severity="success"><strong>Note:</strong> Creating new invoice</Alert>
            <Divider />
          </Fragment>
        }
        <Grid sx={{ flexGrow: 1 }} container>
          <Grid item xs={12}>
            <Grid container justifyContent="center" spacing={1} sx={{p: 1}}>
              <Grid item sx={{width: '50%', p: 1}}>
                <Grid container justifyContent="left" alignItems="center">
                  <Grid item sx={{flexGrow: 1}}>
                    <Typography variant="body2" style={{textTransform: 'uppercase', fontSize: '12px'}}>
                      {labels.provider}
                    </Typography>
                  </Grid>
                  <Grid item>
                    <Button
                      size="small"
                      color="secondary"
                      endIcon={displaySection.provider ? <VisibilityOffIcon />:<VisibilityIcon />}
                      onClick={this.handleSectionVisibility('provider')}
                    >
                      {displaySection.provider ? 'Hide' : 'Show'} Form
                    </Button>
                  </Grid>
                </Grid>

                {displaySection.provider &&
                  <InvoiceParty
                    locked={locked || isLoading}
                    subject={provider}
                    editMode={true}
                    onUpdate={this.handleInvoiceUpdate('provider')}
                  />
                }
              </Grid>
              <Grid item sx={{width: '50%', p: 1}}>
                <Grid container justifyContent="left" alignItems="center">
                  <Grid item sx={{flexGrow: 1}}>
                    <Typography variant="body2" style={{textTransform: 'uppercase', fontSize: '12px'}}>
                      {labels.customer}
                    </Typography>
                  </Grid>
                  <Grid item>
                    <Button
                      size="small"
                      color="secondary"
                      endIcon={displaySection.customer ? <VisibilityOffIcon />:<VisibilityIcon />}
                      onClick={this.handleSectionVisibility('customer')}
                    >
                      {displaySection.customer ? 'Hide' : 'Show'} Form
                    </Button>
                  </Grid>
                </Grid>

                {displaySection.customer &&
                  <InvoiceParty
                    locked={locked || isLoading}
                    subject={customer}
                    editMode={true}
                    onUpdate={this.handleInvoiceUpdate('customer')}
                  />
                }
              </Grid>
            </Grid>
            <Divider />
            <Grid container justifyContent="center" spacing={1} sx={{p: 1}}>
              <Grid item sx={{width: '100%', p: 1}}>
                <InvoiceEntries
                  locked={locked || isLoading}
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
                  locked={locked || isLoading}
                  onUpdate={this.handleInvoiceUpdate('invoiceMeta')}
                  onUpdateProvider={this.handleInvoiceUpdate('provider')}
                />
              </Grid>
            </Grid>
            <Divider />
            {uuid &&
              <Box sx={{p: 1}}>
                <Typography variant="body2" component="div" style={{fontSize: '12px'}}>
                  <strong>Note:</strong> Editing existing invoice ${uuid}
                </Typography>
              </Box>
            }
            {!uuid &&
              <Box sx={{p: 1}}>
                <Typography variant="body2" component="div" style={{fontSize: '12px'}}>
                  <strong>Note:</strong> Creating new invoice
                </Typography>
              </Box>
            }
            <Grid container justifyContent="left" spacing={1} sx={{p: 1}}>
              {!locked &&
                <Grid item sx={{width: 'auto'}}>
                  <Button disabled={isLoading} variant="contained" color="primary" size="small" startIcon={<SaveIcon />} onClick={this.handleInvoiceSave}>
                    Save invoice
                  </Button>
                </Grid>
              }
              {uuid &&
                <Grid item sx={{width: 'auto'}}>
                  <Button disabled={isLoading} variant="contained" color="secondary" size="small"
                          startIcon={locked ? <LockResetIcon/> : <LockIcon/>} onClick={this.handleInvoiceLock(uuid)}>
                    {locked ? 'Unlock' : 'Lock'}
                  </Button>
                </Grid>
              }
              {uuid && !locked &&
                <Grid item sx={{width: 'auto'}}>
                  <Button disabled={isLoading} variant="contained" color="error" size="small" startIcon={<DeleteForeverIcon/>}
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
