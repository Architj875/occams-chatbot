import React, { useState, useRef, useEffect } from 'react';
import { Send, BotMessageSquare } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Interface for URL metadata (kept for potential future use)
interface URLMetadata {
  url: string;
  title: string;
  description: string;
  image: string;
  favicon: string;
}

// Backend server URL
const SERVER_URL = "http://localhost:3000";

// Interface for chat messages
interface Message {
  text: string;
  isUser: boolean;
  urls?: string[];
  metadata?: URLMetadata[];
}

// Simple Loading Indicator Component
const LoadingIndicator = () => (
  <div className="flex justify-start animate-fade-in">
    <div className="rounded-2xl p-4 max-w-[80%] backdrop-blur-lg bg-black/40 text-gray-100 shadow-[0_0_15px_rgba(0,0,0,0.1)]">
      <div className="flex space-x-1 items-center">
        <span className="text-gray-400 text-sm"></span>
        <div className="w-1.5 h-1.5 bg-purple-300 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
        <div className="w-1.5 h-1.5 bg-purple-300 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        <div className="w-1.5 h-1.5 bg-purple-300 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
      </div>
    </div>
  </div>
);


function App() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      text: "Hi! I'm Occam's Advisory assistant 🧙‍♂️. How can I help you today?",
      isUser: false
    }
  ]);
  const [status, setStatus] = useState('Connecting...');
  const [socket, setSocket] = useState<Socket | null>(null);
  // **NEW**: State to track loading status
  const [isLoading, setIsLoading] = useState(false);

  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Helper function to scroll chat to bottom
  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  // Effect to establish Socket.IO connection
  useEffect(() => {
    const newSocket = io(SERVER_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => console.log('Connected to server:', newSocket.id));
    newSocket.on('disconnect', () => {
      console.warn('Disconnected from server.');
      setStatus('Disconnected. Trying to reconnect...');
      setIsLoading(false); // Stop loading if disconnected
    });
    newSocket.on('connect_error', (err) => {
      console.error("Connection Error:", err);
      setStatus('Failed to connect to the server.');
      setIsLoading(false); // Stop loading on connection error
    });
    newSocket.on('status', (msg: string) => {
      console.log('Status update:', msg);
      setStatus(msg);
    });
    newSocket.on('bot_response', (responseText: string) => {
      // **CHANGED**: Set loading to false when response is received
      setIsLoading(false);
      setMessages(prev => [...prev, { text: responseText, isUser: false, urls: [] }]);
    });

    // Cleanup on unmount
    return () => {
      console.log('Disconnecting socket...');
      newSocket.disconnect();
    };
  }, []); // Empty dependency array ensures this runs only once

  // Effect to scroll to the bottom whenever messages or loading state change
  useEffect(() => {
    const timer = setTimeout(() => {
        scrollToBottom();
    }, 100);
    return () => clearTimeout(timer);
  }, [messages, isLoading]); // Add isLoading as a dependency

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedMessage = message.trim();
    if (!trimmedMessage || !socket || isLoading) return; // Prevent sending while loading

    // Add user message
    setMessages(prev => [...prev, { text: trimmedMessage, isUser: true }]);

    // **CHANGED**: Set loading to true
    setIsLoading(true);

    // Emit message to server
    socket.emit('user_message', trimmedMessage);

    // Clear input
    setMessage('');
  };

  // Handle Enter key press
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        handleSubmit(e as unknown as React.FormEvent);
    }
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 bg-gradient-animate flex flex-col h-screen overflow-hidden">
      {/* Top Bar */}
      <div className="w-full bg-black/30 backdrop-blur-xl border-b border-purple-500/20 sticky top-0 z-10 flex-shrink-0">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <BotMessageSquare className="w-8 h-8 text-purple-400" />
            <span className="text-2xl font-semibold bg-gradient-to-r from-purple-200 to-purple-400 bg-clip-text text-transparent">
              Occam's Advisory Assistant
            </span>
          </div>
           <div className={`text-xs px-2 py-1 rounded ${status.toLowerCase().includes('error') || status.toLowerCase().includes('failed') || status.toLowerCase().includes('disconnect') ? 'bg-red-500/30 text-red-200' : 'bg-green-500/30 text-green-200'}`}>
             {status}
           </div>
        </div>
      </div>

      {/* Chat area */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 mx-auto w-full max-w-4xl scroll-smooth custom-scrollbar"
      >
        {/* Render existing messages */}
        {messages.map((msg, idx) => (
          <div key={idx} className="animate-fade-in">
            <div
              className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`prose prose-sm prose-invert max-w-none rounded-2xl p-4 backdrop-blur-lg ${
                  msg.isUser
                    ? 'bg-purple-600/20 text-purple-50 shadow-[0_0_15px_rgba(147,51,234,0.1)]'
                    : 'bg-black/40 text-gray-100 shadow-[0_0_15px_rgba(0,0,0,0.1)]'
                }`}
              >
                {msg.isUser ? (
                  <p className="whitespace-pre-wrap m-0">{msg.text}</p>
                ) : (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      a: ({node, ...props}) => <a {...props} target="_blank" rel="noopener noreferrer" className="text-purple-300 hover:text-purple-200 underline" />
                    }}
                  >
                    {msg.text}
                  </ReactMarkdown>
                )}
              </div>
            </div>
          </div>
        ))}
        {/* **NEW**: Conditionally render loading indicator */}
        {isLoading && <LoadingIndicator />}
      </div>

      {/* Message input section */}
      <div className="bg-transparent backdrop-blur-sm p-4 w-full sticky bottom-0 border-t border-purple-500/10 z-10 flex-shrink-0">
        <div className="max-w-4xl mx-auto">
          <form
            onSubmit={handleSubmit}
            className="flex items-center space-x-4"
          >
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={isLoading ? "Waiting for response..." : `Ask about Occam's Advisory...`} // Change placeholder while loading
              className="flex-1 rounded-2xl border border-purple-500/30 bg-black/20 px-4 py-3 text-purple-50 placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-transparent backdrop-blur-sm disabled:opacity-60" // Added disabled style
              disabled={!socket || !socket.connected || status.toLowerCase().includes('error') || isLoading} // Disable input while loading
            />
            <button
              type="submit"
              className="bg-purple-600/80 backdrop-blur-sm text-white rounded-2xl px-6 py-3 hover:bg-purple-500/80 transition-all duration-200 flex items-center space-x-2 shadow-[0_0_15px_rgba(147,51,234,0.3)] hover:shadow-[0_0_20px_rgba(147,51,234,0.4)] disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!socket || !socket.connected || status.toLowerCase().includes('error') || isLoading} // Disable button while loading
            >
              <span>Send</span>
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default App;
