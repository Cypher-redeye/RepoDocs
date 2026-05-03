import { useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Landing from './pages/Landing'
import Loading from './pages/Loading'
import Chat from './pages/Chat'

function App() {
  const [sessionData, setSessionData] = useState(null)

  return (
    <Router>
      <div className="font-inter min-h-screen">
        <Routes>
          <Route
            path="/"
            element={
              <Landing
                onIngest={(data) => setSessionData(data)}
              />
            }
          />
          <Route
            path="/loading"
            element={
              sessionData ? (
                <Loading
                  sessionId={sessionData.sessionId}
                  repoName={sessionData.repoName}
                  repoUrl={sessionData.repoUrl}
                  onReady={(data) => setSessionData({ ...sessionData, ...data })}
                />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route
            path="/chat"
            element={
              sessionData?.status === 'ready' ? (
                <Chat
                  sessionId={sessionData.sessionId}
                  repoName={sessionData.repoName}
                  repoUrl={sessionData.repoUrl}
                  fileTree={sessionData.fileTree || []}
                  totalChunks={sessionData.totalChunks || 0}
                  fileCount={sessionData.fileCount || 0}
                  skippedCount={sessionData.skippedCount || 0}
                  onNewRepo={() => setSessionData(null)}
                />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
        </Routes>
      </div>
    </Router>
  )
}

export default App
