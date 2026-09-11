import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import Landing from './Landing.jsx'
import Diagnose from './Diagnose.jsx'
import Screener from './Screener.jsx'

const GA_MEASUREMENT_ID = 'G-J4TJTDJHG2'

function initGA() {
  if (window.gtag) return // 이미 초기화됐으면 중복 방지

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`
  document.head.appendChild(script)

  window.dataLayer = window.dataLayer || []
  function gtag() { window.dataLayer.push(arguments) }
  window.gtag = gtag
  gtag('js', new Date())
  gtag('config', GA_MEASUREMENT_ID)
}

function App() {
  const params = new URLSearchParams(window.location.search)
  const [page] = useState(params.get('page') || 'home')

  useEffect(() => {
    initGA()
  }, [])

  useEffect(() => {
    // 페이지 전환(홈/진단/스크리너)마다 페이지뷰를 별도로 기록한다.
    if (window.gtag) {
      window.gtag('event', 'page_view', {
        page_title: page,
        page_path: `/?page=${page}`,
      })
    }
  }, [page])

  if (page === 'diagnose') return <Diagnose />
  if (page === 'screener') return <Screener />
  return <Landing />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
