const { spawn } = require('node:child_process')

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
env.VITE_DEV_SERVER_URL = env.VITE_DEV_SERVER_URL || 'http://localhost:5173'

const electronBinary = require('electron')
const child = spawn(electronBinary, ['.'], {
  env,
  stdio: 'inherit'
})

child.on('exit', (code, signal) => {
  if (code !== null) {
    process.exit(code)
    return
  }

  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(1)
})
