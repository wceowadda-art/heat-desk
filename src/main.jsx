import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import Landing from './Landing.jsx'
import Diagnose from './Diagnose.jsx'
import Screener from './Screener.jsx'

function App() {
  // URL 쿼리스트링(?page=diagnose 또는 ?page=screener)으로 화면을 전환한다.
  // 나중에 정식 라우터(react-router-dom)를 넣으면 이 부분만 바꾸면 된다.
  const params = new URLSearchParams(window.location.search)
  const [page] = useState(params.get('page') || 'home')

  if (page === 'diagnose') return <Diagnose />
  if (page === 'screener') return <Screener />
  return <Landing />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
