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
      // Simulate AI processing delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Generate AI response based on input and context
      const aiResponse = generateAIResponse(input, contextEntity);
      
      const assistantMessage = {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant' as const,
        content: aiResponse.content,
        timestamp: new Date().toISOString(),
        metadata: aiResponse.metadata,
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      // If response contains entity references, offer to set context
      if (aiResponse.metadata?.entityId) {
        // In a real app, we might ask user if they want to set context
        // For demo, we'll auto-set if high confidence
        if (aiResponse.metadata.confidence > 0.8) {
          // Would fetch entity and set context
          // onContextChange(entity);
        }
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

  const generateAIResponse = (query: string, context: any | null) => {
    const queryLower = query.toLowerCase();
    
    // Mock AI responses based on query patterns
    if (queryLower.includes('phone') && queryLower.includes('linked') || 
        queryLower.includes('accounts') && queryLower.includes('phone')) {
      return {
        content: "Based on the available data, I found the following phone number associations:\n\n• +91-9876543210 is linked to: rahul.sharma@example.com, rahuls_sharma_786 (Facebook)\n• +91-8765432109 is linked to: money.maker99@protonmail.com\n• +91-9876509876 is linked to: priya.patel@techsolutions.com\n• +91-7654321098 is linked to: priya.investments@gmail.com\n\nWould you like me to show detailed profiles for any of these phone numbers or their associated accounts?",
        metadata: {
          type: 'phone_lookup',
          confidence: 0.9
        }
      };
    }
    
    if (queryLower.includes('connections') && queryLower.includes('between') || 
        queryLower.includes('relationship') && queryLower.includes('these two')) {
      return {
        content: "I can analyze connections between entities. To show connections between two specific persons, I need to know which entities you're interested in.\n\nBased on current context and available data, here are some notable connections:\n\n• Rahul Sharma and Priya Patel are business partners (co-founders of TechSolutions Innovations)\n• They share a cryptocurrency wallet (USDC) with 15,750 USDC balance\n• Both are connected to the same organization (TechSolutions Innovations Pvt. Ltd.)\n• Rahul Sharma's phone (+91-9876543210) is linked to his email (rahul.sharma@example.com)\n• Priya Patel's phone (+91-9876509876) is linked to her work email (priya.patel@techsolutions.com)\n\nPlease specify which two persons or entities you'd like me to analyze for connections.",
        metadata: {
          type: 'relationship_analysis',
          confidence: 0.85
        }
      };
    }
    
    if (queryLower.includes('summarise') || queryLower.includes('summarize') || 
        queryLower.includes('online activity') || queryLower.includes('activity')) {
      return {
        content: "Here's a summary of online activity based on available data:\n\n**Rahul Sharma:**\n- Facebook: rahuls_sharma_786 (1,240 followers, 890 following, 234 posts)\n- Bitcointalk Forum: money_maker_99 (active in cryptocurrency discussions)\n- Email: rahul.sharma@example.com (breached in Example.com 2023 incident)\n- Email: money.maker99@protonmail.com (associated with cryptocurrency transactions)\n\n**Priya Patel:**\n- LinkedIn: priya_patel_finance (Financial Analyst, 890 followers, verified)\n- Twitter: crypto_priya (2,150 followers, 980 following, 567 posts)\n- Email: priya.patel@techsolutions.com (work email)\n- Email: priya.investments@gmail.com (personal Gmail)\n\nBoth subjects show active participation in cryptocurrency-related forums and social media platforms. Rahul Sharma appears to have a broader social media presence, while Priya Patel maintains more professional networking profiles.",
        metadata: {
          type: 'activity_summary',
          confidence: 0.88
        }
      };
    }
    
    if (queryLower.includes('cryptocurrency') || queryLower.includes('crypto wallet') || 
        queryLower.includes('wallet')) {
      return {
        content: "I found the following cryptocurrency wallet associations:\n\n**Rahul Sharma:**\n- Ethereum: 0x742d35Cc6634C0532925a3b8D4C0532950532950\n  • Balance: 2.45 ETH (~$4,250)\n  • Transactions: 156\n  • Exchanges: Binance, WazirX, Coinbase\n\n**Priya Patel:**\n- Bitcoin: 0x8ba1f109551bD432803012645Hac136c22C501e6\n  • Balance: 0.15 BTC (~$6,200)\n  • Transactions: 89\n  • Exchanges: CoinDCX, ZebPay, Kraken\n\n**Shared Wallet:**\n- USDC: 0xa0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48\n  • Balance: 15,750 USDC\n  • Transactions: 234\n  • Accessed by: Both Rahul Sharma and Priya Patel\n  • Exchanges: Binance, Huobi\n\nThe shared USDC wallet shows significant recent activity, suggesting ongoing financial coordination between the subjects.",
        metadata: {
          type: 'crypto_analysis',
          confidence: 0.92
        }
      };
    }
    
    if (queryLower.includes('social media') || queryLower.includes('profile') || 
        queryLower.includes('username')) {
      return {
        content: "Here are the social media profiles found in the database:\n\n**Rahul Sharma:**\n- Facebook: https://facebook.com/rahul.sharma.786\n  • Display Name: Rahul Sharma\n  • Bio: Business entrepreneur | Crypto trader\n  • Followers: 1,240 | Following: 890 | Posts: 234\n  • Verified: No\n\n**Priya Patel:**\n- LinkedIn: https://linkedin.com/in/priya-patel-finance\n  • Display Name: Priya Patel\n  • Bio: Financial Analyst | Investment Specialist\n  • Followers: 890 | Following: 450 | Posts: 67\n  • Verified: Yes\n- Twitter: https://twitter.com/crypto_priya\n  • Display Name: Priya Patel\n  • Bio: Crypto enthusiast | DeFi investor\n  • Followers: 2,150 | Following: 980 | Posts: 567\n  • Verified: No\n\n**Forum Presence:**\n- Bitcointalk: money_maker_99 (associated with Rahul Sharma)\n  • Activity: Cryptocurrency trading and ICO discussions\n\nWould you like me to analyze any of these profiles in more detail or check for additional platforms?",
        metadata: {
          type: 'social_media_summary',
          confidence: 0.9
        }
      };
    }
    
    // Default response for unrecognized queries
    return {
      content: "I understand you're asking about: \"" + query + "\"\n\nI can help you with:\n• Finding accounts linked to phone numbers or emails\n• Showing connections between persons or entities\n• Summarizing online activity and social media presence\n• Analyzing cryptocurrency wallet transactions and associations\n• Reviewing social media profiles and forum participation\n• Generating relationship networks and investigative leads\n\nCould you please rephrase your question or try one of the suggested queries below?",
      metadata: {
        type: 'clarification_needed',
        confidence: 0.6
      }
    };
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
