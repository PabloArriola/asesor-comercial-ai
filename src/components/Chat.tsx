import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import Markdown from 'react-markdown';
import { ChatMessage, sendMessage } from '../lib/gemini';

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'model',
      content: '¡Hola! Soy el asesor comercial experto de la empresa 👋. ¿En qué puedo ayudarte el día de hoy con nuestro catálogo de productos?'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput('');
    const currentHistory = [...messages];
    
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    try {
      const result = await sendMessage(currentHistory, userMsg);
      setMessages(prev => [...prev, { role: 'model', content: result.text }]);
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages(prev => [
        ...prev, 
        { role: 'model', content: 'Lo siento, ocurrió un error temporal. ¿Podrías intentar enviar tu mensaje nuevamente?' }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full w-full bg-white">
      {/* Header */}
      <div className="h-[80px] bg-white border-b border-[#E2E8F0] px-8 flex items-center justify-between shrink-0">
        <div className="flex items-center">
          <div className="w-10 h-10 rounded-full bg-[#E2E8F0] mr-3 flex items-center justify-center font-bold text-[#64748B]">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="font-semibold text-[#333]">Asesor Comercial Experto</div>
            <div className="text-[12px] text-[#64748B] flex items-center mt-0.5">
              <div className="w-2.5 h-2.5 bg-[#22C55E] rounded-full mr-1.5 focus:bg-white transition-colors"></div>
              En línea
            </div>
          </div>
        </div>
        <button className="bg-transparent border border-[#E2E8F0] text-[#333] px-4 py-2 rounded-md text-[12px] cursor-pointer hover:bg-gray-50 transition-colors">
          Finalizar Sesión
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col gap-6 bg-[#F8FAFC]">
        {messages.map((msg, idx) => {
          const isUser = msg.role === 'user';
          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`max-w-[85%] md:max-w-[80%] p-4 rounded-xl text-[15px] leading-relaxed relative ${
                isUser 
                  ? 'bg-[#0F172A] text-white self-end shadow-[0_4px_6px_rgba(0,0,0,0.05)]' 
                  : 'bg-white border border-[#E2E8F0] self-start shadow-[0_2px_4px_rgba(0,0,0,0.02)] text-[#333]'
              }`}
            >
              {!isUser && (
                <div className="text-[10px] font-bold text-[#38BDF8] mb-2 uppercase tracking-wide">
                  Asesor Virtual
                </div>
              )}
              <div className="[&>p]:mb-2 [&>p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:ml-4 [&_ul]:mb-2 [&_li]:mb-1 [&_strong]:font-semibold">
                <Markdown>{msg.content}</Markdown>
              </div>
            </motion.div>
          );
        })}
        
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-[85%] md:max-w-[80%] p-4 rounded-xl relative bg-white border border-[#E2E8F0] self-start shadow-[0_2px_4px_rgba(0,0,0,0.02)] text-[#333]"
          >
            <div className="text-[10px] font-bold text-[#38BDF8] mb-2 uppercase tracking-wide">
              Asesor Virtual
            </div>
            <div className="flex items-center space-x-1.5 h-6">
              <div className="w-1.5 h-1.5 bg-[#CBD5E1] rounded-full animate-bounce"></div>
              <div className="w-1.5 h-1.5 bg-[#CBD5E1] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-1.5 h-1.5 bg-[#CBD5E1] rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className="shrink-0 px-4 md:px-8 py-6 bg-white border-t border-[#E2E8F0]">
        <div className="flex gap-2 mb-4 relative z-10 overflow-x-auto pb-1 scrollbar-hide">
           <button type="button" onClick={() => setInput(prev => prev + 'Quiero compartir mi Email: ')} className="whitespace-nowrap px-3.5 py-1.5 bg-white border border-[#E2E8F0] rounded-full text-[13px] text-[#64748B] hover:bg-gray-50 transition-colors shadow-sm cursor-pointer shrink-0">
             Compartir Email
           </button>
           <button type="button" onClick={() => setInput(prev => prev + '¿Cuáles son las opciones de financiación?')} className="whitespace-nowrap px-3.5 py-1.5 bg-white border border-[#E2E8F0] rounded-full text-[13px] text-[#64748B] hover:bg-gray-50 transition-colors shadow-sm cursor-pointer shrink-0">
             Solicitar Financiación
           </button>
           <button type="button" onClick={() => setInput(prev => prev + 'Me gustaría ver el catálogo en PDF')} className="whitespace-nowrap px-3.5 py-1.5 bg-white border border-[#E2E8F0] rounded-full text-[13px] text-[#64748B] hover:bg-gray-50 transition-colors shadow-sm cursor-pointer shrink-0">
             Ver Catálogo PDF
           </button>
        </div>
        <form onSubmit={handleSubmit} className="flex items-center gap-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            placeholder="Escribe aquí tus datos de contacto o consulta..."
            className="flex-1 h-12 bg-[#F1F5F9] border border-[#E2E8F0] rounded-full px-6 text-[14px] text-[#475569] outline-none focus:bg-white focus:border-[#38BDF8] focus:ring-1 focus:ring-[#38BDF8] transition-all placeholder:text-[#9A3B8]"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="w-12 h-12 bg-[#38BDF8] border-none rounded-full text-white cursor-pointer flex items-center justify-center shrink-0 hover:bg-[#0284C7] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-4 h-4 ml-0.5" />}
          </button>
        </form>
      </div>
    </div>
  );
}
