import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Loader2, MessageSquare, X, ChevronDown, RotateCcw, ExternalLink, Phone } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import DOMPurify from 'dompurify';
import { ChatMessage, sendMessage } from '../lib/gemini';
import { useChatbot, defaultQuickReplies } from '../context/ChatbotContext';
import { db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export default function ChatWidget() {
  const { config, addLead, updateLeadConversation, tenantId } = useChatbot();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showBubble, setShowBubble] = useState(false);
  const [currentLeadId, setCurrentLeadId] = useState<string | null>(null);
  const [isHandoff, setIsHandoff] = useState(false);
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
  const chatWindowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentLeadId) {
      const unsub = onSnapshot(doc(db, "leads", currentLeadId), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.handoff) setIsHandoff(true);
          if (data.conversation && data.conversation.length > messages.length) {
            setMessages(data.conversation);
          }
        }
      });
      return () => unsub();
    }
  }, [currentLeadId, messages.length]);

  // Initialize or reset based on welcome message changes
  useEffect(() => {
    if (messages.length <= 1) {
      setMessages([{ role: 'model', content: config.welcomeMessage }]);
    }
  }, [config.welcomeMessage]);

  // Proactivity bubble timer
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isOpen) {
        setShowBubble(true);
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setShowBubble(false);
    }
  }, [isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        chatWindowRef.current && 
        !chatWindowRef.current.contains(event.target as Node) &&
        isOpen
      ) {
        // Prevent immediate close if clicked on the floating action button
        const fab = document.getElementById('chat-fab-button');
        if (fab && fab.contains(event.target as Node)) {
          return;
        }
        setIsOpen(false);
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isLoading, isOpen]);

  const resetChat = () => {
    setMessages([{ role: 'model', content: config.welcomeMessage }]);
  }

  const executeSendMessage = async (rawMessage: string) => {
    if (!rawMessage.trim() || isLoading) return;

    const userMsg = rawMessage.trim();
    const currentHistory = [...messages];
    const newHistoryWUser: ChatMessage[] = [...currentHistory, { role: 'user', content: userMsg }];
    
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    
    if (isHandoff && currentLeadId) {
       updateLeadConversation(currentLeadId, newHistoryWUser, true);
       return;
    }

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
        config.webhookUrl
      );
      
      let finalCleanResponse = result.text;
      const leadRegex = /<LEAD>([\s\S]*?)<\/LEAD>/i;
      const match = finalCleanResponse.match(leadRegex);

      if (result.lead || match) {
        try {
          const leadData = result.lead || (match ? JSON.parse(match[1].trim()) : {});
          
          if (match) {
            finalCleanResponse = finalCleanResponse.replace(leadRegex, '').trim();
          }
          
          // Save the lead with the context
          const finalConversation = [...newHistoryWUser, { role: 'model' as const, content: finalCleanResponse }];
          
          const leadObject = {
            id: `lead_${Math.random().toString(36).substr(2, 9)}`,
            name: leadData.name || leadData.nombre || 'Sin nombre',
            phone: leadData.phone || leadData.telefono || 'Sin teléfono',
            email: leadData.email || 'Sin mail',
            ubicacion: leadData.ubicacion || '',
            tiene_usado: leadData.tiene_usado || '',
            interesa_lanchaplan: leadData.interesa_lanchaplan || '',
            interes: leadData.interes || '',
            tenant_id: tenantId || 'default_tenant',
            date: new Date().toISOString(),
            conversation: finalConversation
          };

          addLead(leadObject);
          setCurrentLeadId(leadObject.id);

          // If server didn't already dispatch via function calling, fallback to client-side dispatch
          if (!result.lead && config.webhookUrl) {
             try {
               fetch(config.webhookUrl, {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify(leadObject)
               }).catch(e => console.error("Webhook warning:", e));
             } catch(e) {}
          }
        } catch (parseError) {
          console.error("Failed to parse lead data:", parseError);
        }
      }

      setMessages(prev => [...prev, { role: 'model', content: finalCleanResponse }]);
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages(prev => [
        ...prev, 
        { role: 'model', content: 'Lo siento, he perdido temporalmente la conexión con cubierta. Inténtalo de nuevo.' }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const userMsg = input;
    setInput('');
    await executeSendMessage(userMsg);
  };

  return (
    <>
      {/* Proactivity Bubble */}
      <AnimatePresence>
        {!isOpen && showBubble && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            className="fixed bottom-24 right-6 bg-white px-5 py-4 rounded-xl rounded-br-none shadow-xl border border-slate-100 z-50 cursor-pointer max-w-[280px]"
            onClick={() => setIsOpen(true)}
          >
            <div className="flex items-center">
               <p className="text-[15px] text-slate-800 font-medium leading-snug">{config.welcomeMessage}</p>
            </div>
            <button 
              onClick={(e) => { e.stopPropagation(); setShowBubble(false); }}
              className="absolute -top-2 -right-2 bg-slate-100 text-slate-500 rounded-full p-1 hover:bg-slate-200"
            >
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Action Button */}
      <motion.button
        id="chat-fab-button"
        initial={{ scale: 0 }}
        animate={{ scale: isOpen ? 0 : 1 }}
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center text-white cursor-pointer hover:shadow-xl transition-shadow z-50 overflow-hidden"
        style={{ backgroundColor: config.primaryColor }}
      >
        {config.logoUrl ? (
          <img src={config.logoUrl} alt="Logo" className="w-full h-full object-cover" />
        ) : (
          <MessageSquare className="w-6 h-6" />
        )}
      </motion.button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={chatWindowRef}
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 w-[90vw] sm:w-[400px] h-[calc(100vh-100px)] max-h-[600px] bg-white rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden border border-slate-200 font-sans"
          >
            {/* Header */}
            <div 
              className="px-5 py-4 flex items-center justify-between text-white shrink-0 shadow-sm"
              style={{ backgroundColor: config.primaryColor }}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm shadow-inner overflow-hidden">
                  {config.logoUrl ? (
                    <img src={config.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <Bot className="w-5 h-5 text-white" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-sm leading-tight">{config.name}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                    <p className="text-white/80 text-xs">En línea, listo para zarpar</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {waLink && (
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 bg-[#25D366] hover:bg-[#20ba5a] text-white rounded-lg transition-all shadow-sm flex items-center gap-1 text-xs font-medium cursor-pointer mr-1"
                    title="Hablar por WhatsApp con un asesor comercial"
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </a>
                )}
                <button onClick={resetChat} className="p-1.5 hover:bg-white/20 rounded-md transition-colors text-white cursor-pointer" title="Reiniciar chat">
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-white/20 rounded-md transition-colors text-white cursor-pointer">
                  <ChevronDown className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
              {messages.map((msg, idx) => {
                const isUser = msg.role === 'user';
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex max-w-[85%] ${isUser ? 'ml-auto justify-end' : 'mr-auto justify-start'}`}
                  >
                    {!isUser && (
                       <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center shrink-0 mr-2 mt-1 overflow-hidden shadow-sm">
                         {config.logoUrl ? (
                           <img src={config.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                         ) : (
                           <Bot className="w-4 h-4" />
                         )}
                       </div>
                    )}
                    <div 
                      className={`px-4 py-3 shadow-sm text-[14px] leading-relaxed relative ${
                        isUser 
                          ? 'text-white rounded-2xl rounded-tr-sm' 
                          : 'bg-white border border-slate-100 text-slate-700 rounded-2xl rounded-tl-sm'
                      }`}
                      style={isUser ? { backgroundColor: config.primaryColor } : {}}
                    >
                      <div className="[&>p]:mb-2 [&>p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:ml-4 [&_ul]:my-1 [&_li]:mb-1 [&_strong]:font-semibold [&_img]:rounded-xl [&_img]:shadow-md [&_img]:max-w-full [&_video]:rounded-xl [&_video]:shadow-md [&_video]:max-w-full">
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
                );
              })}
              
              {messages.length === 1 && (() => {
                const activeQuickReplies = (config.quickReplies && config.quickReplies.length > 0)
                  ? config.quickReplies.filter(r => r && r.trim() !== '')
                  : defaultQuickReplies;

                if (activeQuickReplies.length === 0) return null;

                return (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col gap-2 pl-9 pr-4"
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
                );
              })()}
              
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex max-w-[85%] mr-auto justify-start"
                >
                   <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center shrink-0 mr-2 mt-1 overflow-hidden shadow-sm">
                     {config.logoUrl ? (
                       <img src={config.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                     ) : (
                       <Bot className="w-4 h-4" />
                     )}
                   </div>
                   <div className="px-5 py-3.5 bg-white border border-slate-100 rounded-2xl rounded-tl-sm shadow-sm flex items-center h-[46px]">
                      <div className="flex space-x-1.5 opacity-60">
                         <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: config.primaryColor }}></div>
                         <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: config.primaryColor, animationDelay: '0.2s' }}></div>
                         <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: config.primaryColor, animationDelay: '0.4s' }}></div>
                      </div>
                   </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} className="h-1" />
            </div>

            {/* Input Area */}
            <div className="p-3 bg-white border-t border-slate-100 mt-auto">
              <form id="chat-input-form" onSubmit={handleSubmit} className="flex relative items-end">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={isLoading}
                  placeholder="Envía un mensaje..."
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-4 pr-12 text-[14px] text-slate-800 focus:outline-none focus:ring-1 focus:bg-white transition-all disabled:opacity-50 resize-none"
                  style={{ outlineColor: config.primaryColor, '--tw-ring-color': config.primaryColor } as React.CSSProperties}
                  onKeyDown={(e) => {
                    // Solo evitamos el enter si queremos que envíe, pero el usuario pidió explícitamente:
                    // "el enter en su teclado y seguir cargando los datos, no enviar el mensaje con un enter"
                    // Así que dejamos que el enter funcione por defecto en el textarea (agrega salto de línea).
                  }}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="absolute right-1 bottom-1 w-9 h-9 border-none rounded-lg text-white flex items-center justify-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: config.primaryColor }}
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 ml-0.5" />}
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
