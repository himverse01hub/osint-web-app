import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export const SettingsPage = () => {
  const { authState } = useAuth();
  const { user } = authState;
  const [profileLoading, setProfileLoading] = useState(false);
  const [securityLoading, setSecurityLoading] = useState(false);
  const [systemLoading, setSystemLoading] = useState(false);
  const [notifications, setNotifications] = useState({
    emailAlerts: true,
    pushNotifications: true,
    weeklySummary: true,
    criticalAlerts: true,
  });
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [language, setLanguage] = useState<'en' | 'hi'>('en');

  const handleSaveProfile = async () => {
    setProfileLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      // In real app, would save to database
      alert('Profile saved successfully!');
    } catch (error) {
      alert('Failed to save profile. Please try again.');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleSaveSecurity = async () => {
    setSecurityLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      // In real app, would save to database
      alert('Security settings saved successfully!');
    } catch (error) {
      alert('Failed to save security settings. Please try again.');
    } finally {
      setSecurityLoading(false);
    }
  };

  const handleSaveSystem = async () => {
    setSystemLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      // In real app, would save to database
      alert('System settings saved successfully!');
    } catch (error) {
      alert('Failed to save system settings. Please try again.');
    } finally {
      setSystemLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between space-x-4">
        <div>
          <h1 className="text-2xl font-bold text-gradient">Settings</h1>
          <p className="text-police-400">Configure your account and system preferences</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              // Reset to defaults
            }}
            className="btn-secondary px-4 py-2"
          >
            Reset to Defaults
          </button>
        </div>
      </div>

      {/* Settings Tabs */}
      <div className="flex border-b border-police-700 mb-6">
        <button
          onClick={() => {
            // Would set active tab in real implementation
          }}
          className="flex-1 py-3 text-center font-medium text-police-400 hover:bg-police-800/50 hover:text-white"
        >
          Profile
        </button>
        <button
          onClick={() => {
            // Would set active tab in real implementation
          }}
          className="flex-1 py-3 text-center font-medium text-police-400 hover:bg-police-800/50 hover:text-white"
        >
          Security
        </button>
        <button
          onClick={() => {
            // Would set active tab in real implementation
          }}
          className="flex-1 py-3 text-center font-medium text-police-400 hover:bg-police-800/50 hover:text-white"
        >
          System
        </button>
        <button
          onClick={() => {
            // Would set active tab in real implementation
          }}
          className="flex-1 py-3 text-center font-medium text-police-400 hover:bg-police-800/50 hover:text-white"
        >
          Notifications
        </button>
      </div>

      {/* Profile Settings */}
      <div className="space-y-6">
        <div className="card card-hover p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Profile Information</h3>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="full-name" className="block text-sm font-medium text-police-300 mb-2">
                  Full Name
                </label>
                <input
                  id="full-name"
                  type="text"
                  className="input-field w-full"
                  defaultValue={user.name}
                />
              </div>
              <div>
                <label htmlFor="badge-number" className="block text-sm font-medium text-police-300 mb-2">
                  Badge Number
                </label>
                <input
                  id="badge-number"
                  type="text"
                  className="input-field w-full"
                  defaultValue={user.badgeNumber}
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-police-300 mb-2">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  className="input-field w-full"
                  defaultValue={user.email}
                />
              </div>
              <div>
                <label htmlFor="department" className="block text-sm font-medium text-police-300 mb-2">
                  Department
                </label>
                <input
                  id="department"
                  type="text"
                  className="input-field w-full"
                  defaultValue={user.department}
                />
              </div>
              <div>
                <label htmlFor="rank" className="block text-sm font-medium text-police-300 mb-2">
                  Rank
                </label>
                <input
                  id="rank"
                  type="text"
                  className="input-field w-full"
                  defaultValue={user.rank}
                />
              </div>
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-police-300 mb-2">
                  Phone Number
                </label>
                <input
                  id="phone"
                  type="tel"
                  className="input-field w-full"
                  placeholder="+91-XXXXXXXXXX"
                />
              </div>
            </div>
            
            <div className="flex items-center justify-between mt-6">
              <button 
                onClick={handleSaveProfile}
                disabled={profileLoading}
                className="btn-primary px-6 py-2"
              >
                {profileLoading ? 'Saving...' : 'Save Profile'}
              </button>
              <button 
                onClick={() => {
                  // Change password
                }}
                className="btn-secondary px-6 py-2"
              >
                Change Password
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Security Settings */}
      <div className="space-y-6">
        <div className="card card-hover p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Security Settings</h3>
          </div>
          <div className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-police-400">Session Timeout</span>
                <select className="input-field w-32">
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="240">4 hours</option>
                  <option value="1440">1 day</option>
                </select>
              </div>
              
              <div className="flex items-center justify-between mt-4">
                <span className="text-police-400">Login Attempts Lockout</span>
                <select className="input-field w-32">
                  <option value="3">3 attempts</option>
                  <option value="5">5 attempts</option>
                  <option value="10">10 attempts</option>
                  <option value="unlimited">Unlimited</option>
                </select>
              </div>
              
              <div className="flex items-center justify-between mt-4">
                <span className="text-police-400">Two-Factor Authentication</span>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-accent-cyan focus:ring-police-500 border-police-600 rounded"
                  />
                  <span className="text-police-300">Enabled</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between mt-4">
                <span className="text-police-400">Password Policy</span>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-accent-cyan focus:ring-police-500 border-police-600 rounded"
                    checked
                  />
                  <span className="text-police-300">Strong passwords required</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between mt-6">
              <button 
                onClick={handleSaveSecurity}
                disabled={securityLoading}
                className="btn-primary px-6 py-2"
              >
                {securityLoading ? 'Saving...' : 'Save Security Settings'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* System Settings */}
      <div className="space-y-6">
        <div className="card card-hover p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">System Settings</h3>
          </div>
          <div className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-police-400">Theme</span>
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    value="dark"
                    checked={theme === 'dark'}
                    onChange={(e) => setTheme(e.target.value)}
                    className="h-4 w-4 text-accent-cyan focus:ring-police-500"
                  />
                  <span className="text-police-300">Dark</span>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <input
                    type="radio"
                    value="light"
                    checked={theme === 'light'}
                    onChange={(e) => setTheme(e.target.value)}
                    className="h-4 w-4 text-accent-cyan focus:ring-police-500"
                  />
                  <span className="text-police-300">Light</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between mt-4">
                <span className="text-police-400">Language</span>
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    value="en"
                    checked={language === 'en'}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="h-4 w-4 text-accent-cyan focus:ring-police-500"
                  />
                  <span className="text-police-300">English</span>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <input
                    type="radio"
                    value="hi"
                    checked={language === 'hi'}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="h-4 w-4 text-accent-cyan focus:ring-police-500"
                  />
                  <span className="text-police-300">Hindi</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between mt-4">
                <span className="text-police-400">Date Format</span>
                <select className="input-field w-48">
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </select>
              </div>
              
              <div className="flex items-center justify-between mt-4">
                <span className="text-police-400">Time Zone</span>
                <select className="input-field w-48">
                  <option value="IST">India Standard Time (UTC+5:30)</option>
                  <option value="GMT">Greenwich Mean Time (UTC+0)</option>
                  <option value="EST">Eastern Standard Time (UTC-5)</option>
                  <option value="PST">Pacific Standard Time (UTC-8)</option>
                </select>
              </div>
            </div>
            
            <div className="flex items-center justify-between mt-6">
              <button 
                onClick={handleSaveSystem}
                disabled={systemLoading}
                className="btn-primary px-6 py-2"
              >
                {systemLoading ? 'Saving...' : 'Save System Settings'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications Settings */}
      <div className="space-y-6">
        <div className="card card-hover p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Notification Preferences</h3>
          </div>
          <div className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-police-400">Email Alerts</span>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={notifications.emailAlerts}
                    onChange={(e) => setNotifications(prev => ({ ...prev, emailAlerts: e.target.checked }))}
                    className="h-4 w-4 text-accent-cyan focus:ring-police-500 border-police-600 rounded"
                  />
                  <span className="text-police-300">Receive alerts via email</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between mt-4">
                <span className="text-police-400">Push Notifications</span>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={notifications.pushNotifications}
                    onChange={(e) => setNotifications(prev => ({ ...prev, pushNotifications: e.target.checked }))}
                    className="h-4 w-4 text-accent-cyan focus:ring-police-500 border-police-600 rounded"
                  />
                  <span className="text-police-300">Browser push notifications</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between mt-4">
                <span className="text-police-400">Weekly Summary</span>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={notifications.weeklySummary}
                    onChange={(e) => setNotifications(prev => ({ ...prev, weeklySummary: e.target.checked }))}
                    className="h-4 w-4 text-accent-cyan focus:ring-police-500 border-police-600 rounded"
                  />
                  <span className="text-police-300">Weekly activity summary</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between mt-4">
                <span className="text-police-400">Critical Alerts Only</span>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={notifications.criticalAlerts}
                    onChange={(e) => setNotifications(prev => ({ ...prev, criticalAlerts: e.target.checked }))}
                    className="h-4 w-4 text-accent-cyan focus:ring-police-500 border-police-600 rounded"
                  />
                  <span className="text-police-300">Only notify for critical alerts</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between mt-6">
              <button 
                onClick={() => {
                  // Save notification preferences
                }}
                className="btn-primary px-6 py-2"
              >
                Save Notification Preferences
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* System Information */}
      <div className="space-y-6">
        <div className="card card-hover p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">System Information</h3>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-police-400 text-sm">Version</p>
                <p className="text-white font-medium">1.0.0</p>
              </div>
              <div>
                <p className="text-police-400 text-sm">Build Date</p>
                <p className="text-white font-medium">January 2024</p>
              </div>
              <div>
                <p className="text-police-400 text-sm">Environment</p>
                <p className="text-white font-medium">Production</p>
              </div>
              <div>
                <p className="text-police-400 text-sm">Database</p>
                <p className="text-white font-medium">PostgreSQL 13</p>
              </div>
              <div>
                <p className="text-police-400 text-sm">Last Backup</p>
                <p className="text-white font-medium">Today, 02:30 AM</p>
              </div>
              <div>
                <p className="text-police-400 text-sm">Uptime</p>
                <p className="text-white font-medium">99.9%</p>
              </div>
              <div>
                <p className="text-police-400 text-sm">Active Users</p>
                <p className="text-white font-medium">12</p>
              </div>
              <div>
                <p className="text-police-400 text-sm">Storage Used</p>
                <p className="text-white font-medium">2.4 GB / 100 GB</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
