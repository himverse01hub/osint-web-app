import { useState, useEffect } from 'react';

interface AIChatInterfaceProps {
  user: any;
  contextEntity: any | null;
  onContextChange: (entity: any) => void;
  suggestedQueries: string[];
}

export const AIChatInterface = ({ 
  user, 
  contextEntity, 
  onContextChange, 
  suggestedQueries 
}: AIChatInterfaceProps) => {
  const [messages, setMessages] = useState<Array<{id: string; role: 'user' | 'assistant' | 'system'; content: string; timestamp: string; metadata?: any}>>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Add welcome message if no messages exist
    if (messages.length === 0) {
      const welcomeMsg = {
        id: 'msg_001',
        role: 'assistant' as const,
        content: `Hello Inspector ${user.name.split(' ')[0]}. I'm your AI Investigation Assistant. I can help you analyze entities, relationships, and patterns in your OSINT data. How can I assist you today?`,
        timestamp: new Date().toISOString(),
      };
      setMessages([welcomeMsg]);
    }
  }, [messages.length, user.name]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = {
      id: `msg_${Date.now()}`,
      role: 'user' as const,
      content: input,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: input,
          contextEntityId: contextEntity?.id,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Assistant request failed');

      const assistantMessage = {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant' as const,
        content: data.reply,
        timestamp: new Date().toISOString(),
        metadata: data.metadata,
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (data.metadata?.entityId && data.metadata?.confidence > 0.8) {
        onContextChange({ id: data.metadata.entityId });
      }
    } catch (error) {
      console.error('AI error:', error);
      setMessages(prev => [...prev, {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant' as const,
        content: "I apologize, but I encountered an error processing your request. Please try again or rephrase your question.",
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} 
              msg-${msg.role}`}
          >
            <div className={`max-w-[80%] px-4 py-2 rounded-lg 
              ${msg.role === 'user' 
                ? 'bg-gradient-to-r from-police-700 to-police-800 text-white' 
                : msg.role === 'assistant'
                  ? 'bg-police-800/50 text-white border border-police-700'
                  : 'bg-police-900/50 text-police-400 italic'
              }`}>
              <div className="flex items-center gap-2 mb-1">
                {msg.role === 'assistant' && (
                  <div className="h-3 w-3 rounded-full bg-accent-cyan"></div>
                )}
                {msg.role === 'user' && (
                  <div className="h-3 w-3 rounded-full bg-police-400"></div>
                )}
                <span className="text-xs text-police-400">
                  {msg.role === 'user' ? 'You' : msg.role === 'assistant' ? 'AI Assistant' : 'System'}
                </span>
                <span className="text-xs text-police-500 ml-2">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-sm leading-relaxed">
                {msg.content}
              </p>
              {msg.metadata && (
                <div className="mt-2 text-xs text-police-400">
                  {msg.metadata.type && (
                    <span className="bg-police-900/50 px-2 py-0.5 rounded mr-2">
                      {msg.metadata.type.replace('_', ' ').toUpperCase()}
                    </span>
                  )}
                  {msg.metadata.confidence && (
                    <span className="bg-police-900/50 px-2 py-0.5 rounded">
                      {(msg.metadata.confidence * 100).toFixed(0)}% Confidence
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center justify-center py-4">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-accent-cyan animate-pulse"></div>
              <span className="text-police-400 text-sm">AI is thinking...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="flex items-center gap-2 p-4 bg-police-900/50 border-t border-police-800">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask me about entities, relationships, or investigations..."
          className="input-field flex-1"
          disabled={loading}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          className="btn-primary px-4 py-2"
        >
          {loading ? 'Processing...' : 'Send'}
        </button>
      </div>

      {/* Suggested Queries */}
      {!loading && messages.length === 1 && suggestedQueries.length > 0 && (
        <div className="p-4 bg-police-900/50 border-t border-police-800">
          <p className="text-police-400 text-sm font-medium mb-2">Suggested Questions:</p>
          <div className="flex flex-wrap gap-2">
            {suggestedQueries.map((query, index) => (
              <button
                key={index}
                onClick={() => {
                  setInput(query);
                  sendMessage();
                }}
                className="text-xs text-police-400 bg-police-800/50 hover:bg-police-800 hover:text-white px-3 py-1 rounded transition-colors"
              >
                {query}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AIChatInterface;
