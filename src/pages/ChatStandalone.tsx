import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, Loader2, User, ExternalLink, Phone } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import DOMPurify from 'dompurify';
import { ChatMessage, sendMessage } from '../lib/gemini';
import { useChatbot, defaultQuickReplies, Lead } from '../context/ChatbotContext';

export default function ChatStandalone() {
  const { config, addLead, tenantId } = useChatbot();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const getWhatsAppLink = () => {
    if (config.whatsappEnabled === false) return null;
    const targetNumber = config.whatsappNumber || config.whatsappResistencia || config.whatsappPosadas || '';
    const cleanNumber = targetNumber.replace(/\D/g, '');
    if (!cleanNumber) return null;
    const msg = encodeURIComponent(config.whatsappDefaultMessage || '¡Hola! Me gustaría cotizar y consultar detalles sobre una embarcación.');
    return `https://wa.me/${cleanNumber}?text=${msg}`;
  };
  const waLink = getWhatsAppLink();

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{ role: 'model', content: config.welcomeMessage }]);
    }
  }, [config.welcomeMessage, messages.length]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const executeSendMessage = async (rawMessage: string) => {
    if (!rawMessage.trim() || isLoading) return;

    const userMsg = rawMessage.trim();
    const currentHistory = [...messages];
    
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    const allSources = config.dataSources?.map(s => `\n--- FUENTE: ${s.title} ---\n${s.content}`).join('\n') || '';
    const fullKnowledgeBase = config.knowledgeBase + '\n' + allSources;

    try {
      const result = await sendMessage(
        currentHistory, 
        userMsg, 
        config.systemPrompt, 
        fullKnowledgeBase,
        tenantId,
        config.webhookUrl,
        {
          whatsappNumber: config.whatsappNumber,
          whatsappResistencia: config.whatsappResistencia,
          whatsappPosadas: config.whatsappPosadas,
          whatsappDefaultMessage: config.whatsappDefaultMessage
        }
      );
      
      let responseText = result.text;
      const leadMatch = responseText.match(/<LEAD>([\s\S]*?)<\/LEAD>/);
      if (result.lead || leadMatch) {
        try {
          const leadData = result.lead || (leadMatch ? JSON.parse(leadMatch[1]) : {});
          if (leadData.name || leadData.nombre || leadData.email || leadData.phone || leadData.telefono) {
            const newLead: Lead = {
              id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Date.now().toString(),
              name: leadData.name || leadData.nombre || 'Cliente Web',
              email: leadData.email || '',
              phone: leadData.phone || leadData.telefono || '',
              ubicacion: leadData.ubicacion || '',
              tiene_usado: leadData.tiene_usado || '',
              interesa_lanchaplan: leadData.interesa_lanchaplan || '',
              interes: leadData.interes || '',
              tenant_id: tenantId || 'default_tenant',
              date: new Date().toISOString(),
              conversation: [
                ...currentHistory.map(m => ({
                  role: (m.role === 'model' ? 'model' : 'user') as 'user' | 'model',
                  content: m.content
                })),
                { role: 'user' as const, content: userMsg }
              ]
            };
            await addLead(newLead);

            if (!result.lead && config.webhookUrl) {
              try {
                fetch(config.webhookUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    ...newLead,
                    interes: leadData.interes || '',
                    tenant_id: tenantId || 'default_tenant',
                    source: 'chat_standalone'
                  })
                }).catch(e => console.error("Webhook warning:", e));
              } catch (e) {}
            }
          }
        } catch (e) {
          console.error("Error parsing lead data", e);
        }
        if (leadMatch) {
          responseText = responseText.replace(/<LEAD>[\s\S]*?<\/LEAD>/, '').trim();
        }
      }

      setMessages(prev => [...prev, { role: 'model', content: responseText }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'model', content: 'Lo siento, hubo un error de conexión.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;
    const userMsg = input;
    setInput('');
    await executeSendMessage(userMsg);
  };

  const activeQuickReplies = (config.quickReplies && config.quickReplies.length > 0)
    ? config.quickReplies.filter(r => r && r.trim() !== '')
    : defaultQuickReplies;

  return (
    <div className="w-full h-screen flex flex-col bg-white overflow-hidden shadow-lg" style={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}>
      <div 
        className="p-4 flex items-center gap-3 text-white shadow-sm shrink-0"
        style={{ backgroundColor: config.primaryColor }}
      >
        <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm overflow-hidden">
          {config.logoUrl ? (
            <img src={config.logoUrl} alt="Logo" className="w-full h-full object-cover" />
          ) : (
            <Bot className="w-5 h-5 text-white" />
          )}
        </div>
        <div>
          <h3 className="font-semibold text-sm">{config.name || 'Asistente Virtual'}</h3>
          <p className="text-xs text-white/80">En línea</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex items-end gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 overflow-hidden ${
                msg.role === 'user' ? 'bg-slate-200' : ''
              }`}
              style={msg.role === 'model' ? { backgroundColor: config.primaryColor + '20', color: config.primaryColor } : {}}
              >
                {msg.role === 'user' ? (
                  <User className="w-4 h-4 text-slate-500" />
                ) : config.logoUrl ? (
                  <img src={config.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <Bot className="w-4 h-4" />
                )}
              </div>
              <div 
                className={`max-w-[80%] rounded-2xl p-3 text-sm shadow-sm ${
                  msg.role === 'user' 
                    ? 'bg-slate-800 text-white rounded-br-sm' 
                    : 'bg-white border border-slate-100 text-slate-700 rounded-bl-sm'
                }`}
              >
                <div className="prose prose-sm prose-p:leading-relaxed prose-pre:bg-slate-100 prose-pre:text-slate-800 break-words max-w-none prose-img:rounded-xl prose-img:shadow-md prose-img:max-w-full prose-video:rounded-xl prose-video:shadow-md prose-video:max-w-full">
                  <Markdown 
                    rehypePlugins={[rehypeRaw]}
                    remarkPlugins={[remarkGfm]}
                    components={{
                      a: ({ href, children, ...props }) => (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (href) {
                              window.open(href, '_blank', 'noopener,noreferrer');
                            }
                          }}
                          className="inline-flex items-center gap-1 font-medium underline text-blue-600 hover:text-blue-800 break-words cursor-pointer bg-blue-50/90 hover:bg-blue-100 px-2 py-0.5 rounded border border-blue-200/70 transition-colors my-0.5"
                          {...props}
                        >
                          <span>{children}</span>
                          <ExternalLink className="w-3.5 h-3.5 inline shrink-0 opacity-80" />
                        </a>
                      )
                    }}
                  >
                    {DOMPurify.sanitize(msg.content, { 
                      ADD_TAGS: ['iframe'], 
                      ADD_ATTR: ['target', 'rel', 'allow', 'allowfullscreen', 'frameborder', 'scrolling'] 
                    })}
                  </Markdown>
                </div>
              </div>
            </motion.div>
          ))}

          {messages.length === 1 && activeQuickReplies.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-2 pl-8 pr-4"
            >
              {activeQuickReplies.map((reply, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => executeSendMessage(reply)}
                  className="text-left px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-[13px] text-slate-700 hover:bg-slate-50 transition-all shadow-2xs hover:shadow-xs active:scale-[0.99] font-medium"
                  style={{ color: config.primaryColor, borderColor: `${config.primaryColor}35` }}
                >
                  {reply}
                </button>
              ))}
            </motion.div>
          )}

          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 text-slate-400 text-sm p-2"
            >
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Escribiendo...</span>
            </motion.div>
          )}
        </AnimatePresence>
        {waLink && messages.length > 2 && (
            <div className="flex justify-center my-3">
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#25D366] hover:bg-[#20ba5a] text-white rounded-xl text-xs font-semibold shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5"
              >
                <Phone className="w-4 h-4" />
                <span>Continuar atención por WhatsApp 📲</span>
              </a>
            </div>
          )}
          <div ref={messagesEndRef} />
      </div>

      <div className="p-3 bg-white border-t border-slate-100 shrink-0">
        <form onSubmit={handleSend} className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe tu mensaje..."
            className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent transition-all shadow-inner text-sm"
            style={{ '--tw-ring-color': config.primaryColor } as any}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="absolute right-2 p-2 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed transition-transform hover:scale-105 active:scale-95"
            style={{ backgroundColor: config.primaryColor }}
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
