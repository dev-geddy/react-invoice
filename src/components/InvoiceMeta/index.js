import React, {PureComponent, Fragment} from 'react'
import PropTypes from 'prop-types'
import {
  Grid,
  TextField,
  Typography,
} from '@mui/material'
import dayJs from 'dayjs'
import AdapterDateFns from '@mui/lab/AdapterDateFns'
import LocalizationProvider from '@mui/lab/LocalizationProvider'
import DatePicker from '@mui/lab/DesktopDatePicker'
import InfoIcon from '@mui/icons-material/Info';
import {labels} from '../Invoice/en-UK'
import {inputStyle, subtitleStyle, datePickerStyle} from '../../shared-styles'

export class InvoiceParty extends PureComponent {

  handleChange = (event) => {
    const {name, value} = event.target

    this.props.onUpdate(name, value)
  }

  // handleDateChange = (date) => {
  //   const formattedDate = dayJs(date).format('DD/MM/YYYY')
  //
  //   console.log('handleDateChange/date:', date)
  //   console.log('handleDateChange/formattedDate:', formattedDate)
  //
  //   this.props.onUpdate('invoiceDate', formattedDate)
  // }

  handleChangeProvider = (event) => {
    const {name, value} = event.target

    this.props.onUpdateProvider(name, value)
  }

  render() {
    const {meta, provider, locked} = this.props

    console.log('meta.invoiceDate', meta.invoiceDate)

    return (
      <Fragment>
        <Typography variang="subtitle2" {...subtitleStyle}>{labels.invoiceMeta}</Typography>
        <Grid container justifyContent="left" spacing={1} sx={{p: 0}}>
          <Grid item sx={{width: 160, p: 1}}>
            <TextField disabled={locked} label={labels.invoiceDate} name="invoiceDate" value={meta.invoiceDate} onChange={this.handleChange} fullWidth size="small" margin="dense" {...inputStyle} />
            {/*<LocalizationProvider dateAdapter={AdapterDateFns}>*/}
            {/*  <DatePicker*/}
            {/*    disabled={locked}*/}
            {/*    inputFormat={'dd/mm/yyyy'}*/}
            {/*    mask={'__/__/____'}*/}
            {/*    // views={['month', 'day']}*/}
            {/*    label={labels.invoiceDate}*/}
            {/*    name="invoiceDate"*/}
            {/*    value={meta.invoiceDate}*/}
            {/*    onChange={this.handleDateChange}*/}
            {/*    fullWidth*/}
            {/*    size="small"*/}
            {/*    margin="dense"*/}
            {/*    //{...datePickerStyle}*/}
            {/*    renderInput={(inputProps) => <TextField {...inputProps} {...inputStyle} />}*/}
            {/*  />*/}
            {/*</LocalizationProvider>*/}
          </Grid>
          <Grid item sx={{width: 120, p: 1}}>
            <TextField disabled={locked} label={labels.invoiceSeries} name="invoiceSeries" value={meta.invoiceSeries} onChange={this.handleChange} fullWidth size="small" margin="dense" {...inputStyle} />
          </Grid>
          <Grid item sx={{width: 120, p: 1}}>
            <TextField disabled={locked} label={labels.invoiceNumber} name="invoiceNo" value={meta.invoiceNo} onChange={this.handleChange} fullWidth size="small" margin="dense" {...inputStyle} type="number" />
          </Grid>
        </Grid>

        <Grid container justifyContent="left" spacing={1} sx={{p: 0}}>
          <Grid item sx={{width: 120, p: 1}}>
            <TextField disabled={locked} label={labels.currency} name="currency" value={meta.currency} onChange={this.handleChange} fullWidth size="small" margin="dense" {...inputStyle} />
          </Grid>
          <Grid item sx={{width: 120, p: 1}}>
            <TextField disabled={locked} label={labels.vatRatePct} name="vatRate" value={meta.vatRate} onChange={this.handleChange} fullWidth size="small" margin="dense" {...inputStyle} type="number" />
          </Grid>
          <Grid item sx={{width: 'auto', p: 1}}>
            <Typography disabled={locked} variant="body2" style={{fontSize: '12px', paddingTop: '14px'}}><InfoIcon sx={{fontSize: '14px', position: 'relative', top: '2px', marginRight: '4px'}} />Is client VAT registered?</Typography>
          </Grid>
        </Grid>

        <Typography variang="subtitle2" {...subtitleStyle}>{labels.invoiceBranding}</Typography>
        <Grid container justifyContent="left" spacing={1} sx={{p: 0}}>
          <Grid item sx={{width: '50%', p: 1}}>
            <TextField disabled={locked} label={labels.brandName} name="brandName" value={meta.brandName} onChange={this.handleChange} fullWidth size="small" margin="dense" {...inputStyle} />
          </Grid>
          <Grid item sx={{width: '50%', p: 1}}>
            <TextField disabled={locked} label={labels.brandSubName} name="brandSubName" value={meta.brandSubName} onChange={this.handleChange} fullWidth size="small" margin="dense" {...inputStyle} />
          </Grid>
        </Grid>

        <Typography variang="subtitle2" {...subtitleStyle}>{labels.companyId}</Typography>
        <Grid container justifyContent="left" spacing={1} sx={{p: 0}}>
          <Grid item sx={{width: '50%', p: 1}}>
            <TextField disabled={locked} label={labels.companyName} name="companyName" value={provider.companyName} onChange={this.handleChangeProvider} fullWidth size="small" margin="dense" {...inputStyle} />
          </Grid>
          <Grid item sx={{width: '25%', p: 1}}>
            <TextField disabled={locked} label={labels.companyRegNo} name="companyRegNo" value={provider.companyRegNo} onChange={this.handleChangeProvider} fullWidth size="small" margin="dense" {...inputStyle} />
          </Grid>
          <Grid item sx={{width: '25%', p: 1}}>
            <TextField disabled={locked} label={labels.companyVatNo} name="companyVatNo" value={provider.companyVatNo} onChange={this.handleChangeProvider} fullWidth size="small" margin="dense" {...inputStyle} />
          </Grid>
        </Grid>
      </Fragment>
    )
  }
}

InvoiceParty.propTypes = {
  subject: PropTypes.object,
  subjectType: PropTypes.string,
  editMode: PropTypes.bool,
  onUpdate: PropTypes.func,
  onUpdateProvider: PropTypes.func
}

export default InvoiceParty