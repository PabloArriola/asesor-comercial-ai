import React, { useState, useMemo } from 'react';
import { useChatbot, Lead } from '../context/ChatbotContext';
import { Ship, Users, MessageSquare, Calendar, Phone, Mail, MessageCircle, X, ChevronDown, ChevronUp, ChevronRight, Copy, Check, Search, ExternalLink, Bot, User, Clock, ArrowRight, MapPin, CreditCard, Anchor, Download, Filter } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function ClientDashboard() {
  const { leads, config, tenantId } = useChatbot();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<'todas' | 'resistencia' | 'posadas' | 'otras'>('todas');
  const [selectedLeadForModal, setSelectedLeadForModal] = useState<Lead | null>(null);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Counts by branch for fast overview
  const branchCounts = useMemo(() => {
    let resistencia = 0;
    let posadas = 0;
    let otras = 0;

    leads.forEach(l => {
      const u = (l.ubicacion || '').toLowerCase();
      if (u.includes('resistencia')) resistencia++;
      else if (u.includes('posadas')) posadas++;
      else otras++;
    });

    return { total: leads.length, resistencia, posadas, otras };
  }, [leads]);

  // Filter leads based on branch and search term
  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      const u = (l.ubicacion || '').toLowerCase();
      
      // Branch filter
      if (selectedBranch === 'resistencia' && !u.includes('resistencia')) return false;
      if (selectedBranch === 'posadas' && !u.includes('posadas')) return false;
      if (selectedBranch === 'otras' && (u.includes('resistencia') || u.includes('posadas'))) return false;

      // Text search
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase().trim();
      const matchBasic = 
        l.name.toLowerCase().includes(term) ||
        (l.email && l.email.toLowerCase().includes(term)) ||
        l.phone.toLowerCase().includes(term) ||
        (l.ubicacion && l.ubicacion.toLowerCase().includes(term)) ||
        (l.tiene_usado && l.tiene_usado.toLowerCase().includes(term));
      if (matchBasic) return true;

      if (l.conversation && Array.isArray(l.conversation)) {
        return l.conversation.some(m => m.content.toLowerCase().includes(term));
      }
      return false;
    });
  }, [leads, searchTerm, selectedBranch]);

  const exportLeadsToCsv = () => {
    if (filteredLeads.length === 0) return;
    const headers = ["Fecha", "Nombre", "Teléfono", "WhatsApp Link", "Ubicación / Sucursal", "Tiene Usado", "Lancha Plan", "Interés", "Email"];
    const rows = filteredLeads.map(l => {
      const rawPhone = l.phone.replace(/\D/g, '');
      const waLink = rawPhone ? `https://wa.me/${rawPhone}` : '';
      return [
        `"${new Date(l.date).toLocaleString().replace(/"/g, '""')}"`,
        `"${(l.name || '').replace(/"/g, '""')}"`,
        `"${(l.phone || '').replace(/"/g, '""')}"`,
        `"${waLink}"`,
        `"${(l.ubicacion || 'No especificada').replace(/"/g, '""')}"`,
        `"${(l.tiene_usado || 'No').replace(/"/g, '""')}"`,
        `"${(l.interesa_lanchaplan || 'No').replace(/"/g, '""')}"`,
        `"${(l.interes || '').replace(/"/g, '""')}"`,
        `"${(l.email || '').replace(/"/g, '""')}"`
      ];
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const branchLabel = selectedBranch === 'todas' ? 'todos' : selectedBranch;
    link.setAttribute("download", `leads_${branchLabel}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Basic stats
  const totalLeads = leads.length;
  const recentLeads = leads.filter(l => {
    const leadDate = new Date(l.date).getTime();
    const now = new Date().getTime();
    return now - leadDate < 7 * 24 * 60 * 60 * 1000; // Last 7 days
  }).length;

  const toggleExpandCard = (id: string) => {
    setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const copyTranscript = (lead: Lead) => {
    if (!lead.conversation || lead.conversation.length === 0) return;
    const transcriptText = lead.conversation
      .map(m => `[${m.role === 'user' ? lead.name || 'Usuario' : config.name || 'Asistente'}]: ${m.content}`)
      .join('\n\n');
    
    const fullText = `=== Contacto: ${lead.name} (${lead.phone} | ${lead.email}) ===\nFecha: ${new Date(lead.date).toLocaleString()}\n\n${transcriptText}`;
    navigator.clipboard.writeText(fullText);
    setCopiedId(lead.id || lead.email);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans p-4 sm:p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white px-6 sm:px-8 py-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-4">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 overflow-hidden shadow-sm" 
              style={{ backgroundColor: config.logoUrl ? '#ffffff' : config.primaryColor }}
            >
              {config.logoUrl ? (
                <img src={config.logoUrl} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <Ship className="w-6 h-6 text-white" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Panel de Resultados y Conversaciones</h1>
              <p className="text-slate-500 text-sm font-medium">Revisa las consultas, contactos y el curso de cada conversación con tus clientes</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            {tenantId && (
              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                Cliente: <span className="font-mono text-blue-700">{tenantId}</span>
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              En vivo y sincronizado
            </span>
          </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-start gap-4">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-slate-500 font-medium text-sm">Leads Totales</p>
              <h2 className="text-3xl font-bold text-slate-800 mt-1">{totalLeads}</h2>
              <p className="text-xs text-slate-400 mt-0.5">Personas que dejaron sus datos</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-start gap-4">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <p className="text-slate-500 font-medium text-sm">Leads (últimos 7 días)</p>
              <h2 className="text-3xl font-bold text-slate-800 mt-1">{recentLeads}</h2>
              <p className="text-xs text-slate-400 mt-0.5">Actividad reciente de la semana</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-start gap-4">
            <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center shrink-0">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <p className="text-slate-500 font-medium text-sm">Charlas Registradas</p>
              <h2 className="text-3xl font-bold text-slate-800 mt-1">
                {leads.filter(l => l.conversation && l.conversation.length > 0).length}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Con transcripción completa guardada</p>
            </div>
          </div>
        </div>

        {/* Search, Branch Filter & Export Bar */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200 space-y-3.5">
          {/* Branch Filter Pills */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Sucursal:
              </span>
              <button
                type="button"
                onClick={() => setSelectedBranch('todas')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  selectedBranch === 'todas'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Todas ({branchCounts.total})
              </button>
              <button
                type="button"
                onClick={() => setSelectedBranch('resistencia')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                  selectedBranch === 'resistencia'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200/60'
                }`}
              >
                <MapPin className="w-3 h-3" /> Resistencia ({branchCounts.resistencia})
              </button>
              <button
                type="button"
                onClick={() => setSelectedBranch('posadas')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                  selectedBranch === 'posadas'
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200/60'
                }`}
              >
                <MapPin className="w-3 h-3" /> Posadas ({branchCounts.posadas})
              </button>
              {branchCounts.otras > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedBranch('otras')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    selectedBranch === 'otras'
                      ? 'bg-slate-700 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Otras ({branchCounts.otras})
                </button>
              )}
            </div>

            {/* CSV Export Button */}
            <button
              type="button"
              onClick={exportLeadsToCsv}
              disabled={filteredLeads.length === 0}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
                filteredLeads.length === 0
                  ? 'opacity-40 cursor-not-allowed bg-slate-50 text-slate-400 border-slate-200'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300 shadow-sm active:scale-95'
              }`}
              title="Descargar tabla en formato CSV para Excel o Google Sheets"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>Exportar Leads CSV</span>
            </button>
          </div>

          {/* Search Input & Counter */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nombre, teléfono, correo o mensaje..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-slate-800 placeholder-slate-400"
              />
            </div>
            <div className="text-xs font-medium text-slate-500 self-end sm:self-center">
              Mostrando <span className="font-bold text-slate-700">{filteredLeads.length}</span> de {leads.length} contactos
            </div>
          </div>
        </div>

        {/* Leads List */}
        <div>
          <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <span>Contactos y Conversaciones</span>
            <span className="text-xs font-normal text-slate-500 bg-slate-200 px-2.5 py-0.5 rounded-full">
              {filteredLeads.length}
            </span>
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredLeads.length === 0 ? (
              <div className="col-span-full bg-white p-12 text-center rounded-2xl border border-dashed border-slate-300">
                <MessageSquare className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-semibold text-slate-600">
                  {searchTerm ? 'No se encontraron contactos con esa búsqueda' : 'No hay contactos todavía'}
                </h3>
                <p className="text-slate-500 text-sm mt-2">
                  {searchTerm ? 'Intenta con otro término o borra la búsqueda.' : 'Los contactos capturados por el asistente aparecerán aquí automáticamente junto al curso completo de su charla.'}
                </p>
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')}
                    className="mt-4 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 px-4 py-2 rounded-xl transition-colors"
                  >
                    Limpiar búsqueda
                  </button>
                )}
              </div>
            ) : (
              filteredLeads.map(lead => {
                const phoneNumeric = lead.phone.replace(/\D/g, '');
                const leadIdKey = lead.id || lead.email;
                const isExpanded = !!expandedCards[leadIdKey];
                const conversation = lead.conversation || [];
                const firstUserMsg = conversation.find(m => m.role === 'user')?.content;
                const lastUserMsg = [...conversation].reverse().find(m => m.role === 'user')?.content;
                
                // Prefilled WhatsApp text with context from their question
                const contextSummary = firstUserMsg ? encodeURIComponent(`Hola ${lead.name}, te contacto respecto a tu consulta en el chat sobre: "${firstUserMsg.slice(0, 70)}"`) : encodeURIComponent(`Hola ${lead.name}, te contacto en respuesta a tu consulta.`);
                const whatsappUrl = `https://wa.me/${phoneNumeric}?text=${contextSummary}`;
                const callUrl = `tel:${lead.phone}`;

                return (
                  <div 
                    key={leadIdKey} 
                    className="bg-white rounded-2xl shadow-sm border border-slate-200 hover:border-slate-300 transition-all flex flex-col overflow-hidden"
                  >
                    {/* Top Lead Info */}
                    <div className="p-5 sm:p-6 border-b border-slate-100">
                      <div className="flex justify-between items-start mb-3.5">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg text-white shadow-xs shrink-0"
                            style={{ backgroundColor: config.primaryColor }}
                          >
                            {lead.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h3 className="font-bold text-lg text-slate-800 tracking-tight leading-tight">{lead.name}</h3>
                            <span className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                              <Clock className="w-3 h-3" />
                              {new Date(lead.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-100 flex items-center gap-1.5 shrink-0">
                            <MessageSquare className="w-3 h-3" />
                            {conversation.length} {conversation.length === 1 ? 'mensaje' : 'mensajes'}
                          </span>
                        </div>
                      </div>

                      {/* Contact Details */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 text-sm text-slate-600">
                        <a 
                          href={callUrl}
                          className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors text-slate-700 font-medium"
                        >
                          <Phone className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span className="truncate">{lead.phone}</span>
                        </a>
                        <a 
                          href={`mailto:${lead.email}`}
                          className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors text-slate-700 font-medium"
                        >
                          <Mail className="w-4 h-4 text-blue-600 shrink-0" />
                          <span className="truncate">{lead.email || 'Sin correo'}</span>
                        </a>
                      </div>

                      {/* Calificación Náutica (Ubicación, Usado, Lancha Plan) */}
                      {(lead.ubicacion || lead.tiene_usado || lead.interesa_lanchaplan) && (
                        <div className="flex flex-wrap gap-1.5 mt-3 pt-2.5 border-t border-slate-100">
                          {lead.ubicacion && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-sky-50 text-sky-800 border border-sky-200">
                              <MapPin className="w-3 h-3 text-sky-600 shrink-0" />
                              <span>Sucursal/Ubicación: <strong>{lead.ubicacion}</strong></span>
                            </span>
                          )}
                          {lead.tiene_usado && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                              <Anchor className="w-3 h-3 text-amber-600 shrink-0" />
                              <span>Entrega Usado: <strong>{lead.tiene_usado}</strong></span>
                            </span>
                          )}
                          {lead.interesa_lanchaplan && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <CreditCard className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span>Lancha Plan: <strong>{lead.interesa_lanchaplan}</strong></span>
                            </span>
                          )}
                        </div>
                      )}

                      {/* Highlighted Inquiry Preview Block */}
                      <div className="mt-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                            Consulta inicial del cliente:
                          </span>
                        </div>
                        <p className="text-xs sm:text-[13px] text-slate-700 italic leading-relaxed line-clamp-3">
                          "{firstUserMsg || 'No se registraron mensajes previos del usuario.'}"
                        </p>
                      </div>

                      {/* Action to view full course of conversation */}
                      <div className="mt-3.5 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedLeadForModal(lead)}
                          className="flex-1 min-w-[170px] inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
                          <span>Ver curso de la conversación</span>
                          <ArrowRight className="w-3.5 h-3.5 ml-auto text-slate-400" />
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleExpandCard(leadIdKey)}
                          className="inline-flex items-center gap-1.5 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition-colors cursor-pointer"
                          title="Vista rápida aquí mismo"
                        >
                          <span>{isExpanded ? 'Plegar' : 'Vista rápida'}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      {/* Quick Inline Accordion for Conversation Course */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-2">
                            <span>Transcripción cronológica:</span>
                            <button
                              type="button"
                              onClick={() => copyTranscript(lead)}
                              className="text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
                            >
                              {copiedId === leadIdKey ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  <span className="text-emerald-600 font-semibold">Copiado</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copiar chat</span>
                                </>
                              )}
                            </button>
                          </div>

                          <div className="max-h-72 overflow-y-auto space-y-2.5 pr-1 text-xs">
                            {conversation.map((msg, idx) => {
                              const isUser = msg.role === 'user';
                              return (
                                <div 
                                  key={idx} 
                                  className={`p-3 rounded-xl ${
                                    isUser 
                                      ? 'bg-blue-50 border border-blue-100 text-slate-800 ml-4' 
                                      : 'bg-slate-100/90 border border-slate-200 text-slate-700 mr-4'
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5 mb-1 text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                                    {isUser ? (
                                      <>
                                        <User className="w-3 h-3 text-blue-600" />
                                        <span>{lead.name} (Cliente)</span>
                                      </>
                                    ) : (
                                      <>
                                        <Bot className="w-3 h-3 text-slate-600" />
                                        <span>{config.name || 'Asistente'}</span>
                                      </>
                                    )}
                                  </div>
                                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Action Buttons: WhatsApp and Call */}
                    <div className="bg-slate-50 p-4 mt-auto flex gap-3">
                      <a 
                        href={whatsappUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors shadow-2xs"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>WhatsApp</span>
                      </a>
                      <a 
                        href={callUrl}
                        className="flex-1 bg-slate-800 hover:bg-slate-900 text-white py-2.5 rounded-xl font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors shadow-2xs"
                      >
                        <Phone className="w-4 h-4" />
                        <span>Llamar</span>
                      </a>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* Modal: Visualizador Completo del Curso de la Conversación */}
      {selectedLeadForModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between bg-slate-50/70 shrink-0">
              <div className="flex items-center gap-3.5">
                <div 
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-sm shrink-0"
                  style={{ backgroundColor: config.primaryColor }}
                >
                  {selectedLeadForModal.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-lg text-slate-900">{selectedLeadForModal.name}</h3>
                    <span className="text-[11px] font-semibold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md">
                      Lead Verificado
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 flex flex-wrap items-center gap-2 mt-0.5">
                    <span>{selectedLeadForModal.phone}</span>
                    {selectedLeadForModal.email && (
                      <>
                        <span>•</span>
                        <span>{selectedLeadForModal.email}</span>
                      </>
                    )}
                  </p>
                  {(selectedLeadForModal.ubicacion || selectedLeadForModal.tiene_usado || selectedLeadForModal.interesa_lanchaplan) && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {selectedLeadForModal.ubicacion && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-100 text-sky-800">
                          <MapPin className="w-3 h-3 text-sky-600" />
                          {selectedLeadForModal.ubicacion}
                        </span>
                      )}
                      {selectedLeadForModal.tiene_usado && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800">
                          <Anchor className="w-3 h-3 text-amber-600" />
                          Usado: {selectedLeadForModal.tiene_usado}
                        </span>
                      )}
                      {selectedLeadForModal.interesa_lanchaplan && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                          <CreditCard className="w-3 h-3 text-emerald-600" />
                          Lancha Plan: {selectedLeadForModal.interesa_lanchaplan}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  type="button"
                  onClick={() => copyTranscript(selectedLeadForModal)}
                  className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors text-xs font-medium flex items-center gap-1.5"
                  title="Copiar transcripción completa"
                >
                  {copiedId === (selectedLeadForModal.id || selectedLeadForModal.email) ? (
                    <Check className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
                <button 
                  type="button"
                  onClick={() => setSelectedLeadForModal(null)}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Conversation Timeline & Course */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4 bg-slate-50/40">
              <div className="flex items-center gap-2 text-slate-400 text-xs my-2 before:h-px before:flex-1 before:bg-slate-200 after:h-px after:flex-1 after:bg-slate-200">
                <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
                <span className="font-semibold uppercase tracking-wider text-slate-500">Curso Completo de la Conversación</span>
              </div>

              {(!selectedLeadForModal.conversation || selectedLeadForModal.conversation.length === 0) ? (
                <div className="text-center py-12 text-slate-400">
                  <MessageSquare className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                  <p className="text-sm font-medium">No se registraron mensajes en esta sesión.</p>
                </div>
              ) : (
                selectedLeadForModal.conversation.map((msg, index) => {
                  const isUser = msg.role === 'user';
                  return (
                    <div 
                      key={index} 
                      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center gap-1.5 mb-1 px-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                          {isUser ? `Mensaje ${index + 1} • ${selectedLeadForModal.name}` : `Respuesta • ${config.name || 'Asistente'}`}
                        </span>
                      </div>
                      
                      <div className={`flex gap-2.5 max-w-[88%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                        <div 
                          className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold shadow-2xs overflow-hidden ${
                            isUser ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-700'
                          }`}
                        >
                          {isUser ? (
                            <User className="w-3.5 h-3.5" />
                          ) : config.logoUrl ? (
                            <img src={config.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                          ) : (
                            <Bot className="w-3.5 h-3.5 text-blue-600" />
                          )}
                        </div>

                        <div 
                          className={`p-3.5 rounded-2xl text-[13px] leading-relaxed shadow-2xs ${
                            isUser 
                              ? 'bg-blue-600 text-white rounded-tr-xs font-normal' 
                              : 'bg-white border border-slate-200/90 text-slate-800 rounded-tl-xs'
                          }`}
                        >
                          <div className="[&>p]:mb-2 [&>p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:ml-4 [&_ul]:my-2 [&_li]:mb-1 [&_strong]:font-semibold">
                            <Markdown 
                              remarkPlugins={[remarkGfm]}
                              components={{
                                a: ({ href, children, ...props }) => (
                                  <a
                                    href={href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`${isUser ? 'text-white underline' : 'text-blue-600 underline font-semibold'} inline-flex items-center gap-1`}
                                    {...props}
                                  >
                                    <span>{children}</span>
                                    <ExternalLink className="w-3 h-3 inline shrink-0" />
                                  </a>
                                )
                              }}
                            >
                              {msg.content}
                            </Markdown>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer Quick Actions */}
            <div className="p-4 sm:p-5 bg-white border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <span className="text-xs text-slate-500 font-medium self-start sm:self-center">
                Fecha del contacto: {new Date(selectedLeadForModal.date).toLocaleString()}
              </span>

              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                {(() => {
                  const phoneNumeric = selectedLeadForModal.phone.replace(/\D/g, '');
                  const firstQ = selectedLeadForModal.conversation?.find(m => m.role === 'user')?.content;
                  const contextMsg = firstQ 
                    ? encodeURIComponent(`Hola ${selectedLeadForModal.name}, te contacto respecto a tu consulta en el chat: "${firstQ.slice(0, 80)}"`) 
                    : encodeURIComponent(`Hola ${selectedLeadForModal.name}, te contacto en seguimiento a tu consulta.`);
                  const waUrl = `https://wa.me/${phoneNumeric}?text=${contextMsg}`;

                  return (
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors shadow-2xs"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>Contactar por WhatsApp con contexto</span>
                    </a>
                  );
                })()}

                <button
                  type="button"
                  onClick={() => setSelectedLeadForModal(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

