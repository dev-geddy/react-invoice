This project was bootstrapped with [Create React App](https://github.com/facebookincubator/create-react-app).

## react-invoice
I've built this app for in-browser quick invoice creation.

```
nvm use
yarn install
yarn start
```

Note: all information is stored in your Browser's LocalStorage. You may access that via Developer Tools / Application / LocalStorage.
This means no information is sent anywhere, just exists and is stored on your web browser. If you update your browser or clear all history / cache, you're likely to lose all stored invoices.

### printing

Use in-browser print functionality to print to PDF or send to your printer. Print view includes only active invoice. 

### default config

Default configuration is stored in `.env` file. In order to define your default invoice values clone `.env` into `.env.local` and modify default config values accordingly.

### deployment

If you'd like to deploy this app for yourself, you need only a simple http server (Apache, Nginx or similar). Run `yarn build` and copy `/build` directory contents to your hosting.