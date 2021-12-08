import React, {PureComponent, Fragment} from 'react'
import {Box, Grid, Button, IconButton, TextField, Typography} from "@mui/material";
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import AddBoxIcon from '@mui/icons-material/AddBox'
import {inputStyle, subtitleStyle} from '../../shared-styles'
import {labels} from '../Invoice/en-UK'
import {recalcEntry} from "../../utils/invoice";

export class InvoiceEntries extends PureComponent {
  handleChange = (index, entry) => (event) => {
    const fieldName = event.target.name
    const fieldValue = event.target.value

    let updatedRow = {
      ...entry
    }

    if (fieldName === 'qty' || fieldName === 'rate' || fieldName === 'total') {
      try {
        updatedRow = {
          ...entry,
          ...recalcEntry(entry, fieldName, fieldValue)
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

  handleRemove = (index) => (event) => {
    event.preventDefault()
    this.props.onRemove(index)
  }

  render() {
    const {entries, locked} = this.props

    return (
      <Fragment>
        {entries?.map((entry, index) => {
          return (
            <Fragment key={`entry_edit_${index}`}>
              <Grid container justifyContent="left" spacing={1} sx={{p: 0}} sx={{width: '100%'}}>
                <Grid item sx={{width: '100px', p: 0}}>
                  <TextField disabled={locked} placeholder="DD/MM/YYYY" label={labels.date} name="dateProvided" value={entry.dateProvided} onChange={this.handleChange(index, entry)} fullWidth size="small" margin="dense" {...inputStyle} />
                </Grid>
                <Grid item sx={{width: 'auto', p: 0, flexGrow: 1}}>
                  <TextField disabled={locked} label={labels.description} name="description" value={entry.description} onChange={this.handleChange(index, entry)} fullWidth size="small" margin="dense" {...inputStyle} />
                </Grid>
                <Grid item sx={{width: '55px', p: 0}}>
                  <TextField disabled={locked} label={labels.qty} name="qty" value={entry.qty} onChange={this.handleChange(index, entry)} fullWidth size="small" margin="dense" {...inputStyle} type="number" />
                </Grid>
                <Grid item sx={{width: '60px', p: 0}}>
                  <TextField disabled={locked} label={labels.unit} name="qtyType" value={entry.qtyType} onChange={this.handleChange(index, entry)} fullWidth size="small" margin="dense" {...inputStyle} />
                </Grid>
                <Grid item sx={{width: '60px', p: 0}}>
                  <TextField disabled={locked} label={labels.rate} name="rate" value={entry.rate} onChange={this.handleChange(index, entry)} fullWidth size="small" margin="dense" {...inputStyle} type="number" />
                </Grid>
                <Grid item sx={{width: '80px', p: 0}}>
                  <TextField disabled={locked} label={labels.total} name="total" value={entry.total} onChange={this.handleChange(index, entry)} fullWidth size="small" margin="dense" {...inputStyle} type="number" />
                </Grid>
                <Grid item sx={{width: '30px', p: 0}}>
                  <IconButton disabled={locked} color="error" aria-label="Delete Entry" component="span" style={{position: 'relative', top: '3px'}} onClick={this.handleRemove(index)}>
                    <DeleteForeverIcon />
                  </IconButton>
                </Grid>
              </Grid>
            </Fragment>
          )
        })}
        <Box sx={{paddingTop: 1}}>
          <Button disabled={locked} variant="contained" size="small" startIcon={<AddBoxIcon />} onClick={this.handleAdd}>
            {labels.addNew}
          </Button>
        </Box>
      </Fragment>
    )
  }
}

export default InvoiceEntries