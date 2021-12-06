import React, {PureComponent} from 'react'
// import {connect} from 'react-redux'
// import {withRouter} from 'react-router-dom'
import PropTypes from 'prop-types'
import {
  Skeleton,
} from '@mui/material'

/* TODO
  Component name: StoredInvoicesList
  Redux folder name: invoices
  Redux action name: invoiceActions
  Redux selector name: invoiceSelector
  Function to call middleware or api: getInvoices
*/

import connectWithRedux from "../../decorators/connectWithRedux";
import invoiceActions from '../../redux/invoice/actions'
import {selectors as invoiceSelector} from '../../redux/invoice/reducer'

@connectWithRedux((state) => ({
  isLoading: invoiceSelector.state(state).isLoading,
  error: invoiceSelector.state(state).error,
  invoices: invoiceSelector.state(state).invoices,
  invoice: invoiceSelector.state(state).invoice,
}), {
  getInvoices: invoiceActions.getInvoices,
  getInvoice: invoiceActions.getInvoice,
})

class StoredInvoicesList extends PureComponent {
  handleEvent = () => {
    // load invoice?
    // start new invoice?
  }

  componentDidMount() {
    this.props.getInvoices()
  }

  handleNavClick = (invoiceId) => (event) => {
    event.preventDefault()

    this.props.getInvoice(invoiceId)
  }

  render = () => {
    const {invoices, invoice, isLoading} = this.props

    return (
      <div className="App-invoice-list">
        {isLoading && <Skeleton width="100%" height="30" variant="wave" />}
        <p>{invoice?.invoiceMeta?.invoiceSeries}{invoice?.invoiceMeta?.invoiceNo}</p>
        {!isLoading &&
          <ul className="App-invoice-list-items">
            {invoices?.length && invoices.map((invoice, index) => <li key={`invoice_${invoice.invoiceMeta.invoiceSeries}${invoice.invoiceMeta.invoiceNo}_${index}`}>
              <a href="#" onClick={this.handleNavClick(invoice.id || index)}>
                {invoice.invoiceMeta.invoiceSeries}{invoice.invoiceMeta.invoiceNo}<br />
                <small>{invoice.invoiceMeta.invoiceDate} - {invoice.customer.companyName}</small>
              </a>
            </li>)}
          </ul>
        }
      </div>
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
