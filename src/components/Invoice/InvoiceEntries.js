import React, {Component} from 'react'
import {labels} from './en-UK'

export class InvoiceEntries extends Component {

  recalcEntry = (entry, fieldName, fieldValue) => {
    switch (fieldName) {
      case "qty":
        entry.total = parseFloat(fieldValue) * parseFloat(entry.rate)
        entry.qty = parseInt(fieldValue)
        return entry
      case "rate":
        entry.total = parseFloat(fieldValue) * parseInt(entry.qty)
        entry.rate = parseFloat(fieldValue)
        return entry
      case "total":
        entry.rate = parseFloat(fieldValue) / parseInt(entry.qty)
        entry.total = parseFloat(fieldValue)
        return entry
      default:
        break
    }
  }

  handleChange = (entry, index, event) => {
    const fieldName = event.target.name
    const fieldValue = event.target.value

    let updatedRow = {...entry}

    if (fieldName === 'qty' || fieldName === 'rate' || fieldName === 'total') {
      try {
        updatedRow = {
          ...this.recalcEntry(entry, fieldName, fieldValue)
        }
      } catch (err) {
        console.log('Could not recalculate row: ', err.message)
      }

    } else {
      updatedRow[event.target.name] = event.target.value
    }

    this.props.onUpdate(index, updatedRow)
  }

  handleAdd = (event) => {
    event.preventDefault()
    this.props.onAdd()
  }

  handleRemove = (index, event) => {
    event.preventDefault()
    this.props.onRemove(index)
  }

  render() {

    const {entries, invoiceMeta, editMode} = this.props

    return (
      <table className="Invoice-table Table-wide">
        <thead>
        <tr>
          <th>{labels.date}</th>
          <th>{labels.description}</th>
          <th>{labels.qty}</th>
          {editMode && <th>{labels.unit}</th>}
          <th>{labels.rate}</th>
          <th>{labels.total}</th>
          {editMode && <th>&nbsp;</th>}
        </tr>
        </thead>
        <tbody>
        {!editMode && entries.map((entry, index) => {
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
        {editMode && entries.map((entry, index) => {
          return (
            <tr key={`entry_edit_${index}`}>
              <td style={{width: 120}}>
                <input type="text" placeholder="DD/MM/YYYY" name="dateProvided" value={entry.dateProvided} onChange={this.handleChange.bind(this, entry, index)} />
              </td>
              <td>
                <input type="text" placeholder={labels.description} name="description" value={entry.description} onChange={this.handleChange.bind(this, entry, index)} />
              </td>
              <td style={{width: 50}}>
                <input type="text" placeholder={labels.qty} name="qty" value={entry.qty} onChange={this.handleChange.bind(this, entry, index)} />
              </td>
              <td style={{width: 50}}>
                <input type="text" placeholder={labels.unit} name="qtyType" value={entry.qtyType} onChange={this.handleChange.bind(this, entry, index)} />
              </td>
              <td style={{width: 100}}>
                <input type="text" placeholder={labels.rate} name="rate" value={entry.rate} onChange={this.handleChange.bind(this, entry, index)} />
              </td>
              <td style={{width: 100}}>
                <input type="text" placeholder={labels.total} name="total" value={entry.total} onChange={this.handleChange.bind(this, entry, index)} />
              </td>
              <td style={{width: 20}}><button onClick={this.handleRemove.bind(this, index)}>X</button></td>
            </tr>
          )
        })}
        </tbody>
        {editMode && <tfoot>
        <tr>
          <td colSpan={6}>
            <button onClick={this.handleAdd}>{labels.addNew}</button>
          </td>
        </tr>
        </tfoot>}
      </table>
    )
  }
}

export default InvoiceEntries