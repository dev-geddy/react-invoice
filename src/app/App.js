import React, { Component } from 'react';
import './App.css';
import Invoice from '../components/Invoice'
import StoredInvoicesList from "../components/StoredInvoicesList";

class App extends Component {
  render() {
    return (
      <div className="App">
        <header className="App-header">
          <h1>REACTIVE<strong>LABS</strong></h1>
        </header>
        <div className="App-content App-content-columns">
          <StoredInvoicesList />

          <div className="App-invoice-form">

          </div>
          <div className="App-invoice-preview">
            <Invoice />
          </div>
        </div>
        <footer className="App-footer">
          &copy;2021
        </footer>
      </div>
    )
  }
}

export default App;
