import React, {Component} from 'react'
import './Invoice.css'
import InvoiceSubject from './InvoiceSubject'
import InvoiceEntries from './InvoiceEntries'
import InvoiceMeta from './InvoiceMeta'
import InvoiceHistory from './InvoiceHistory'
import {defaultState} from './defaultState'
import {labels} from './en-UK'

export class Invoice extends Component {
  qtyTypes = [
    {
      name: '',
      description: 'none'
    },
    {
      name: 'h',
      description: 'hours'
    },
    {
      name: 'd',
      description: 'days'
    },
    {
      name: 'units',
      description: 'number of goods'
    }
  ]

  currencyTypes = [
    {
      symbol: '£',
      name: 'British Pound',
      iso: 'GBP',
    },
    {
      symbol: '€',
      name: 'Euro',
      iso: 'EUR',
    },
    {
      symbol: '$',
      name: 'US Dollar',
      iso: 'USD',
    },
    {
      symbol: 'Fr.',
      name: 'Swiss Frank',
      iso: 'CHF',
    }
  ]

  newInvoiceEntry = {
    dateProvided: 'DD/MM/YYYY',
    description: labels.enterEntryDescription,
    qty: '1',
    qtyType: '',
    rate: '0',
    total: '0',
  }

  state = {
    ...defaultState
  }

  constructor(props) {
    super(props)
    if (window.localStorage) {
      try {
        const {localStorage} = window
        const savedInvoiceState = JSON.parse(localStorage.getItem('savedInvoiceState'))
        if (savedInvoiceState.provider) {
          this.state = savedInvoiceState
          document.title = this.constructTitle(savedInvoiceState)
        }
      } catch (err) {
        console.log('No previously saved invoice in browser local storage')
      }
    }
  }

  getInvoiceTotalPayable = ({invoiceEntries, invoiceMeta}) => {
    const total = invoiceEntries.reduce((grandTotal, entry) => {
      return grandTotal + parseFloat(entry.total)
    }, 0)

    const multiplier = this.getVatMultiplier(invoiceMeta.vatRate)

    return total * multiplier
  }

  constructTitle = (savedInvoiceState = {}) => {
    try {
      const invoiceDateISO = String(savedInvoiceState.invoiceMeta.invoiceDate).split('/').reverse().join('_')
      const invoiceCurrency = savedInvoiceState.invoiceMeta.currency
      const invoiceCurrencyISO = invoiceCurrency === '£' ? 'GBP' : invoiceCurrency === '€' ? 'EUR' : invoiceCurrency
      const invoiceTotal = Number(this.getInvoiceTotalPayable(savedInvoiceState)).toFixed(2);
      const vatInclusive = Number(savedInvoiceState.invoiceMeta.vatRate) > 0 ? ' VAT incl. ' : ' NON-VAT '
      const nameOnFile = `${savedInvoiceState.customer.companyName}, ${savedInvoiceState.customer.name}`

      return `${invoiceDateISO} - ${savedInvoiceState.invoiceMeta.invoiceSeries}${savedInvoiceState.invoiceMeta.invoiceNo} - ${invoiceCurrencyISO}${invoiceTotal}${vatInclusive} - (PENDING) - ${nameOnFile}`
    } catch (error) {
      return '- INVOICE INFORMATION INCOMPLETE -';
    }
  }

  handleModeChange = (event) => {
    event.preventDefault()
    event.stopPropagation()

    const {editMode} = this.state

    this.setState({
      editMode: !editMode
    })

    if (editMode === true) {
      try {
        const {localStorage} = window
        const saveState = {
          ...this.state,
          editMode: false
        }
        localStorage.setItem('savedInvoiceState', JSON.stringify(saveState))
        document.title = this.constructTitle(saveState)
      } catch (err) {
        console.log('Could not save invoice state to browser local storage')
      }
    }
  }

  handleSubjectUpdate = (subjectType, subjectField, subjectValue) => {

    let updatedProvider = {
      ...this.state[subjectType]
    }

    updatedProvider[subjectField] = subjectValue

    if (subjectType === 'provider') {
      this.setState({
        provider: updatedProvider
      })
    } else if (subjectType === 'customer') {
      this.setState({
        customer: updatedProvider
      })
    } else {
      this.setState({
        invoiceMeta: updatedProvider
      })
    }
  }

  handleEntryUpdate = (entryIndex, entryRow) => {
    this.state.invoiceEntries[entryIndex] = entryRow
    this.forceUpdate()
  }

  handleEntryAdd = () => {
    this.state.invoiceEntries.push(this.newInvoiceEntry)
    this.forceUpdate()
  }

  handleEntryRemove = (entryIndex) => {
    console.log('handleEntryRemove ', entryIndex)
    this.state.invoiceEntries.splice(entryIndex, 1);
    this.forceUpdate()
  }

  getVatMultiplier = (vat) => {
    return parseFloat(100 + parseFloat(vat)) / 100
  }

  getTotalsAndVat = (entries) => {
    const total = entries.reduce((grandTotal, entry) => {
      return grandTotal + parseFloat(entry.total)
    }, 0)

    const multiplier = this.getVatMultiplier(this.state.invoiceMeta.vatRate)

    return {
      total: total,
      vatAmount: (total * multiplier) - total,
      vatBasis: total,
      totalVat: total * multiplier
    }
  }

  componentDidMount() {
    try {
      const {localStorage} = window
      const invoicesHistory = JSON.parse(localStorage.getItem('invoicesHistory'))
      if (invoicesHistory.length > 0) {
        this.setState({history: invoicesHistory})
      }
    } catch (err) {
      console.log('Invoices history error...')
    }
  }

  updateHistory(history) {
    localStorage.setItem('invoicesHistory', JSON.stringify(history))
    this.setState({history})
  }

  handleNewInvoice = (event) => {
    event.preventDefault()

  }
  handleSaveInvoice = (event) => {
    event.preventDefault()

    let history = this.state.history || []
    const newEntry = {
      ...this.state,
      history: undefined
    }

    history.push(newEntry)
    this.updateHistory(history)
  }
  handleEditInvoice = (index) => {
    const {history} = this.state

    const loadEntry = history[index]
    const newState = {
      ...loadEntry,
      editMode: true,
      history
    }
    this.setState(newState)
  }
  handleDeleteInvoice = (index) => {
    let history = this.state.history

    history.splice(index, 1);
    this.updateHistory(history)
  }

  render() {

    const {provider, customer, invoiceEntries, invoiceMeta, editMode, history} = this.state
    const {total, totalVat, vatAmount, vatBasis} = this.getTotalsAndVat(invoiceEntries)

    return (
      <div className="Invoice">
        {editMode && <InvoiceHistory savedInvoices={history}
                                     onEdit={this.handleEditInvoice.bind(this)}
                                     onDelete={this.handleDeleteInvoice.bind(this)}
                                     onSave={this.handleSaveInvoice.bind(this)}
                                     onNew={this.handleNewInvoice.bind(this)}/>}
        <header className="Invoice-header">
          <h1 className="Logo" onClick={this.handleModeChange}>
            <span className="Logo-part-1">{invoiceMeta.brandName}</span>
            <span className="Logo-part-2">{invoiceMeta.brandSubName}</span>
          </h1>
          <div className="Header-meta">
            {provider.companyName && <span>{provider.companyName}</span>}
            {provider.companyName && <br/>}
            {provider.companyRegNo && <span>{labels.companyRegNo} <strong>{provider.companyRegNo}</strong></span>}
            {provider.companyRegNo && <br/>}
            {provider.companyVatNo && <span>{labels.companyVatNo} <strong>{provider.companyVatNo}</strong></span>}
          </div>
          <hr/>
        </header>
        <div className="Invoice-body">
          <div className="Invoice-subjects">
            <InvoiceSubject subject={provider} subjectType={'provider'} editMode={editMode}
                            onUpdate={this.handleSubjectUpdate}/>
            <InvoiceSubject subject={customer} subjectType={'customer'} editMode={editMode}
                            onUpdate={this.handleSubjectUpdate}/>
          </div>
          <div className="Invoice-the-invoice">
            <h2>{labels.invoice}</h2>
            <InvoiceMeta meta={invoiceMeta} provider={provider} editMode={editMode}
                         onUpdate={this.handleSubjectUpdate}/>
            <p>&nbsp;</p>
          </div>
          <div className="Invoice-details">
            <h3>{labels.worksCompleted}</h3>
            <InvoiceEntries entries={invoiceEntries}
                            invoiceMeta={invoiceMeta}
                            editMode={editMode}
                            onUpdate={this.handleEntryUpdate}
                            onRemove={this.handleEntryRemove}
                            onAdd={this.handleEntryAdd}/>
            <p>&nbsp;</p>
            <table className="Invoice-table Table-wide">
              <tbody>
              <tr>
                {provider.companyVatNo && <th>{labels.vatBasis}</th> || <th></th>}
                {provider.companyVatNo && <th>{labels.rate}</th> || <th></th>}
                {provider.companyVatNo && <th>{labels.vatAmount}</th> || <th></th>}
                <td rowSpan={2} className="Table-totals">
                  <table className="Totals-table">
                    <tbody>
                    <tr>
                      <th>{labels.total}</th>
                      <td>{invoiceMeta.currency}{parseFloat(total).toFixed(2)}</td>
                    </tr>
                    <tr>
                      <th>{labels.vat}</th>
                      <td>{invoiceMeta.currency}{parseFloat(provider.companyVatNo ? vatAmount : 0).toFixed(2)}</td>
                    </tr>
                    <tr>
                      <th>{labels.totalPayable}</th>
                      <td>{invoiceMeta.currency}{parseFloat(totalVat).toFixed(2)}</td>
                    </tr>
                    </tbody>
                  </table>
                </td>
              </tr>

              {provider.companyVatNo && <tr>
                <td>{invoiceMeta.currency}{parseFloat(vatBasis).toFixed(2)}</td>
                <td>{invoiceMeta.vatRate}%</td>
                <td>{invoiceMeta.currency}{parseFloat(vatAmount).toFixed(2)}</td>
              </tr> || <tr></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <footer className="Invoice-footer">
          <hr/>
          <small>
            {provider.companyName},
            &nbsp;{labels.companyRegNo}&nbsp;{provider.companyRegNo},
            &nbsp;{labels.companyVatNo}&nbsp;{provider.companyVatNo},
            &nbsp;{provider.addressLine1},
            &nbsp;{provider.addressLine2},
            &nbsp;{provider.addressLine3},
            &nbsp;{provider.addressLine4}
          </small>
        </footer>
      </div>
    )
  }
}

export default Invoice