import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ActivityManager } from '../components/ActivityManager';
import { EntityManager } from '../components/EntityManager';

type Panel = 'entities' | 'activity' | null;

export const EntityActivitiesPage = () => {
  const [panel, setPanel] = useState<Panel>(null);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-accent-cyan">Data workspace</p>
        <h1 className="mt-1 text-3xl font-bold text-white">Entity &amp; Activities</h1>
        <p className="mt-1 text-police-400">Manage discovered entities and review activity alerts.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <button onClick={() => setPanel('entities')} className="card card-hover p-6 text-left">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300">
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white">Entity records</h2>
          <p className="mt-2 text-sm text-police-400">View, add, edit, and remove people, organizations, contacts, and other intelligence entities.</p>
          <span className="mt-5 block text-sm font-medium text-accent-cyan">Open Entity Manager</span>
        </button>

        <button onClick={() => setPanel('activity')} className="card card-hover p-6 text-left">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300">
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white">Activity alerts</h2>
          <p className="mt-2 text-sm text-police-400">Review, acknowledge, and create alerts from the investigation activity log.</p>
          <span className="mt-5 block text-sm font-medium text-accent-cyan">Open Activity Manager</span>
        </button>

        <Link to="/data-management?section=relationships" className="card card-hover p-6 text-left">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300">
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <circle cx="6" cy="12" r="3" /><circle cx="18" cy="6" r="3" /><circle cx="18" cy="18" r="3" /><path d="m8.7 10.7 6.6-3.4M8.7 13.3l6.6 3.4" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white">Relationship Entry</h2>
          <p className="mt-2 text-sm text-police-400">Link two entities with a relationship type, confidence score, and description.</p>
          <span className="mt-5 block text-sm font-medium text-accent-cyan">Open Relationship Entry</span>
        </Link>
      </div>

      {panel === 'entities' && <EntityManager onClose={() => setPanel(null)} />}
      {panel === 'activity' && <ActivityManager onClose={() => setPanel(null)} />}
    </div>
  );
};

export default EntityActivitiesPage;
