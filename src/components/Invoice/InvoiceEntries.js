import React, {PureComponent} from 'react'
import {labels} from './en-UK'

export class InvoiceEntries extends PureComponent {

  render() {

    const {entries, invoiceMeta} = this.props

    return (
      <table className="Invoice-table Table-wide">
        <thead>
        <tr>
          <th>{labels.date}</th>
          <th>{labels.description}</th>
          <th>{labels.qty}</th>
          <th>{labels.rate}</th>
          <th>{labels.total}</th>
        </tr>
        </thead>
        <tbody>
        {entries?.map((entry, index) => {
          return (
            <tr key={`entry_${index}`}>
              <td className="Col-date">{entry.dateProvided}</td>
              <td className="Col-description">{entry.description}</td>
              <td className="Col-qty">{entry.qty}{entry.qtyType}</td>
              <td className="Col-rate">{invoiceMeta.currency}{entry.rate}{entry.qtyType && `/${entry.qtyType}`}</td>
              <td className="Col-total">{invoiceMeta.currency}{entry.total}</td>
            </tr>
          )
        })}
        </tbody>
      </table>
    )
  }
}

export default InvoiceEntries