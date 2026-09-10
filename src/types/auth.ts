export interface User {
  id: string;
  name: string;
  email: string;
  username?: string;
  badgeNumber: string;
  phone?: string;
  role: 'admin' | 'investigator' | 'analyst' | 'supervisor';
  department: string;
  rank: string;
  avatar?: string;
  lastLogin: string;
  permissions: Permission[];
}

export type Permission =
  | 'dashboard.view'
  | 'search.execute'
  | 'profile.view'
  | 'profile.edit'
  | 'graph.view'
  | 'graph.edit'
  | 'darkweb.view'
  | 'reports.generate'
  | 'reports.export'
  | 'alerts.view'
  | 'alerts.manage'
  | 'audit.view'
  | 'settings.manage'
  | 'users.manage';

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}