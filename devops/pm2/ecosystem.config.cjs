// @spec L2-DEVOPS-15
// pm2 app definition. fork mode / 1 instance: a deploy restart is a brief blip,
// which is accepted here. App env comes from start.sh; instance identity
// (name/dir/port) from the deploy script's env, so several instances can share
// one pm2 daemon — startOrRestart only ever touches the named app.
const name = process.env.APP_NAME || "backflip"
const dir = process.env.APP_DIR
const port = process.env.APP_PORT || "3070"

if (!dir) {
  throw new Error("APP_DIR is required (/var/www/<domain> — set by the deploy script)")
}

module.exports = {
  apps: [
    {
      name,
      script: `${dir}/devops/pm2/start.sh`,
      interpreter: "bash",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      time: true,
      env: { APP_DIR: dir, APP_PORT: port },
    },
  ],
}
