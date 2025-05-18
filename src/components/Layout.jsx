import React from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';

export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white text-gray-800">
      {/* Header */}
      <header className="bg-white shadow-sm fixed w-full top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14 items-center">
            <div className="flex-shrink-0">
              <Link to="/" className="text-2xl font-bold text-green-600 hover:text-green-700 transition-colors">
                ЕдAI
              </Link>
            </div>
            <nav className="flex space-x-2">
              <button 
                onClick={() => navigate('/app')} 
                className={`p-2 rounded-full ${location.pathname === '/app' ? 'bg-green-100 text-green-600' : 'text-gray-500 hover:bg-green-100 hover:text-green-600'}`}
                title="Распознать еду"
              >
                <HomeIcon />
              </button>
              <button 
                onClick={() => navigate('/journal')} 
                className={`p-2 rounded-full ${location.pathname === '/journal' ? 'bg-green-100 text-green-600' : 'text-gray-500 hover:bg-green-100 hover:text-green-600'}`}
                title="Дневник питания"
              >
                <JournalIcon />
              </button>
              <button 
                onClick={() => navigate('/profile')} 
                className={`p-2 rounded-full ${location.pathname === '/profile' ? 'bg-green-100 text-green-600' : 'text-gray-500 hover:bg-green-100 hover:text-green-600'}`}
                title="Профиль"
              >
                <ProfileIcon />
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 pb-20 pt-14">
        {children}
      </main>
    </div>
  );
}

// SVG Icons
function HomeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}

function JournalIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
} 