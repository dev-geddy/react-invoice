import React, { PureComponent } from 'react'
import CssBaseline from "@mui/material/CssBaseline"
import {createTheme, ThemeProvider} from "@mui/material/styles"
import {Grid, Link} from "@mui/material"
import './App.css'
import Invoice from '../Invoice'
import StoredInvoicesList from "../StoredInvoicesList"
import InvoiceForm from "../InvoiceForm"
import PrefillCustomer from "../PrefillCustomer"

const theme = createTheme({
  typography: {
    fontFamily: [
      '"Open Sans"',
      'BlinkMacSystemFont',
    ].join(','),
  },
})

class App extends PureComponent {
  render() {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <div className="App">
          <header className="App-header">
            <Grid container alignContent="justify" justifyContent="justify" alignItems="center">
              <Grid item sx={{flexGrow: 1}}>
                <h1>REACT<strong>INVOICE</strong></h1>
              </Grid>
              <Grid item sx={{flexGrow: 0, pr: 2}}>
                <Link href="/?lang=lt" sx={{mr: 1}}>LT</Link>
                <Link href="/?lang=en">EN</Link>
              </Grid>
            </Grid>
          </header>
          <div className="App-content App-content-columns">
            <div className="App-invoice-list">
              <StoredInvoicesList />
            </div>

            <div className="App-invoice-form">
              <InvoiceForm />
              <PrefillCustomer isOpen={true} />
            </div>

            <div className="App-invoice-preview">
              <Invoice />
            </div>
          </div>
          <footer className="App-footer">
            <a href="https://github.com/dev-geddy/react-invoice" target="_blank">react invoice</a> by <a href="https://github.com/dev-geddy" target="_blank">dev-geddy</a>
          </footer>
        </div>
      </ThemeProvider>
    )
  }
}

export default App;
