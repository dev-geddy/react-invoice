import React, { Component } from 'react';
import './App.css';
import Invoice from '../components/Invoice'

class App extends Component {
  render() {
    return (
      <div className="App">
        <header className="App-header">

        </header>
        <div className="App-content">
          <Invoice />
        </div>
        <footer>

        </footer>
      </div>
    );
  }
}

export default App;
