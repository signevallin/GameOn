'use client';
import { useState, useRef, useEffect } from 'react';

type Message = { role: 'user' | 'assistant'; content: string };

const WELCOME: Message = {
  role: 'assistant',
  content: "Hi! I can answer questions about Rivalry — features, pricing, or how to get started. What would you like to know?",
};

const ERROR_MSG = "Sorry, something went wrong. Email us at hello@playgameon.app";

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: 'user', content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next.slice(-10) }),
      });
      if (!res.ok) throw new Error(res.statusText);
      const data = await res.json();
      const reply = data.reply || ERROR_MSG;
      setMessages(m => [...m, { role: 'assistant', content: reply }]);
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: ERROR_MSG }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Chat panel */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 88, right: 24, width: 340, height: 480,
          background: '#131F2E', border: '1px solid rgba(124,189,212,0.15)',
          borderRadius: 16, display: 'flex', flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)', zIndex: 9999,
          fontFamily: "'Sora', sans-serif",
        }}>
          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg,#7CBDD4,#4890aa)',
            padding: '12px 16px', borderRadius: '16px 16px 0 0',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'rgba(13,21,32,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#DCE4EE" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <div>
                <div style={{ color: '#0D1520', fontWeight: 700, fontSize: 13 }}>Rivalry Support</div>
                <div style={{ color: 'rgba(13,21,32,0.6)', fontSize: 11 }}>Powered by AI</div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{ background: 'none', border: 'none', color: '#0D1520', fontSize: 20, cursor: 'pointer', opacity: 0.6, lineHeight: 1, padding: '0 4px' }}
              aria-label="Close chat"
            >×</button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: 8, alignItems: 'flex-start' }}>
                {msg.role === 'assistant' && (
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                    background: 'linear-gradient(135deg,#7CBDD4,#4890aa)',
                  }} />
                )}
                <div style={{
                  maxWidth: 230,
                  background: msg.role === 'assistant' ? 'rgba(255,255,255,0.06)' : 'rgba(124,189,212,0.15)',
                  border: msg.role === 'user' ? '1px solid rgba(124,189,212,0.2)' : 'none',
                  borderRadius: msg.role === 'assistant' ? '4px 12px 12px 12px' : '12px 4px 12px 12px',
                  padding: '9px 12px',
                }}>
                  <p style={{ color: '#DCE4EE', fontSize: 13, lineHeight: 1.6, margin: 0 }}>{msg.content}</p>
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, marginTop: 2, background: 'linear-gradient(135deg,#7CBDD4,#4890aa)' }} />
                <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '4px 12px 12px 12px', padding: '12px 14px', display: 'flex', gap: 4, alignItems: 'center' }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 6, height: 6, borderRadius: '50%', background: '#7CBDD4',
                      animation: 'chat-dot 1.2s ease-in-out infinite',
                      animationDelay: `${i * 0.2}s`,
                    }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '10px 12px 12px', borderTop: '1px solid rgba(124,189,212,0.1)', display: 'flex', gap: 8 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Type a question..."
              style={{
                flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(124,189,212,0.15)',
                borderRadius: 8, padding: '8px 12px', color: '#DCE4EE', fontSize: 13,
                fontFamily: "'Sora', sans-serif", outline: 'none',
              }}
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              aria-label="Send message"
              style={{
                width: 36, height: 36, borderRadius: 8, border: 'none', cursor: 'pointer',
                background: input.trim() && !loading ? 'linear-gradient(135deg,#7CBDD4,#4890aa)' : 'rgba(124,189,212,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                transition: 'background 0.2s',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={input.trim() && !loading ? '#0D1520' : '#4A6580'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Floating bubble */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Close chat' : 'Open chat'}
        style={{
          position: 'fixed', bottom: 24, right: 24,
          width: 52, height: 52, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg,#7CBDD4,#4890aa)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(124,189,212,0.45)',
          zIndex: 10000,
          transition: 'transform 0.2s, box-shadow 0.2s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.08)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
      >
        {open ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0D1520" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0D1520" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        )}
      </button>

      {/* Dot animation keyframes */}
      <style>{`
        @keyframes chat-dot {
          0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-3px); }
        }
      `}</style>
    </>
  );
}
