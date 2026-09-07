import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { AIChatInterface } from '../components/AIChatInterface';

export const AIAssistantPage = () => {
  const { authState } = useAuth();
  const { user } = authState;
  const [contextEntity, setContextEntity] = useState<any>(null);
  const [suggestedQueries, setSuggestedQueries] = useState<string[]>([]);

  useEffect(() => {
    // Set up suggested queries based on common investigations
    setSuggestedQueries([
      "Find accounts linked to this phone number.",
      "Show connections between these two persons.",
      "Summarise the online activity of this suspect.",
      "What cryptocurrency wallets are associated with this person?",
      "Show me all social media profiles for this username.",
      "What organizations is this person connected to?",
      "Find recent locations visited by this suspect.",
      "Are there any dark web mentions for this email?",
      "Show the relationship network for this organization.",
      "What documents are associated with this person?"
    ]);
  }, []);

  const handleContextChange = (entity: any) => {
    setContextEntity(entity);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between space-x-4">
        <div>
          <h1 className="text-2xl font-bold text-gradient">AI Investigation Assistant</h1>
          <p className="text-police-400">Ask questions about entities, relationships, and investigations</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              // Clear context
              setContextEntity(null);
            }}
            className="btn-secondary px-4 py-2"
          >
            Clear Context
          </button>
          <button 
            onClick={() => {
              // New chat
              // Would clear chat history in real implementation
            }}
            className="btn-accent px-4 py-2"
          >
            New Chat
          </button>
        </div>
      </div>

      {/* Context Indicator */}
      {contextEntity && (
        <div className="flex items-center gap-3 bg-police-800/50 rounded-lg p-4">
          <div className="flex-shrink-0">
            <div className="h-8 w-8 flex items-center justify-center bg-police-900/50 rounded-lg">
              <svg className="h-5 w-5 text-accent-cyan" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 8v4l3 3"></path>
              </svg>
            </div>
          </div>
          <div className="flex-1">
            <p className="text-police-300 font-medium">Current Context:</p>
            <p className="text-white font-semibold">{contextEntity.label || contextEntity.value}</p>
            <p className="text-police-400 text-sm">
              {contextEntity.type === 'person' && (
                <>
                  {contextEntity.aliases.length > 0 && (
                    <span className="bg-police-900/50 px-2 py-0.5 rounded text-xs ml-2">
                      AKA: {contextEntity.aliases.join(', ')}
                    </span>
                  )}
                </>
              )}
            </p>
          </div>
          <button 
            onClick={() => setContextEntity(null)}
            className="text-sm text-police-400 hover:text-police-300"
          >
            ×
          </button>
        </div>
      )}

      {/* AI Chat Interface */}
      <div className="card card-hover h-[600px] flex flex-col">
        <AIChatInterface 
          user={user}
          contextEntity={contextEntity}
          onContextChange={handleContextChange}
          suggestedQueries={suggestedQueries}
        />
      </div>

      {/* Example Queries */}
      {!contextEntity && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="card card-hover p-4">
            <h3 className="text-lg font-semibold text-white mb-3">Person Investigations</h3>
            <ul className="space-y-2 text-police-400 text-sm">
              <li>• "Find all phone numbers associated with Rahul Sharma"</li>
              <li>• "Show me Priya Patel's social media profiles"</li>
              <li>• "What organizations is this person connected to?"</li>
              <li>• "Show cryptocurrency wallet transactions"</li>
            </ul>
          </div>
          <div className="card card-hover p-4">
            <h3 className="text-lg font-semibold text-white mb-3">Network Analysis</h3>
            <ul className="space-y-2 text-police-400 text-sm">
              <li>• "Show connections between these two persons"</li>
              <li>• "Map the relationship network for TechSolutions"</li>
              <li>• "Find common contacts between these entities"</li>
              <li>• "What is the strength of this relationship?"</li>
            </ul>
          </div>
          <div className="card card-hover p-4">
            <h3 className="text-lg font-semibold text-white mb-3">Financial Intelligence</h3>
            <ul className="space-y-2 text-police-400 text-sm">
              <li>• "Show all cryptocurrency wallets linked to this person"</li>
              <li>• "Find recent transactions in this wallet"</li>
              <li>• "Are there any fiat-to-crypto conversions?"</li>
              <li>• "Show exchange usage patterns"</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIAssistantPage;
