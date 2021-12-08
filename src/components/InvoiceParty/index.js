import React, {PureComponent, Fragment} from 'react'
import PropTypes from 'prop-types'
import {
  TextField,
  Typography,
} from '@mui/material'
import {labels} from '../Invoice/en-UK'
import {inputStyle, subtitleStyle} from '../../shared-styles'

export class InvoiceParty extends PureComponent {
  handleChange = (event) => {
    const {name, value} = event.target
    this.props.onUpdate(name, value)
  }

  render() {
    const {
      subject,
      locked,
    } = this.props

    return (
      <Fragment>
        <Typography variang="subtitle2" {...subtitleStyle}>Company details</Typography>
        <TextField disabled={locked} label={labels.companyName} name="companyName" value={subject.companyName} onChange={this.handleChange} fullWidth size="small" margin="dense" {...inputStyle} />
        <TextField disabled={locked} label={labels.companyRegNo} name="companyRegNo" value={subject.companyRegNo} onChange={this.handleChange} fullWidth size="small" margin="dense" {...inputStyle} />
        <TextField disabled={locked} label={labels.companyVatNo} name="companyVatNo" value={subject.companyVatNo} onChange={this.handleChange} fullWidth size="small" margin="dense" {...inputStyle} />

        <Typography variang="subtitle2" {...subtitleStyle}>Representative details</Typography>
        <TextField disabled={locked} label={labels.name} name="name" value={subject.name} onChange={this.handleChange} fullWidth size="small" margin="dense" {...inputStyle} />
        <TextField disabled={locked} label={labels.role} name="role" value={subject.role} onChange={this.handleChange} fullWidth size="small" margin="dense" {...inputStyle} />

        <Typography variang="subtitle2" {...subtitleStyle}>Company address</Typography>
        <TextField disabled={locked} label={labels.addressLine1} name="addressLine1" value={subject.addressLine1} onChange={this.handleChange} fullWidth size="small" margin="dense" {...inputStyle} />
        <TextField disabled={locked} label={labels.addressLine2} name="addressLine2" value={subject.addressLine2} onChange={this.handleChange} fullWidth size="small" margin="dense" {...inputStyle} />
        <TextField disabled={locked} label={labels.addressLine3} name="addressLine3" value={subject.addressLine3} onChange={this.handleChange} fullWidth size="small" margin="dense" {...inputStyle} />
        <TextField disabled={locked} label={labels.addressLine4} name="addressLine4" value={subject.addressLine4} onChange={this.handleChange} fullWidth size="small" margin="dense" {...inputStyle} />

        <Typography variang="subtitle2" {...subtitleStyle}>Billing info</Typography>
        <TextField disabled={locked} label={labels.billingBankAccountBic} name="billingBankAccountBic" value={subject.billingBankAccountBic} onChange={this.handleChange} fullWidth size="small" margin="dense" {...inputStyle} />
        <TextField disabled={locked} label={labels.billingBankAccountIban} name="billingBankAccountIban" value={subject.billingBankAccountIban} onChange={this.handleChange} fullWidth size="small" margin="dense" {...inputStyle} />
        <TextField disabled={locked} label={labels.billingBankAccountNo} name="billingBankAccountNo" value={subject.billingBankAccountNo} onChange={this.handleChange} fullWidth size="small" margin="dense" {...inputStyle} />
        <TextField disabled={locked} label={labels.billingBankAccountSortCode} name="billingBankAccountSortCode" value={subject.billingBankAccountSortCode} onChange={this.handleChange} fullWidth size="small" margin="dense" {...inputStyle} />
      </Fragment>
    )
  }
}

InvoiceParty.propTypes = {
  subject: PropTypes.object,
  editMode: PropTypes.bool,
  onUpdate: PropTypes.func
}

export default InvoiceParty