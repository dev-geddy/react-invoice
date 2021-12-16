## [react-invoice](https://react-invoice-nu.vercel.app/)
I've built this app for in-browser quick invoice creation. You can start using it here: [https://react-invoice-nu.vercel.app/](https://react-invoice-nu.vercel.app/).

You'll need [NVM](https://github.com/nvm-sh/nvm) to run this JS app (or [Node](https://nodejs.org/) v16).

Install relevant Node version by running `nvm install 16`. Once Node is installed run below commands within the project directory. 

```
nvm use
yarn install
yarn start
```

Note: all information is stored in your Browser's LocalStorage. You may access that via Developer Tools / Application / LocalStorage.
This means no information is sent anywhere, just exists and is stored on your web browser. If you update your browser or clear all history / cache, you're likely to lose all stored invoices.

### What it looks like

Demo is available here: [https://react-invoice-nu.vercel.app/](https://react-invoice-nu.vercel.app/).

![React Invoice Screenshot](docs/react-invoice-window.png?raw=true "React Invoice Screenshot")

### Printing

Use in-browser print functionality to print to PDF or send to your printer. Print view includes only active invoice.

![React Invoice Print Preview](docs/react-invoice-print-preview.png?raw=true "React Invoice Screenshot")

### Default config

Default configuration is stored in `.env` file. In order to define your default invoice values clone `.env` into `.env.local` and modify default config values accordingly.

### Deployment

If you'd like to deploy this app for yourself, you need only a simple http server (Apache, Nginx or similar). Run `yarn build` and copy `/build` directory contents to your hosting.
