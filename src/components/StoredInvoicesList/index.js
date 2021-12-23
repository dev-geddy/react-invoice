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
import LockIcon from '@mui/icons-material/Lock';
import { styled, ThemeProvider, createTheme } from '@mui/material/styles'

import AddBoxIcon from '@mui/icons-material/AddBox'
import ReceiptIcon from '@mui/icons-material/Receipt'

import connectWithRedux from '../../decorators/connectWithRedux'
import invoiceActions from '../../redux/invoice/actions'
import {selectors as invoiceSelector} from '../../redux/invoice/reducer'
import labels from '../../translations'

const StyledList = styled(List)({
  paddingTop: 0,
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
  startNewInvoice: invoiceActions.startNewInvoice,
})

class StoredInvoicesList extends PureComponent {
  static propTypes = {
    isLoading: PropTypes.bool,
    getInvoices: PropTypes.func,
    getInvoice: PropTypes.func,
    startNewInvoice: PropTypes.func,
    invoices: PropTypes.array
  }

  componentDidMount() {
    this.props.getInvoices()
  }

  handleInvoicePick = (uuid) => () => {
    this.props.getInvoice(uuid)
  }

  handleNewInvoice = () => {
    this.props.startNewInvoice()
  }

  render = () => {
    const {invoices, invoiceMeta, isLoading, uuid} = this.props

    return (
      <Fragment>
        <StyledList className="App-invoice-list-items">
          <ListItem component="div" disablePadding>
            <ListItemButton sx={{ height: 56 }} onClick={this.handleNewInvoice}>
              <ListItemIcon>
                <AddBoxIcon />
              </ListItemIcon>
              <ListItemText>
                <Typography variant="body2">{labels.createNewInvoice}</Typography>
              </ListItemText>
            </ListItemButton>
          </ListItem>
          <Divider />
          {invoices?.reverse().map((invoice, index) => (
            <ListItem  component="div" disablePadding key={`invoice_${invoice.uuid}_${index}`}>
              <ListItemButton disabled={isLoading} sx={{ height: 56 }} onClick={this.handleInvoicePick(invoice.uuid)} style={invoice.uuid === uuid ? {backgroundColor: 'rgba(0,0,0,0.1)'}:{}}>
                <ListItemIcon>
                  <ReceiptIcon />
                </ListItemIcon>
                <ListItemText>
                  <Typography variant="body2" component="div" sx={{position: 'relative'}}>
                    {invoice.invoiceMeta.invoiceSeries}{invoice.invoiceMeta.invoiceNo}
                    {invoice.invoiceMeta.locked && <LockIcon sx={{position: 'absolute', color: '#666', transform: 'scale(0.75)'}} />}
                  </Typography>
                  <Typography variant="body2" component="div" style={{fontSize: '11px'}}>{invoice.invoiceMeta.invoiceDate} - {invoice.customer.companyName}</Typography>
                </ListItemText>
              </ListItemButton>
            </ListItem>
          ))}
        </StyledList>
      </Fragment>
    )
  }
}

export default StoredInvoicesList
