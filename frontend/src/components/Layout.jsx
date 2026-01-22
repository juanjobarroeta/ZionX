import Sidebar from './Sidebar'

const Layout = ({ children }) => {
  return (
    <div className="flex min-h-screen font-sans bg-white text-black">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}

export default Layout
