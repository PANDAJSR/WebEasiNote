import React from 'react'
import ReactDOM from 'react-dom/client'
import 'antd/dist/reset.css'
import { DocumentShell } from './documents/DocumentShell'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DocumentShell />
  </React.StrictMode>,
)
