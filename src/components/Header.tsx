import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const Header = ({ user }: { user: any }) => {
  const { logout } = useAuth();

  return (
    <header className="bg-police-900/80 backdrop-blur-sm border-b border-police-800">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0">
            <svg className="h-8 w-8 text-accent-cyan" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gradient">Haryana Police OSINT</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <button className="flex items-center gap-2 text-police-300 hover:text-white transition-colors">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <span className="hidden md:inline">Notifications</span>
            </button>
            <div className="absolute -top-2 -right-2 w-3 h-3 bg-red-500 rounded-full"></div>
          </div>
          <div className="flex items-center gap-3">
            <img 
              src={user.avatar || 'https://ui-avatars.com/api/?name=User&background=0d1e33&color=00d4ff'} 
              alt="User avatar" 
              className="h-10 w-10 rounded-lg border border-police-700"
            />
            <div>
              <p className="text-white font-medium">{user.name}</p>
              <p className="text-police-400 text-sm">{user.rank} | {user.department}</p>
            </div>
          </div>
          <button 
            onClick={logout}
            className="btn-danger hover:bg-gradient-to-r from-red-500 to-red-600"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
