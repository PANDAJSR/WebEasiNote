const { app, BrowserWindow } = require('electron')
const path = require('node:path')

function createWindow() {
  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  const devServerUrl = process.env.VITE_DEV_SERVER_URL

  win.once('ready-to-show', () => {
    win.show()
    win.focus()
  })

  win.webContents.on('did-fail-load', (_event: unknown, code: number, description: string, url: string) => {
    console.error('[Electron] 页面加载失败', { code, description, url })
  })

  if (devServerUrl) {
    win.loadURL(devServerUrl)
    return
  }

  win.loadFile(path.join(__dirname, '../dist/index.html'))
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
