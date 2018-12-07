import React, {Component} from 'react'

class InvoiceHistory extends Component {
  handleEdit(index, event) {
    event.preventDefault()
    this.props.onEdit(index)
  }
  handleDelete(index, event) {
    event.preventDefault()
    this.props.onDelete(index)
  }
  render() {
    const {savedInvoices} = this.props

    return (
      <div className="Invoice-history">
        <div className="Invoice-history-header">
          <h2>Invoice history</h2>
          <a className="Invoice-history-button" onClick={this.props.onSave}>Save current</a>&nbsp;
          {/*<a className="Invoice-history-button" onClick={this.props.onNew}>Add new</a>*/}
        </div>
        <div className="Invoice-history-body">
          <ul className="Invoice-history-list">
            {savedInvoices && savedInvoices.map((invoice, index) => {
              return (
                <li key={`entry_${index}`} className="Invoice-history-item">
                  <div className="Invoice-history-row-head">
                  {invoice.invoiceMeta.invoiceSeries}{invoice.invoiceMeta.invoiceNo}<br />
                  <small>{invoice.invoiceMeta.invoiceDate} - {invoice.customer.companyName}</small><br />
                  </div>
                  <div className="Invoice-history-row-actions">
                    <a className="Invoice-history-small-button" onClick={this.handleEdit.bind(this, index)}>&laquo; Load</a>&nbsp;
                    <a className="Invoice-history-small-button" onClick={this.handleDelete.bind(this, index)}>X</a>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    )
  }
}

export default InvoiceHistory