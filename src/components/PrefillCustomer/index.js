import React, {Fragment, PureComponent} from 'react'
import {connect} from 'react-redux'
import PropTypes from 'prop-types'
import {
  Backdrop,
  Box,
  Fade,
  Modal,
  Typography,
  Chip,
  Stack,
} from '@mui/material'
import invoiceActions from '../../redux/invoice/actions'
import {selectors as invoiceSelector} from '../../redux/invoice/reducer'

const boxStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '80%',
  maxWidth: '600px',
  bgcolor: 'background.paper',
  boxShadow: 10,
  p: 3,
}

const mapStateToProps = (state) => ({
  isLoading: invoiceSelector.isLoading(state),
  error: invoiceSelector.error(state),
  displaySection: invoiceSelector.displaySection(state),
  allCustomers: invoiceSelector.allCustomers(state),
})

const mapDispatchToProps = {
  getInvoices: invoiceActions.getInvoices,
  displaySectionSwitch: invoiceActions.displaySectionSwitch,
  updateInvoiceSection: invoiceActions.updateInvoiceSection,
}

export class PrefillCustomer extends PureComponent {
  static propTypes = {
    isLoading: PropTypes.bool,
    getInvoices: PropTypes.func,
    updateInvoiceSection: PropTypes.func,
    displaySectionSwitch: PropTypes.func,
    displaySection: PropTypes.object,
    allCustomers: PropTypes.array,
  }

  handlePrefillCustomer = (customer) => () => {
    this.props.updateInvoiceSection('customer', customer)
    this.props.displaySectionSwitch('customerPrefill', false)
  }

  handleClose = () => {
    this.props.displaySectionSwitch('customerPrefill', false)
  }

  render = () => {
    const {isLoading, error, displaySection, allCustomers} = this.props

    return (
      <Fragment>
        <Modal
          aria-labelledby="transition-modal-title"
          aria-describedby="transition-modal-description"
          open={displaySection.customerPrefill}
          onClose={this.handleClose}
          closeAfterTransition
          BackdropComponent={Backdrop}
          BackdropProps={{
            timeout: 500,
          }}
        >
          <Fade in={displaySection.customerPrefill}>
            <Box sx={boxStyle}>
              <Typography id="transition-modal-title" variant="h6" component="h2">
                Select from existing customers
              </Typography>
              <Typography id="transition-modal-description" sx={{ mt: 2 }}>
                <Stack direction="row" spacing={1}>
                  {allCustomers?.map((customer, index) => (
                    <Chip key={`${customer.companyName}_${index}`} label={customer.companyName} variant="outlined" onClick={this.handlePrefillCustomer(customer)} />
                  ))}
                </Stack>
              </Typography>
            </Box>
          </Fade>
        </Modal>
      </Fragment>
    )
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(PrefillCustomer)
