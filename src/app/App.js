import React, { Component } from 'react';
import './App.css';
import Invoice from '../components/Invoice'

class App extends Component {
  render() {
    return (
      <div className="App">
        <header className="App-header">

        </header>
        <div className="App-content App-content-columns">
          <div className="App-invoice-list">
            <ul className="App-invoice-list-items">
              <li><a href="#">Item</a></li>
              <li><a href="#">Item</a></li>
              <li><a href="#">Item</a></li>
              <li><a href="#">Item</a></li>
              <li><a href="#">Item</a></li>
            </ul>
          </div>
          <div className="App-invoice-form">

          </div>
          <div className="App-invoice-preview">
            <Invoice />
          </div>
        </div>
        <footer>

        </footer>
      </div>
    )
  }
}

export default App;
