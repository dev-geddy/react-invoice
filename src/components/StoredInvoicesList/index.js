import React, {PureComponent, Fragment} from 'react'

import PropTypes from 'prop-types'
import {
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Skeleton, Typography,
} from '@mui/material'
import { styled, ThemeProvider, createTheme } from '@mui/material/styles'

import AddBoxIcon from '@mui/icons-material/AddBox'
import ReceiptIcon from '@mui/icons-material/Receipt'

import connectWithRedux from '../../decorators/connectWithRedux'
import invoiceActions from '../../redux/invoice/actions'
import {selectors as invoiceSelector} from '../../redux/invoice/reducer'

const StyledList = styled(List)({
  '& .MuiListItemButton-root': {
    paddingLeft: 12,
    paddingRight: 12,
  },
  '& .MuiListItemIcon-root': {
    minWidth: 0,
    marginRight: 8,
  },
  '& .MuiSvgIcon-root': {
    fontSize: 20,
  },
})

const isInvoiceSelected = (itemUuid, activeUuid) => {
  return itemUuid && itemUuid === activeUuid
}

@connectWithRedux((state) => ({
  isLoading: invoiceSelector.state(state).isLoading,
  error: invoiceSelector.error(state),
  uuid: invoiceSelector.uuid(state),
  invoices: invoiceSelector.invoices(state),
  invoice: invoiceSelector.invoice(state),
  invoiceMeta: invoiceSelector.invoiceMeta(state),
}), {
  getInvoices: invoiceActions.getInvoices,
  getInvoice: invoiceActions.getInvoice,
})

class StoredInvoicesList extends PureComponent {
  componentDidMount() {
    this.props.getInvoices()
  }

  handleInvoicePick = (uuid) => () => {
    this.props.getInvoice(uuid)
  }

  handleNewInvoice = (event) => {
    event.preventDefault()

    // call to clear all fields to default state
    // unset uuid
  }

  render = () => {
    const {invoices, invoiceMeta, isLoading, uuid} = this.props

    return (
      <Fragment>
        {isLoading && <Skeleton width="100%" height="30" variant="wave" />}
        {!isLoading &&
          <StyledList className="App-invoice-list-items">
            <ListItem component="div" disablePadding>
              <ListItemButton sx={{ height: 56 }} onClick={this.handleNewInvoice}>
                <ListItemIcon>
                  <AddBoxIcon />
                </ListItemIcon>
                <ListItemText>
                  <Typography variant="body2">Create new invoice</Typography>
                </ListItemText>
              </ListItemButton>
            </ListItem>
            <Divider />
            {invoices?.length && invoices.map((invoice, index) => (
              <ListItem  component="div" disablePadding key={`invoice_${invoice.invoiceMeta.invoiceSeries}${invoice.invoiceMeta.invoiceNo}_${index}`}>
                <ListItemButton sx={{ height: 56 }} onClick={this.handleInvoicePick(invoice.uuid)} style={isInvoiceSelected(invoice.uuid, uuid) ? {backgroundColor: 'rgba(0,0,0,0.1)'}:{}}>
                  <ListItemIcon>
                    <ReceiptIcon />
                  </ListItemIcon>
                  <ListItemText>
                    <Typography variant="body2" component="div">{invoice.invoiceMeta.invoiceSeries}{invoice.invoiceMeta.invoiceNo}</Typography>
                    <Typography variant="body2" component="div" style={{fontSize: '11px'}}>{invoice.invoiceMeta.invoiceDate} - {invoice.customer.companyName}</Typography>
                  </ListItemText>
                </ListItemButton>
              </ListItem>
            ))}

          </StyledList>
        }
      </Fragment>
    )
  }
}

StoredInvoicesList.propTypes = {
  isLoading: PropTypes.bool,
  getInvoices: PropTypes.func,
  getInvoice: PropTypes.func,
  invoices: PropTypes.array
}

export default StoredInvoicesList
