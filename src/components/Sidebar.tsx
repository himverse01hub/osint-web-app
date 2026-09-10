import { Link, useLocation } from 'react-router-dom';

export const Sidebar = () => {
  const location = useLocation();
  
  const menuItems = [
    { icon: 'dashboard', label: 'Dashboard', path: '/dashboard' },
    { icon: 'folder', label: 'Case Management', path: '/cases' },
    { icon: 'users', label: 'Entity & Activities', path: '/entity-activities' },
    { icon: 'search', label: 'OSINT Search', path: '/search' },
    { icon: 'message-square', label: 'AI Assistant', path: '/assistant' },
    { icon: 'git-graph', label: 'Knowledge Graph', path: '/graph' },
    { icon: 'file-text', label: 'Reports', path: '/reports' },
    { icon: 'settings', label: 'Settings', path: '/settings' },
  ];

  return (
    <aside className="flex min-h-[calc(100vh-73px)] w-64 flex-col border-r border-police-800 bg-police-900/80 backdrop-blur-sm">
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 bg-police-800/50 rounded-lg flex items-center justify-center">
            <svg className="h-6 w-6 text-accent-cyan" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-white">Haryana Police</h2>
        </div>
        <nav className="space-y-1">
          {menuItems.map((item, index) => (
            <Link 
              key={index}
              to={item.path}
              className={`sidebar-link ${location.pathname.startsWith(item.path) && item.path !== '/' ? 'active' : ''}`}
            >
              <div className="flex items-center gap-3">
                <svg className="h-5 w-5 text-police-400 group-hover:text-white transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {item.icon === 'dashboard' && <><circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path></>}
                  {item.icon === 'search' && <><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></>}
                  {item.icon === 'users' && <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></>}
                  {item.icon === 'folder' && <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>}
                  {item.icon === 'message-square' && <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>}
                  {item.icon === 'git-graph' && <><path d="M8 14a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2z"></path><path d="M20 8v8"></path><path d="M4 8v8"></path></>}
                  {item.icon === 'moon' && <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>}
                  {item.icon === 'file-text' && <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></>}
                  {item.icon === 'bell' && <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></>}
                  {item.icon === 'clipboard' && <><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v2"></path></>}
                  {item.icon === 'settings' && <><circle cx="12" cy="12" r="10"></circle><path d="M12 15v5"></path><path d="M12 6v3"></path><path d="M6.343 18.343l-.707-.707"></path><path d="M17.657 17.657l-.707-.707"></path><path d="M6.343 5.657l.707.707"></path><path d="M17.657 6.343l.707.707"></path></>}
                </svg>
                <span className="text-police-300 group-hover:text-white transition-colors font-medium">{item.label}</span>
              </div>
            </Link>
          ))}
        </nav>
      </div>
      <div className="mt-auto px-4 pb-4">
        <div className="text-center text-police-500 text-xs">
          <p>Version 1.0.0</p>
          <p className="mt-1">For Authorized Use Only</p>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
