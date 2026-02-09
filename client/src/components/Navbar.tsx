import { Link } from 'react-router-dom';

interface NavbarProps {
  currentPath: string;
  userEmail?: string;
  onLogout: () => void;
}

export default function Navbar({ currentPath, userEmail, onLogout }: NavbarProps) {
  const isActive = (path: string) => currentPath === path;

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Navbar.tsx:12',message:'Navbar component rendering',data:{currentPath,hasUserEmail:!!userEmail},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const target = e.target as HTMLImageElement;
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Navbar.tsx:handleImageError',message:'Logo image error',data:{src:target.src,attemptedSrc:target.src.includes('s2-logo.png')?'s2-logo.png':'logo.png'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    if (!target.src.includes('s2-logo.png')) {
      target.src = '/logo.png';
    }
  };

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    // #region agent log
    const target = e.target as HTMLImageElement;
    fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Navbar.tsx:handleImageLoad',message:'Logo image loaded successfully',data:{src:target.src,width:target.naturalWidth,height:target.naturalHeight},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
  };

  return (
    <nav className="bg-white shadow-md border-b border-gray-200 relative z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-32 py-3">
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
              <img 
                src="/s2-logo.png" 
                alt="S-2 International Logo" 
                className="h-24 w-24 sm:h-28 sm:w-28 md:h-32 md:w-32 object-contain mr-3"
                onError={handleImageError}
                onLoad={handleImageLoad}
              />
              <span className="text-sm text-gray-500 font-medium hidden sm:inline">Shipping Portal</span>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              <Link
                to="/"
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-semibold transition-colors ${
                  isActive('/')
                    ? 'border-s2-red text-s2-red'
                    : 'border-transparent text-gray-600 hover:border-s2-red hover:text-s2-red'
                }`}
              >
                Get Rates
              </Link>
              {/*
                History navigation is disabled per client request.
                To restore it in the future, uncomment the block below.

              <Link
                to="/history"
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-semibold transition-colors h-16 ${
                  isActive('/history')
                    ? 'border-s2-red text-s2-red'
                    : 'border-transparent text-gray-600 hover:border-s2-red hover:text-s2-red'
                }`}
              >
                History
              </Link>
              */}
            </div>
          </div>
          <div className="flex items-center">
            <span className="text-sm text-gray-700 mr-4">{userEmail}</span>
            <button
              onClick={onLogout}
              className="text-sm text-gray-600 hover:text-s2-red transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}