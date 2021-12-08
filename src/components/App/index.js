import React, { PureComponent } from 'react'
import CssBaseline from "@mui/material/CssBaseline"
import {createTheme, ThemeProvider} from "@mui/material/styles"
import './App.css'
import Invoice from '../Invoice'
import StoredInvoicesList from "../StoredInvoicesList"
import InvoiceForm from "../InvoiceForm"

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
            <h1>REACTIVE<strong>LABS</strong></h1>
          </header>
          <div className="App-content App-content-columns">
            <div className="App-invoice-list">
              <StoredInvoicesList />
            </div>

            <div className="App-invoice-form">
              <InvoiceForm />
            </div>

            <div className="App-invoice-preview">
              <Invoice />
            </div>
          </div>
          <footer className="App-footer">
            &copy;2021
          </footer>
        </div>
      </ThemeProvider>
    )
  }
}

export default App;
