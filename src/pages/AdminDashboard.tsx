import React, { useState, useEffect, useMemo } from 'react';
import { Database, Palette, TerminalSquare, ExternalLink, Ship, HardDrive, CheckCircle2, Users, Calendar, Phone, Mail, MessageSquare, Bot, User, LogIn, LogOut, Key, Eye, EyeOff, Menu, X, ChevronLeft, LineChart, Bell, Upload, Trash2, RotateCcw, Image as ImageIcon, Sparkles, HelpCircle, Zap, Check, Copy, Send, Play, ArrowRight, ShieldCheck, AlertCircle, RefreshCw, MapPin, CreditCard, Anchor, Download, Filter, Building2, Search } from 'lucide-react';
import { useChatbot, Lead, defaultQuickReplies, WebhookProvider, defaultSystemPrompt } from '../context/ChatbotContext';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { auth } from '../lib/firebase';
import { signInWithEmailAndPassword, signOut, sendPasswordResetEmail, createUserWithEmailAndPassword } from 'firebase/auth';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('leads');
  const { config, updateConfig, saveConfig, leads, isAdmin, isAdminReady, updateLeadConversation, tenantId, switchTenant } = useChatbot();
  const [saveIndicator, setSaveIndicator] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [adminMessage, setAdminMessage] = useState('');
  
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [isScraping, setIsScraping] = useState(false);
  const [manualSourceTitle, setManualSourceTitle] = useState('');
  const [manualSourceContent, setManualSourceContent] = useState('');

  const [testingWebhook, setTestingWebhook] = useState(false);
  const [webhookTestResult, setWebhookTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedJson, setCopiedJson] = useState(false);

  const [adminBranchFilter, setAdminBranchFilter] = useState<'todas' | 'resistencia' | 'posadas' | 'otras'>('todas');
  const [adminLeadSearch, setAdminLeadSearch] = useState('');
  const [isTenantModalOpen, setIsTenantModalOpen] = useState(false);
  const [newTenantInput, setNewTenantInput] = useState('');

  const adminBranchCounts = useMemo(() => {
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

  const filteredAdminLeads = useMemo(() => {
    return leads.filter(l => {
      const u = (l.ubicacion || '').toLowerCase();
      if (adminBranchFilter === 'resistencia' && !u.includes('resistencia')) return false;
      if (adminBranchFilter === 'posadas' && !u.includes('posadas')) return false;
      if (adminBranchFilter === 'otras' && (u.includes('resistencia') || u.includes('posadas'))) return false;

      if (!adminLeadSearch.trim()) return true;
      const term = adminLeadSearch.toLowerCase().trim();
      return (
        l.name.toLowerCase().includes(term) ||
        (l.email && l.email.toLowerCase().includes(term)) ||
        l.phone.toLowerCase().includes(term) ||
        (l.ubicacion && l.ubicacion.toLowerCase().includes(term)) ||
        (l.tiene_usado && l.tiene_usado.toLowerCase().includes(term))
      );
    });
  }, [leads, adminBranchFilter, adminLeadSearch]);

  const exportAdminLeadsToCsv = () => {
    if (filteredAdminLeads.length === 0) return;
    const headers = ["Fecha", "Nombre", "Teléfono", "WhatsApp Link", "Ubicación / Sucursal", "Tiene Usado", "Lancha Plan", "Interés", "Email"];
    const rows = filteredAdminLeads.map(l => {
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
    const branchLabel = adminBranchFilter === 'todas' ? 'todos' : adminBranchFilter;
    link.setAttribute("download", `admin_leads_${branchLabel}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const selectedWebhookProvider: WebhookProvider = config.webhookProvider || 'make';

  const handleSelectWebhookProvider = (provider: WebhookProvider) => {
    let targetUrl = '';
    if (provider === 'make') {
      targetUrl = config.makeWebhookUrl || (config.webhookProvider === 'make' ? config.webhookUrl || '' : '');
    } else if (provider === 'n8n') {
      targetUrl = config.n8nWebhookUrl || (config.webhookProvider === 'n8n' ? config.webhookUrl || '' : '');
    } else if (provider === 'zapier') {
      targetUrl = config.zapierWebhookUrl || (config.webhookProvider === 'zapier' ? config.webhookUrl || '' : '');
    } else if (provider === 'custom') {
      targetUrl = config.customWebhookUrl || (config.webhookProvider === 'custom' ? config.webhookUrl || '' : '');
    }

    updateConfig('webhookProvider', provider);
    if (targetUrl) {
      updateConfig('webhookUrl', targetUrl);
    }
  };

  const handleWebhookUrlChange = (value: string) => {
    updateConfig('webhookUrl', value);
    const provider = config.webhookProvider || 'make';
    if (provider === 'make') updateConfig('makeWebhookUrl', value);
    else if (provider === 'n8n') updateConfig('n8nWebhookUrl', value);
    else if (provider === 'zapier') updateConfig('zapierWebhookUrl', value);
    else if (provider === 'custom') updateConfig('customWebhookUrl', value);
  };

  const handleTestWebhook = async (customUrl?: string) => {
    const url = (customUrl || config.webhookUrl || '').trim();
    if (!url) {
      setWebhookTestResult({
        success: false,
        message: 'Por favor ingresa primero la URL del webhook antes de probar.'
      });
      return;
    }

    setTestingWebhook(true);
    setWebhookTestResult(null);

    const testPayload = {
      event: 'lead.created',
      platform: config.webhookProvider || 'n8n',
      tenantId: tenantId || 'default',
      timestamp: new Date().toISOString(),
      nombre: 'Marcos Ruiz (Prueba)',
      name: 'Marcos Ruiz (Prueba)',
      telefono: '+54 9 376 411 2233',
      phone: '+54 9 376 411 2233',
      whatsapp_number: '5493764112233',
      wa_link: 'https://wa.me/5493764112233',
      email: 'marcos.ruiz@ejemplo.com',
      ubicacion: 'Posadas',
      tiene_usado: 'Sí, Lancha Bermuda 1998 con motor',
      interesa_lanchaplan: 'Sí',
      interes: 'Cotizar Tracker nueva con Lancha Plan y entregar usado en pago',
      lead: {
        id: `test_lead_${Date.now()}`,
        name: 'Marcos Ruiz (Prueba)',
        email: 'marcos.ruiz@ejemplo.com',
        phone: '+54 9 376 411 2233',
        ubicacion: 'Posadas',
        tiene_usado: 'Sí, Lancha Bermuda 1998 con motor',
        interesa_lanchaplan: 'Sí',
        interes: 'Cotizar Tracker nueva con Lancha Plan y entregar usado en pago',
        date: new Date().toISOString(),
        inquiry: 'Hola, consulto desde Posadas por compra de embarcación y entrega de usado.',
        conversation: [
          { role: 'user', content: 'Hola, me gustaría cotizar una lancha Tracker nueva.' },
          { role: 'model', content: '¡Hola Marcos! Con gusto te asesoro. ¿Te encuentras en Resistencia o Posadas? ¿Dispones de un usado o te interesa financiar con Lancha Plan?' },
          { role: 'user', content: 'Soy de Posadas, tengo un usado Bermuda 1998 y quiero financiar por Lancha Plan. Mi WhatsApp es +5493764112233.' }
        ]
      }
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload)
      });

      if (response.ok || response.type === 'opaque' || response.status === 200 || response.status === 204) {
        setWebhookTestResult({
          success: true,
          message: `¡Prueba enviada con éxito! (Código HTTP ${response.status || 200}). Revisa la llegada del evento en tu plataforma.`
        });
      } else {
        setWebhookTestResult({
          success: false,
          message: `El servidor del webhook respondió con estado HTTP ${response.status}: ${response.statusText || 'Error de recepción'}.`
        });
      }
    } catch (err: any) {
      // Fallback with no-cors if browser blocked CORS
      try {
        await fetch(url, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify(testPayload)
        });
        const provLabel = config.webhookProvider === 'make' ? 'Make' : config.webhookProvider === 'n8n' ? 'n8n' : config.webhookProvider === 'zapier' ? 'Zapier' : 'tu servicio';
        setWebhookTestResult({
          success: true,
          message: `¡Evento enviado al webhook! (Revisa tu escenario en ${provLabel} para confirmar los datos recibidos).`
        });
      } catch (fallbackErr: any) {
        setWebhookTestResult({
          success: false,
          message: `No se pudo conectar con el webhook: ${err?.message || 'Verifica la URL ingresada'}`
        });
      }
    } finally {
      setTestingWebhook(false);
    }
  };

  const showNotice = (msg: string) => {
    setStatusNotice(msg);
    setTimeout(() => setStatusNotice(null), 4000);
  };

  const handleAddManualSource = async () => {
    if (!manualSourceTitle.trim() || !manualSourceContent.trim()) {
      alert("Por favor completa el título y el contenido.");
      return;
    }
    const newSource = {
      id: Date.now().toString(),
      type: 'text' as const,
      title: manualSourceTitle.trim(),
      content: manualSourceContent.trim()
    };
    const newSources = [...(config.dataSources || []), newSource];
    const newConfig = { ...config, dataSources: newSources };
    updateConfig('dataSources', newSources as any);
    setManualSourceTitle('');
    setManualSourceContent('');
    try {
      await saveConfig(newConfig);
      showNotice("Fuente agregada y guardada con éxito.");
    } catch {
      showNotice("Guardado localmente en este dispositivo.");
    }
  };

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert("Por favor selecciona un archivo de imagen válido (PNG, JPG, WebP o SVG).");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (!dataUrl) return;

      if (file.type === 'image/svg+xml') {
        applyLogo(dataUrl);
        return;
      }

      // Optimize image through HTML5 Canvas
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 256;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const optimizedDataUrl = canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.88);
          applyLogo(optimizedDataUrl);
        } else {
          applyLogo(dataUrl);
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const applyLogo = async (logo: string) => {
    const newConfig = { ...config, logoUrl: logo };
    updateConfig('logoUrl', logo);
    try {
      await saveConfig(newConfig);
      showNotice("Logo cargado y guardado con éxito.");
    } catch {
      showNotice("Logo guardado localmente.");
    }
  };

  const removeLogo = async () => {
    const newConfig = { ...config, logoUrl: '' };
    updateConfig('logoUrl', '');
    try {
      await saveConfig(newConfig);
      showNotice("Logo eliminado. Se usará el ícono por defecto.");
    } catch {
      showNotice("Logo eliminado localmente.");
    }
  };

  const quickRepliesList: [string, string, string] = [
    (config.quickReplies && config.quickReplies[0] !== undefined) ? config.quickReplies[0] : defaultQuickReplies[0],
    (config.quickReplies && config.quickReplies[1] !== undefined) ? config.quickReplies[1] : defaultQuickReplies[1],
    (config.quickReplies && config.quickReplies[2] !== undefined) ? config.quickReplies[2] : defaultQuickReplies[2],
  ];

  const handleQuickReplyChange = (index: number, val: string) => {
    const updated = [...quickRepliesList];
    updated[index] = val;
    updateConfig('quickReplies', updated);
  };

  const handleResetQuickReplies = async () => {
    const newConfig = { ...config, quickReplies: [...defaultQuickReplies] };
    updateConfig('quickReplies', [...defaultQuickReplies]);
    try {
      await saveConfig(newConfig);
      showNotice("Preguntas iniciales restablecidas a las sugeridas por defecto.");
    } catch {
      showNotice("Preguntas iniciales restablecidas.");
    }
  };

  const tabs = [
    { id: 'analytics', label: 'Estadísticas', icon: LineChart },
    { id: 'leads', label: 'Bandeja de Leads', icon: Users },
    { id: 'sources', label: 'Fuentes de Datos', icon: Database },
    { id: 'customize', label: 'Personalización', icon: Palette },
    { id: 'webhooks', label: 'Notificaciones & Webhooks', icon: Bell },
    { id: 'prompt', label: 'Instrucciones Base', icon: TerminalSquare },
    { id: 'deploy', label: 'Desplegar Widget', icon: ExternalLink },
  ];

  const handleSave = async () => {
    setSaveIndicator(true);
    try {
      await saveConfig();
      showNotice("¡Cambios guardados en la nube y persistidos!");
    } catch {
      showNotice("Guardado localmente en tu navegador.");
    }
    setTimeout(() => setSaveIndicator(false), 2000);
  };

  const handleAdminReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminMessage.trim() || !selectedLeadId) return;

    const lead = leads.find(l => l.id === selectedLeadId);
    if (!lead) return;

    const newConversation = [...lead.conversation, { role: 'model', content: adminMessage.trim() }];
    setAdminMessage('');
    // Ensure we set handoff flag
    await updateLeadConversation(selectedLeadId, newConversation, true);
  };

  const handleHandoff = async () => {
    if (!selectedLeadId) return;
    const lead = leads.find(l => l.id === selectedLeadId);
    if (!lead) return;
    await updateLeadConversation(selectedLeadId, lead.conversation, true);
    alert("¡Control tomado! La IA ha sido pausada para este usuario.");
  };

  // Chart data calculation
  const getChartData = () => {
    const countsByDate: Record<string, number> = {};
    leads.forEach(lead => {
      const d = new Date(lead.date);
      // Format as "DD/MM"
      const dateStr = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
      countsByDate[dateStr] = (countsByDate[dateStr] || 0) + 1;
    });

    // Create array and sort by date (naive string sort works for DD/MM only if same month, let's just reverse for simplicity or leave as is if we map chronologically)
    return Object.entries(countsByDate).map(([name, leads]) => ({ name, leads })).slice(-7); // Last 7 days
  };
  
  const chartData = getChartData();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type === "text/plain" || file.name.endsWith(".txt")) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const text = event.target?.result as string;
        if (text) {
          const newSource = {
            id: Date.now().toString(),
            type: 'file' as const,
            title: file.name,
            content: text
          };
          const newSources = [...(config.dataSources || []), newSource];
          const newConfig = { ...config, dataSources: newSources };
          updateConfig('dataSources', newSources as any);
          try {
            await saveConfig(newConfig);
            showNotice("Archivo cargado y guardado en la base de datos.");
          } catch {
            showNotice("Archivo cargado y guardado localmente.");
          }
        }
      };
      reader.readAsText(file);
    } else {
      alert("Por el momento, se admiten archivos .txt de texto plano.");
    }
  };

  const handleScrape = async () => {
    if (!scrapeUrl) return;
    try {
      setIsScraping(true);
      
      let cleaned = '';
      try {
        // Try Jina Reader first (excellent for SPAs and returns clean markdown)
        const res = await fetch(`https://r.jina.ai/${scrapeUrl}`, {
          headers: {
            'Accept': 'text/plain',
            'X-Return-Format': 'markdown'
          }
        });
        if (!res.ok) throw new Error("jina failed");
        const markdown = await res.text();
        if (markdown && markdown.length > 50) {
          cleaned = markdown.replace(/\s+/g, ' ').trim();
        } else {
          throw new Error("jina returned empty");
        }
      } catch (e0) {
        // Fallback to DOM parsing via proxies
        let htmlText = '';
        try {
          const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(scrapeUrl)}`);
          if (!res.ok) throw new Error("allorigins failed");
          const data = await res.json();
          htmlText = data.contents;
          if (!htmlText) throw new Error("empty content");
        } catch (e1) {
          try {
            const res2 = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(scrapeUrl)}`);
            if (!res2.ok) throw new Error("codetabs failed");
            htmlText = await res2.text();
          } catch (e2) {
            const res3 = await fetch(`https://corsproxy.io/?${encodeURIComponent(scrapeUrl)}`);
            if (!res3.ok) throw new Error("Error de red");
            htmlText = await res3.text();
          }
        }
        const doc = new DOMParser().parseFromString(htmlText, 'text/html');
        const elementsToRemove = doc.querySelectorAll('script, style, noscript, iframe, svg, img, nav, header, footer');
        elementsToRemove.forEach(el => el.remove());
        const content = doc.body.textContent || "";
        cleaned = content.replace(/\s+/g, ' ').trim();
      }
      
      // Probar extraer datos del sitemap si es posible (especial para Tiendanube/React SPAs)
      try {
        const urlObj = new URL(scrapeUrl);
        const sitemapUrl = `${urlObj.protocol}//${urlObj.host}/sitemap.xml`;
        const smRes = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(sitemapUrl)}`);
        if (smRes.ok) {
          const smText = await smRes.text();
          const urlsMatch = smText.match(/<loc>(.*?)<\/loc>/g);
          if (urlsMatch) {
            const urls = urlsMatch.map((l: string) => l.replace('<loc>', '').replace('</loc>', ''));
            const productUrls = urls.filter((u: string) => u.includes('/productos/') || u.includes('/p/'));
            
            if (productUrls.length > 0) {
              const maxUrls = productUrls.slice(0, 60); // fetch top 60 products to avoid huge delays
              let detailedProducts: string[] = [];
              
              // Helper for batches
              for (let i = 0; i < maxUrls.length; i += 5) {
                  const batch = maxUrls.slice(i, i + 5);
                  const results = await Promise.all(batch.map(async (u: string) => {
                       try {
                           const pRes = await fetch(`https://r.jina.ai/${u}`, {
                               headers: { 'Accept': 'text/plain', 'X-Return-Format': 'markdown' }
                           });
                           if (pRes.ok) {
                               const pText = await pRes.text();
                               const titleMatch = pText.match(/Title:\s*(.*?)\n/i);
                               let title = titleMatch ? titleMatch[1].split('-')[0].trim() : u.split('/').slice(-2, -1)[0].replace(/-/g, ' ');
                               
                               // Get description after "Descripción"
                               let desc = "";
                               const descSplit = pText.split(/Descripción/i);
                               if (descSplit.length > 1) {
                                   desc = descSplit[1].substring(0, 300).replace(/\n+/g, ' ').trim();
                               } else {
                                   // attempt meta
                                   const descMatch = pText.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/i);
                                   desc = descMatch ? descMatch[1] : pText.substring(0, 150).replace(/\n+/g, ' ');
                               }
                               if (title && desc) return `- ${title}: ${desc}`;
                           }
                       } catch (e) { }
                       return null;
                  }));
                  detailedProducts.push(...(results.filter(Boolean) as string[]));
              }
              
              if (detailedProducts.length > 0) {
                cleaned = `\n\n--- CATÁLOGO DETALLADO DE PRODUCTOS ---\n${detailedProducts.join('\n')}\n\n` + cleaned;
              } else {
                // Fallback to simpler names
                const products = productUrls.map((u: string) => {
                  const parts = u.split('/');
                  return parts[parts.length - 2] ? parts[parts.length - 2].replace(/-/g, ' ') : '';
                }).filter(Boolean);
                cleaned = `\n\n--- CATÁLOGO DE PRODUCTOS ---\nLos siguientes modelos están disponibles:\n${products.join(', ')}\n\n` + cleaned;
              }
            }
          }
        }
      } catch (smErr) {
        // Ignorar si falla la carga del sitemap
      }

      if (cleaned) {
        const newSource = {
          id: Date.now().toString(),
          type: 'url' as const,
          title: scrapeUrl,
          content: cleaned.substring(0, 100000)
        };
        const newSources = [...(config.dataSources || []), newSource];
        const newConfig = { ...config, dataSources: newSources };
        updateConfig('dataSources', newSources as any);
        setScrapeUrl('');
        try {
          await saveConfig(newConfig);
          showNotice("Sitio web analizado y guardado con éxito.");
        } catch {
          showNotice("Sitio web analizado y guardado localmente.");
        }
      } else {
        alert("No se encontró contenido relevante en esta URL.");
      }
    } catch (err: any) {
      alert("Hubo un error al leer el sitio web: " + (err.message || String(err)));
    } finally {
      setIsScraping(false);
    }
  };

  const removeDataSource = async (id: string) => {
    const newSources = (config.dataSources || []).filter(s => s.id !== id);
    const newConfig = { ...config, dataSources: newSources };
    updateConfig('dataSources', newSources as any);
    try {
      await saveConfig(newConfig);
      showNotice("Fuente eliminada.");
    } catch {
      showNotice("Fuente eliminada localmente.");
    }
  };

  const navItemClass = (id: string) => `
    flex items-center gap-3 px-4 py-3 w-full text-left rounded-lg text-[14px] font-medium transition-all mb-1 cursor-pointer
    ${activeTab === id 
      ? 'bg-blue-50 text-blue-700 font-semibold' 
      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
  `;

  // Autoselect first lead if none selected and leads are available
  const currentLeadId = selectedLeadId || filteredAdminLeads[0]?.id || leads[0]?.id;
  const selectedLead = filteredAdminLeads.find(l => l.id === currentLeadId) || leads.find(l => l.id === currentLeadId) || filteredAdminLeads[0] || leads[0];

  const [authError, setAuthError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setResetSuccess(false);
    if (!email) {
      setAuthError('Por favor ingresa tu correo electrónico.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSuccess(true);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/user-not-found') {
        setAuthError('No hay usuario registrado con este correo.');
      } else {
        setAuthError(err.message || String(err));
      }
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      if (isRegistering) {
        const { createUserWithEmailAndPassword } = await import('firebase/auth');
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setAuthError("Credenciales incorrectas.");
      } else if (err.code === 'auth/email-already-in-use') {
        setAuthError("El correo ya está registrado.");
      } else if (err.code === 'auth/weak-password') {
        setAuthError("La contraseña es muy débil (mínimo 6 caracteres).");
      } else if (err.code === 'auth/operation-not-allowed') {
        setAuthError("El inicio de sesión por correo y contraseña no está habilitado en Firebase. Debes habilitarlo en tu Consola de Firebase en Authentication > Sign-in method.");
      } else {
        setAuthError(err.message || String(err));
      }
    }
  };

  if (!isAdminReady) {
    return <div className="h-screen flex items-center justify-center text-slate-500">Cargando...</div>;
  }

  if (!isAdmin) {
    return (
      <div className="flex h-screen bg-slate-50 items-center justify-center font-sans overflow-y-auto p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 w-full max-w-sm my-auto">
          <div className="w-16 h-16 bg-blue-50 border border-blue-100 rounded-2xl mx-auto flex items-center justify-center mb-6">
             <Ship className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-2xl text-center font-bold text-slate-800 mb-2">
            {isResettingPassword ? 'Recuperar Contraseña' : 'Acceso Admin'}
          </h2>
          <p className="text-slate-500 text-center mb-6 text-sm">
            {isResettingPassword 
              ? 'Ingresa tu correo para recibir un enlace de recuperación.' 
              : isRegistering 
                ? 'Crea tu cuenta de administrador.' 
                : 'Inicia sesión con tu cuenta de administrador.'}
          </p>
          
          {authError && (
             <div className="bg-red-50 text-red-600 p-3 rounded-lg text-xs mb-6 text-center border border-red-100">
               <p>{authError}</p>
             </div>
          )}

          {resetSuccess && (
             <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm mb-6 text-center border border-green-200">
               <p>Se ha enviado un correo con instrucciones para restablecer tu contraseña.</p>
             </div>
          )}

          {isResettingPassword ? (
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Correo electrónico</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="admin@empresa.com"
                />
              </div>
              <button 
                type="submit"
                className="w-full bg-slate-900 text-white flex items-center justify-center gap-2 py-3 rounded-xl hover:bg-slate-800 transition-colors shadow-sm cursor-pointer mt-2"
              >
                Enviar correo de recuperación
              </button>
              <div className="text-center mt-4 space-y-2">
                <button 
                  type="button" 
                  onClick={() => setIsResettingPassword(false)}
                  className="text-sm text-blue-600 hover:underline block w-full"
                >
                  Volver al inicio de sesión
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Correo electrónico</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="admin@empresa.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña</label>
                <div className="relative">
                  <input 
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none pr-10"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button 
                type="submit"
                className="w-full bg-slate-900 text-white flex items-center justify-center gap-2 py-3 rounded-xl hover:bg-slate-800 transition-colors shadow-sm cursor-pointer mt-2"
              >
                <LogIn className="w-5 h-5" />
                {isRegistering ? 'Registrarse' : 'Iniciar Sesión'}
              </button>
              <div className="text-center mt-4 flex flex-col gap-2">
                <button 
                  type="button" 
                  onClick={() => setIsRegistering(!isRegistering)}
                  className="text-sm text-blue-600 hover:underline"
                >
                  {isRegistering ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
                </button>
                {!isRegistering && (
                  <button 
                    type="button" 
                    onClick={() => {
                      setIsResettingPassword(true);
                      setAuthError(null);
                      setResetSuccess(false);
                    }}
                    className="text-sm text-slate-500 hover:text-slate-700 hover:underline"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-50 font-sans overflow-hidden">
      
      {/* Sidebar Mobile Toggle Header (visible only on mobile) */}
      <div className="md:hidden flex items-center justify-between px-4 h-16 bg-white border-b border-slate-200 shrink-0 z-30">
        <div className="flex items-center gap-2.5">
           <div className="w-8 h-8 border border-slate-200 rounded-md bg-slate-50 flex items-center justify-center shadow-sm">
              <Ship className="w-5 h-5 text-blue-600" />
           </div>
           <span className="font-bold text-slate-800 tracking-tight">NauticAdmin</span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-slate-600 hover:bg-slate-50 rounded-lg"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`
        w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-slate-200 flex-col shrink-0 z-20
        ${isMobileMenuOpen ? 'flex absolute top-16 bottom-0 left-0 right-0 h-[calc(100vh-4rem)]' : 'hidden md:flex'}
      `}>
        <div className="hidden md:flex h-16 items-center px-6 border-b border-slate-100 justify-between shrink-0">
          <div className="flex items-center gap-2.5">
             <div className="w-8 h-8 border border-slate-200 rounded-md bg-slate-50 flex items-center justify-center shadow-sm">
                <Ship className="w-5 h-5 text-blue-600" />
             </div>
             <span className="font-bold text-slate-800 tracking-tight">NauticAdmin</span>
          </div>
        </div>
        
        <div className="p-4 flex-1 overflow-y-auto">
          <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-3 px-2">Gestión de IA</div>
          <nav>
            {tabs.map(tab => (
              <button 
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setIsMobileMenuOpen(false);
                }}
                className={navItemClass(tab.id)}
              >
                <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-blue-600' : 'text-slate-400'}`} />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
        
        <div className="p-4 border-t border-slate-100 flex items-center justify-between">
           <span className="text-xs text-slate-400">Admin Activo</span>
           <div className="flex gap-2">
             <button 
               onClick={async () => {
                 if (auth.currentUser?.email) {
                   try {
                     await sendPasswordResetEmail(auth, auth.currentUser.email);
                     alert("Se ha enviado un correo para modificar tu contraseña.");
                   } catch {
                     alert("Error al intentar enviar el correo de recuperación.");
                   }
                 }
               }} 
               className="text-slate-400 hover:text-blue-600 transition-colors cursor-pointer" 
               title="Cambiar contraseña"
             >
                <Key className="w-4 h-4" />
             </button>
             <button onClick={() => signOut(auth)} className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer" title="Cerrar sesión">
                <LogOut className="w-4 h-4" />
             </button>
           </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Topbar */}
        <header className="h-16 flex items-center justify-between px-4 md:px-8 bg-white border-b border-slate-200 shrink-0 shadow-sm z-10">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-slate-800">
              {tabs.find(t => t.id === activeTab)?.label}
            </h1>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            {/* Tenant / Client Switcher Button */}
            <button
              type="button"
              onClick={() => {
                setNewTenantInput(tenantId || '');
                setIsTenantModalOpen(true);
              }}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Cambiar cliente o sucursal principal"
            >
              <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="hidden sm:inline text-slate-500 font-normal">Cliente:</span>
              <span className="font-mono text-blue-700 font-bold truncate max-w-[90px] sm:max-w-[130px]">{tenantId || 'default'}</span>
            </button>

            {statusNotice && (
              <span className="text-xs md:text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{statusNotice}</span>
              </span>
            )}
            {saveIndicator && !statusNotice && (
              <span className="text-sm font-medium text-emerald-600 hidden md:flex items-center gap-1.5 animate-pulse">
                <CheckCircle2 className="w-4 h-4" /> Guardando...
              </span>
            )}
            <a 
              href={`#/client-dashboard${tenantId ? `?tenant=${tenantId}` : ''}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="bg-blue-50 text-blue-600 border border-blue-200 px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-medium hover:bg-blue-100 transition-colors shadow-sm cursor-pointer flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4 hidden md:block" />
              <span className="hidden md:block">Ver Tablero del Cliente</span>
              <span className="md:hidden">Tablero</span>
            </a>
            <button onClick={handleSave} className="bg-slate-900 text-white px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-medium hover:bg-slate-800 transition-colors shadow-sm cursor-pointer">
              <span className="hidden md:block">Guardar Cambios</span>
              <span className="md:hidden">Guardar</span>
            </button>
          </div>
        </header>

        {/* Dynamic Panel */}
        <div className={`flex-1 overflow-y-auto ${activeTab === 'leads' ? 'p-0' : 'p-4 md:p-8'} relative`}>
          <div className={`${activeTab === 'leads' ? 'max-w-full h-full flex' : 'max-w-4xl mx-auto pb-32'}`}>
            
            {activeTab === 'analytics' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-medium text-slate-500 mb-1">Total de Leads</h3>
                    <p className="text-4xl font-bold text-slate-900">{leads.length}</p>
                    <p className="text-sm text-emerald-600 mt-2 font-medium">Tasa de captura: Excelente</p>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center shrink-0">
                            <Bell className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-slate-900">Notificaciones y Webhooks</h3>
                            <p className="text-xs text-slate-500">Conecta Make, n8n, Zapier o Custom</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveTab('webhooks')}
                          className="text-xs font-semibold text-purple-600 hover:text-purple-800 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          Ver Guía <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Provider Selector Pills */}
                      <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-100/80 rounded-xl mb-3">
                        {[
                          { id: 'make' as const, label: 'Make', badge: 'Make.com' },
                          { id: 'n8n' as const, label: 'n8n', badge: 'Workflows' },
                          { id: 'zapier' as const, label: 'Zapier', badge: 'Zaps' },
                          { id: 'custom' as const, label: 'Custom', badge: 'API' },
                        ].map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => handleSelectWebhookProvider(p.id)}
                            className={`py-1.5 px-2 text-xs font-medium rounded-lg transition-all text-center cursor-pointer ${
                              selectedWebhookProvider === p.id 
                                ? p.id === 'make'
                                  ? 'bg-purple-600 text-white shadow-sm'
                                  : p.id === 'n8n'
                                    ? 'bg-orange-600 text-white shadow-sm'
                                    : p.id === 'zapier'
                                      ? 'bg-amber-600 text-white shadow-sm'
                                      : 'bg-blue-600 text-white shadow-sm'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>

                      <div className="relative">
                        <input 
                          type="text" 
                          placeholder={
                            selectedWebhookProvider === 'make' 
                              ? "Ej: https://hook.eu1.make.com/xxxxxxxxxxxxxxxx" 
                              : selectedWebhookProvider === 'n8n'
                                ? "Ej: https://n8n.tudominio.com/webhook/..."
                                : selectedWebhookProvider === 'zapier'
                                  ? "Ej: https://hooks.zapier.com/hooks/catch/..."
                                  : "Ej: https://api.tuempresa.com/v1/leads"
                          }
                          value={config.webhookUrl || ''}
                          onChange={(e) => handleWebhookUrlChange(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                      <div className="flex items-center gap-1 text-slate-500 truncate max-w-[65%]">
                        <span className={`w-2 h-2 rounded-full ${config.webhookUrl ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                        <span className="truncate">
                          {config.webhookUrl ? `Conectado a ${selectedWebhookProvider.toUpperCase()}` : 'Sin URL configurada'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleTestWebhook()}
                        disabled={testingWebhook || !config.webhookUrl}
                        className="px-2.5 py-1 bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-md font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        {testingWebhook ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <Play className="w-3 h-3" />
                        )}
                        <span>Probar</span>
                      </button>
                    </div>

                    {webhookTestResult && (
                      <div className={`mt-2 p-2 rounded-lg text-xs flex items-start gap-1.5 ${
                        webhookTestResult.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                      }`}>
                        {webhookTestResult.success ? <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
                        <span className="leading-tight">{webhookTestResult.message}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-80 flex flex-col">
                  <h3 className="text-base font-bold text-slate-900 mb-4">Leads Generados (Últimos Días)</h3>
                  <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                        <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dx={-10} />
                        <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                        <Bar dataKey="leads" fill={config.primaryColor || "#2563eb"} radius={[4, 4, 0, 0]} maxBarSize={50} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'leads' && (
              <div className="flex w-full h-full animate-in fade-in slide-in-from-bottom-2 duration-300">
                {/* Leads List */}
                <div className={`w-full md:w-1/3 border-r border-slate-200 bg-white h-full overflow-y-auto flex-col shrink-0 ${selectedLeadId ? 'hidden md:flex' : 'flex'}`}>
                  {/* Branch Filter & Search Header */}
                  <div className="p-3 bg-slate-50 border-b border-slate-200 space-y-2 sticky top-0 z-10">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                        <button
                          type="button"
                          onClick={() => setAdminBranchFilter('todas')}
                          className={`px-2 py-1 rounded text-xs font-semibold cursor-pointer transition-colors ${
                            adminBranchFilter === 'todas'
                              ? 'bg-blue-600 text-white'
                              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          Todas ({adminBranchCounts.total})
                        </button>
                        <button
                          type="button"
                          onClick={() => setAdminBranchFilter('resistencia')}
                          className={`px-2 py-1 rounded text-xs font-semibold cursor-pointer transition-colors flex items-center gap-0.5 ${
                            adminBranchFilter === 'resistencia'
                              ? 'bg-sky-600 text-white'
                              : 'bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100'
                          }`}
                        >
                          <MapPin className="w-2.5 h-2.5" /> Res ({adminBranchCounts.resistencia})
                        </button>
                        <button
                          type="button"
                          onClick={() => setAdminBranchFilter('posadas')}
                          className={`px-2 py-1 rounded text-xs font-semibold cursor-pointer transition-colors flex items-center gap-0.5 ${
                            adminBranchFilter === 'posadas'
                              ? 'bg-teal-600 text-white'
                              : 'bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100'
                          }`}
                        >
                          <MapPin className="w-2.5 h-2.5" /> Pos ({adminBranchCounts.posadas})
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={exportAdminLeadsToCsv}
                        disabled={filteredAdminLeads.length === 0}
                        className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                        title="Exportar a CSV"
                      >
                        <Download className="w-3.5 h-3.5 text-blue-600" />
                      </button>
                    </div>

                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={adminLeadSearch}
                        onChange={(e) => setAdminLeadSearch(e.target.value)}
                        placeholder="Buscar por nombre, teléfono o ciudad..."
                        className="w-full pl-8 pr-2.5 py-1 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {filteredAdminLeads.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center">
                      <Users className="w-12 h-12 mb-4 text-slate-300" />
                      <p className="font-medium text-slate-600 mb-1">
                        {leads.length === 0 ? 'Aún no hay Leads' : 'Sin resultados para este filtro'}
                      </p>
                      <p className="text-sm">
                        {leads.length === 0 ? 'Los usuarios interesados que brinden sus datos aparecerán aquí.' : 'Prueba cambiando la sucursal o el término de búsqueda.'}
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {filteredAdminLeads.map(lead => (
                        <button 
                          key={lead.id}
                          onClick={() => setSelectedLeadId(lead.id || null)}
                          className={`w-full p-5 text-left flex gap-4 items-start transition-colors cursor-pointer ${currentLeadId === lead.id ? 'bg-blue-50/50' : 'hover:bg-slate-50'}`}
                        >
                          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 font-bold shadow-sm">
                            {lead.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <h3 className="font-semibold text-slate-800 truncate">{lead.name}</h3>
                              <span className="text-[11px] text-slate-400 shrink-0 whitespace-nowrap">
                                {new Date(lead.date).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="text-sm text-slate-500 truncate">{lead.email || 'Sin correo'}</div>
                            {(lead.ubicacion || lead.tiene_usado || lead.interesa_lanchaplan) && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {lead.ubicacion && (
                                  <span className="bg-sky-50 text-sky-700 border border-sky-100 text-[10px] px-1.5 py-0.5 rounded font-medium inline-flex items-center gap-1">
                                    <MapPin className="w-2.5 h-2.5 text-sky-600" />
                                    {lead.ubicacion}
                                  </span>
                                )}
                                {lead.tiene_usado && (
                                  <span className="bg-amber-50 text-amber-700 border border-amber-100 text-[10px] px-1.5 py-0.5 rounded font-medium inline-flex items-center gap-1 truncate max-w-[130px]">
                                    <Anchor className="w-2.5 h-2.5 text-amber-600" />
                                    Usado: {lead.tiene_usado}
                                  </span>
                                )}
                                {lead.interesa_lanchaplan && (
                                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] px-1.5 py-0.5 rounded font-medium inline-flex items-center gap-1">
                                    <CreditCard className="w-2.5 h-2.5 text-emerald-600" />
                                    Plan: {lead.interesa_lanchaplan}
                                  </span>
                                )}
                              </div>
                            )}
                            {lead.conversation && lead.conversation.length > 0 && (
                              <p className="text-xs text-slate-500 mt-1.5 line-clamp-1 italic bg-slate-50 border border-slate-100/80 px-2 py-1 rounded-md">
                                <span className="font-semibold text-slate-600 not-italic">Consulta: </span>
                                "{lead.conversation.find(m => m.role === 'user')?.content || lead.conversation[0]?.content}"
                              </p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Lead Detail & Conversation */}
                <div className={`w-full md:w-2/3 h-full flex-col bg-slate-50/50 ${!selectedLeadId && leads.length > 0 ? 'hidden md:flex' : 'flex'}`}>
                  {selectedLead ? (
                    <>
                      {/* Lead Contact Info Card */}
                      <div className="p-4 md:p-6 shrink-0 bg-white border-b border-slate-200 shadow-sm z-10 relative">
                        <button 
                          onClick={() => setSelectedLeadId(null)}
                          className="md:hidden mb-4 text-slate-500 hover:text-slate-700 flex items-center gap-2 text-sm font-medium transition-colors"
                        >
                          <ChevronLeft className="w-4 h-4" /> Volver a la lista
                        </button>
                        <div className="flex items-center gap-4 mb-5">
                          <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xl font-bold border-2 border-white shadow-md">
                            {selectedLead.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h2 className="text-xl font-bold text-slate-800">{selectedLead.name}</h2>
                            <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1.5 font-medium">
                              <Calendar className="w-3.5 h-3.5" /> 
                              Capturado el {new Date(selectedLead.date).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl flex items-center gap-3">
                            <Phone className="w-5 h-5 text-emerald-600 shrink-0" />
                            <div>
                              <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">Teléfono</p>
                              <p className="font-medium text-slate-800 text-sm mt-0.5">{selectedLead.phone}</p>
                            </div>
                          </div>
                          <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl flex items-center gap-3">
                            <Mail className="w-5 h-5 text-blue-600 shrink-0" />
                            <div>
                              <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">Correo Electrónico</p>
                              <p className="font-medium text-slate-800 text-sm mt-0.5 truncate">{selectedLead.email || 'Sin correo'}</p>
                            </div>
                          </div>
                          <div className="bg-sky-50/60 border border-sky-100 p-3 rounded-xl flex items-center gap-3">
                            <MapPin className="w-5 h-5 text-sky-600 shrink-0" />
                            <div>
                              <p className="text-[11px] text-sky-700 font-semibold uppercase tracking-wide">Ubicación / Sucursal</p>
                              <p className="font-bold text-sky-900 text-sm mt-0.5">{selectedLead.ubicacion || 'Pendiente'}</p>
                            </div>
                          </div>
                          <div className="bg-amber-50/60 border border-amber-100 p-3 rounded-xl flex items-center gap-3">
                            <Anchor className="w-5 h-5 text-amber-600 shrink-0" />
                            <div>
                              <p className="text-[11px] text-amber-700 font-semibold uppercase tracking-wide">Entrega Usado</p>
                              <p className="font-medium text-amber-900 text-sm mt-0.5 truncate">{selectedLead.tiene_usado || 'No especificado'}</p>
                            </div>
                          </div>
                          <div className="bg-emerald-50/60 border border-emerald-100 p-3 rounded-xl flex items-center gap-3">
                            <CreditCard className="w-5 h-5 text-emerald-600 shrink-0" />
                            <div>
                              <p className="text-[11px] text-emerald-700 font-semibold uppercase tracking-wide">Sistema Lancha Plan</p>
                              <p className="font-medium text-emerald-900 text-sm mt-0.5">{selectedLead.interesa_lanchaplan || 'No especificado'}</p>
                            </div>
                          </div>
                          {selectedLead.interes && (
                            <div className="bg-purple-50/60 border border-purple-100 p-3 rounded-xl flex items-center gap-3">
                              <Sparkles className="w-5 h-5 text-purple-600 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-[11px] text-purple-700 font-semibold uppercase tracking-wide">Interés Comercial</p>
                                <p className="font-medium text-purple-900 text-sm mt-0.5 truncate">{selectedLead.interes}</p>
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {!selectedLead.handoff && (
                          <div className="mt-4 flex justify-end">
                            <button 
                              onClick={handleHandoff}
                              className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors shadow-sm cursor-pointer flex items-center gap-2"
                            >
                              <User className="w-4 h-4" /> Tomar el control del chat
                            </button>
                          </div>
                        )}
                        {selectedLead.handoff && (
                          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-100 rounded-lg flex items-center gap-3 text-emerald-800 text-sm font-medium">
                            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                              <User className="w-4 h-4" />
                            </div>
                            La IA está en pausa. Estás controlando este chat en vivo.
                          </div>
                        )}
                        
                      </div>

                      {/* Chat Transcript */}
                      <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        <div className="flex items-center gap-2 text-slate-400 text-sm mb-6 mt-2 before:h-px before:flex-1 before:bg-slate-200 after:h-px after:flex-1 after:bg-slate-200">
                          <MessageSquare className="w-4 h-4" />
                          <span className="font-medium tracking-wide">Transcripción de la Conversación</span>
                        </div>
                        
                        {selectedLead.conversation.map((msg, idx) => {
                          const isUser = msg.role === 'user';
                          return (
                            <div key={idx} className={`flex max-w-[85%] ${isUser ? 'ml-auto justify-end' : 'mr-auto justify-start'}`}>
                              {!isUser && (
                                <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center shrink-0 mr-3 mt-1 shadow-sm">
                                  <Bot className="w-4 h-4" />
                                </div>
                              )}
                              <div 
                                className={`px-5 py-3.5 shadow-sm text-[14px] leading-relaxed relative ${
                                  isUser 
                                    ? 'bg-blue-600 text-white rounded-2xl rounded-tr-sm' 
                                    : 'bg-white border border-slate-200 text-slate-700 rounded-2xl rounded-tl-sm'
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
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (href) {
                                              window.open(href, '_blank', 'noopener,noreferrer');
                                            }
                                          }}
                                          className="text-blue-600 underline font-semibold hover:text-blue-800 inline-flex items-center gap-1 break-words cursor-pointer"
                                          {...props}
                                        >
                                          <span>{children}</span>
                                          <ExternalLink className="w-3.5 h-3.5 inline shrink-0" />
                                        </a>
                                      )
                                    }}
                                  >
                                    {msg.content}
                                  </Markdown>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {selectedLead.handoff && (
                        <div className="p-4 bg-white border-t border-slate-200">
                          <form onSubmit={handleAdminReply} className="flex gap-2 relative">
                            <input
                              type="text"
                              value={adminMessage}
                              onChange={(e) => setAdminMessage(e.target.value)}
                              placeholder="Escribe un mensaje al cliente..."
                              className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                            <button
                              type="submit"
                              disabled={!adminMessage.trim()}
                              className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                            >
                              Enviar
                            </button>
                          </form>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center bg-slate-50">
                      <MessageSquare className="w-12 h-12 mb-4 text-slate-300" />
                      <p className="font-medium text-slate-600">Selecciona un lead</p>
                      <p className="text-sm">Los detalles de contacto y la conversación completa aparecerán aquí.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'sources' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Conocimiento del Bot</h2>
                  <p className="text-slate-500 mt-1 text-sm leading-relaxed max-w-2xl">
                    Sube archivos, establece enlaces web o pega texto plano. El chatbot utilizará exactamente este contenido para responder preguntas. Configura especificaciones de embarcaciones, tarifas de amarras y FAQs.
                  </p>
                </div>
                
                <div className="bg-white border text-center border-slate-200 rounded-2xl p-10 shadow-sm border-dashed">
                   <HardDrive className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                   <p className="font-semibold text-slate-600 mb-1">Carga de archivos</p>
                   <p className="text-sm text-slate-400 mb-4">Soporta .txt (Se agregará como una nueva fuente de datos)</p>
                   <label className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 shadow-sm cursor-pointer">
                     Examinar Archivos
                     <input type="file" accept=".txt,text/plain" className="hidden" onChange={handleFileUpload} />
                   </label>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                   <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                     <ExternalLink className="w-4 h-4 text-slate-400" />
                     Escanear Sitio Web
                   </h3>
                   <p className="text-sm text-slate-500 mb-4">
                     Ingresa la URL de la web que quieres que analicemos (ej. https://www.nauticaairelibre.com.ar/). Toda la información de texto obtenida se sumará a tus fuentes de datos.
                   </p>
                   <div className="flex gap-3">
                     <input 
                       type="url"
                       value={scrapeUrl}
                       onChange={(e) => setScrapeUrl(e.target.value)}
                       placeholder="https://midominio.com"
                       className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-inner"
                     />
                     <button
                       onClick={handleScrape}
                       disabled={isScraping || !scrapeUrl}
                       className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-900 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                     >
                       {isScraping ? 'Analizando...' : 'Analizar Web'}
                     </button>
                   </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                   <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                     <TerminalSquare className="w-4 h-4 text-slate-400" />
                     Añadir Fuente Manual (Markdown / HTML)
                   </h3>
                   <p className="text-sm text-slate-500 mb-4">
                     Pega texto, descripciones, enlaces a imágenes (en formato markdown <code className="bg-slate-100 px-1 rounded">![alt](url)</code>) o embeds de videos (ej. iframes de YouTube).
                   </p>
                   <div className="space-y-3">
                     <input 
                       type="text"
                       value={manualSourceTitle}
                       onChange={(e) => setManualSourceTitle(e.target.value)}
                       placeholder="Título descriptivo (ej. Catálogo de Yates)"
                       className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-inner"
                     />
                     <textarea 
                       value={manualSourceContent}
                       onChange={(e) => setManualSourceContent(e.target.value)}
                       placeholder="Contenido... (puedes pegar HTML o markdown aquí)"
                       rows={4}
                       className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-inner"
                     />
                     <button
                       onClick={handleAddManualSource}
                       disabled={!manualSourceTitle.trim() || !manualSourceContent.trim()}
                       className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-900 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                     >
                       Añadir Fuente
                     </button>
                   </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <h3 className="font-semibold text-slate-800 mb-4">Fuentes de Datos Analizadas</h3>
                  {config.dataSources && config.dataSources.length > 0 ? (
                    <div className="space-y-4">
                      {config.dataSources.map(source => (
                        <div key={source.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200 gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">{source.type}</span>
                              <h4 className="font-medium text-sm text-slate-700 truncate" title={source.title}>{source.title}</h4>
                            </div>
                            <p className="text-xs text-slate-500 truncate">{source.content.substring(0, 100)}...</p>
                          </div>
                          <button 
                            onClick={() => removeDataSource(source.id)}
                            className="shrink-0 text-red-500 hover:text-red-700 text-xs font-semibold px-3 py-1.5 rounded-lg border border-transparent hover:border-red-200 hover:bg-red-50 transition-colors cursor-pointer"
                          >
                            Eliminar
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center p-8 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl">
                      <p className="text-sm font-medium text-slate-500">No hay fuentes de datos analizadas</p>
                      <p className="text-xs text-slate-400 mt-1">Sube un archivo o escanea una URL para incorporar información.</p>
                    </div>
                  )}
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                   <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                     <TerminalSquare className="w-4 h-4 text-slate-400" />
                     Datos en texto plano (Base Activa)
                   </h3>
                   <textarea 
                     value={config.knowledgeBase}
                     onChange={(e) => updateConfig('knowledgeBase', e.target.value)}
                     onBlur={() => {
                       saveConfig();
                       showNotice("Base de datos en texto plano guardada.");
                     }}
                     className="w-full h-80 bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-inner"
                     placeholder="Escribe o pega el contenido aquí..."
                   />
                   <p className="text-xs text-slate-400 mt-2 text-right">Los cambios impactan el comportamiento del widget instantáneamente.</p>
                </div>
              </div>
            )}

            {activeTab === 'customize' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Apariencia del Widget</h2>
                  <p className="text-slate-500 mt-1 text-sm leading-relaxed max-w-2xl">
                    Personaliza los colores, textos iniciales e identidad visual de tu asesor virtual para alinearla con la marca de tu Marina.
                  </p>
                </div>

                <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 space-y-8">
                  {/* Nombre del Chatbot */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-2">Nombre del Chatbot</label>
                    <input 
                      type="text" 
                      value={config.name}
                      onChange={(e) => updateConfig('name', e.target.value)}
                      className="w-full max-w-md p-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-800 font-medium"
                    />
                  </div>
                  
                  {/* Logo del Chatbot desde dispositivo y URL */}
                  <div className="pt-2 border-t border-slate-100">
                    <label className="block text-sm font-semibold text-slate-800 mb-1 flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-blue-600" />
                      Logo o Ícono del Chatbot
                    </label>
                    <p className="text-xs text-slate-500 mb-4">
                      Sube el logo de tu empresa desde tu celular o computadora. Reemplazará al icono genérico en el botón flotante, cabecera y respuestas del bot.
                    </p>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 p-4 bg-slate-50 border border-slate-200/80 rounded-2xl">
                      {/* Vista previa en vivo del avatar */}
                      <div className="flex items-center gap-3 shrink-0">
                        <div 
                          className="w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden shadow-md border-2 border-white relative transition-transform hover:scale-105"
                          style={{ backgroundColor: config.logoUrl ? '#ffffff' : config.primaryColor }}
                        >
                          {config.logoUrl ? (
                            <img 
                              src={config.logoUrl} 
                              alt="Logo actual" 
                              className="w-full h-full object-cover" 
                            />
                          ) : (
                            <Bot className="w-8 h-8 text-white" />
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-700">
                            {config.logoUrl ? 'Logo personalizado' : 'Ícono por defecto'}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {config.logoUrl ? 'Activo en el widget' : 'Sin logo cargado'}
                          </p>
                        </div>
                      </div>

                      {/* Botones de acción para subir o eliminar */}
                      <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                        <label className="cursor-pointer inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-xs font-semibold shadow-sm transition-all active:scale-95">
                          <Upload className="w-4 h-4" />
                          <span>Subir desde dispositivo</span>
                          <input 
                            type="file" 
                            accept="image/png,image/jpeg,image/webp,image/svg+xml" 
                            className="hidden" 
                            onChange={handleLogoFileUpload} 
                          />
                        </label>

                        {config.logoUrl && (
                          <button
                            type="button"
                            onClick={removeLogo}
                            className="inline-flex items-center gap-1.5 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors shadow-sm"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Quitar logo</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Opción secundaria: URL directa */}
                    <div className="mt-3">
                      <details className="text-xs text-slate-600 group">
                        <summary className="cursor-pointer text-slate-500 hover:text-slate-800 font-medium select-none flex items-center gap-1.5 w-fit">
                          <span>O ingresar enlace URL directo de la imagen</span>
                        </summary>
                        <div className="mt-2.5">
                          <input 
                            type="url" 
                            value={config.logoUrl || ''}
                            onChange={(e) => updateConfig('logoUrl', e.target.value)}
                            placeholder="https://ejemplo.com/logo.png"
                            className="w-full max-w-md p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-800 text-xs"
                          />
                        </div>
                      </details>
                    </div>
                  </div>

                  {/* Mensaje Inicial */}
                  <div className="pt-2 border-t border-slate-100">
                    <label className="block text-sm font-semibold text-slate-800 mb-1">Mensaje Inicial (Saludo)</label>
                    <p className="text-xs text-slate-500 mb-2">
                      Es el texto visible en la burbuja proactiva que flota sobre el botón y el primer saludo que da el bot al abrirse.
                    </p>
                    <textarea 
                      value={config.welcomeMessage}
                      onChange={(e) => updateConfig('welcomeMessage', e.target.value)}
                      rows={3}
                      className="w-full max-w-xl p-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-800 text-sm leading-relaxed"
                    />
                  </div>

                  {/* 3 Preguntas Iniciales Rápidas Elegibles */}
                  <div className="pt-2 border-t border-slate-100">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <div>
                        <label className="block text-sm font-semibold text-slate-800 flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-amber-500" />
                          Preguntas Frecuentes Iniciales (3 Opciones Rápidas)
                        </label>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Estas 3 opciones aparecen como botones rápidos cuando el cliente abre el chat. Puedes personalizarlas para tu negocio o dejarlas con los valores sugeridos por defecto si no deseas modificarlas.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleResetQuickReplies}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors shrink-0 w-fit"
                        title="Restablecer preguntas sugeridas"
                      >
                        <RotateCcw className="w-3 h-3 text-slate-500" />
                        <span>Restablecer por defecto</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Opción 1</label>
                        <input 
                          type="text" 
                          value={quickRepliesList[0] || ''}
                          onChange={(e) => handleQuickReplyChange(0, e.target.value)}
                          placeholder="Ej: Quiero ver el catálogo"
                          className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-800 text-xs font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Opción 2</label>
                        <input 
                          type="text" 
                          value={quickRepliesList[1] || ''}
                          onChange={(e) => handleQuickReplyChange(1, e.target.value)}
                          placeholder="Ej: Consultar envíos"
                          className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-800 text-xs font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Opción 3</label>
                        <input 
                          type="text" 
                          value={quickRepliesList[2] || ''}
                          onChange={(e) => handleQuickReplyChange(2, e.target.value)}
                          placeholder="Ej: Hablar con un asesor"
                          className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-800 text-xs font-medium"
                        />
                      </div>
                    </div>

                    {/* Previsualización de los botones de pregunta rápida */}
                    <div className="mt-4 p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-[11px] font-semibold text-slate-500 mb-2">Vista previa de los botones para el usuario:</p>
                      <div className="flex flex-wrap gap-2">
                        {quickRepliesList.filter(Boolean).map((q, idx) => (
                          <span 
                            key={idx} 
                            className="px-3 py-1.5 bg-white border rounded-xl text-xs font-medium shadow-2xs"
                            style={{ color: config.primaryColor, borderColor: `${config.primaryColor}50` }}
                          >
                            {q}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Color de Acento */}
                  <div className="pt-2 border-t border-slate-100">
                    <label className="block text-sm font-semibold text-slate-800 mb-1">Color de acento (Identidad de Marca)</label>
                    <p className="text-xs text-slate-500 mb-3">Define el tono principal de los botones, burbujas y acentos del widget.</p>
                    <div className="flex gap-4">
                      {['#0369A1', '#0F172A', '#059669', '#E11D48', '#7C3AED', '#EA580C'].map(color => (
                        <button 
                          key={color}
                          onClick={() => updateConfig('primaryColor', color)}
                          className="w-10 h-10 rounded-full cursor-pointer shadow-md transform hover:scale-110 transition-transform relative border-2 border-white"
                          style={{ 
                            backgroundColor: color, 
                            outline: config.primaryColor === color ? `2px solid ${color}` : 'none',
                            outlineOffset: '2px'
                          }}
                        >
                          {config.primaryColor === color && (
                            <CheckCircle2 className="w-5 h-5 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'webhooks' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Notificaciones y Webhooks</h2>
                  <p className="text-slate-500 mt-1 text-sm leading-relaxed max-w-3xl">
                    Conecta tu asistente con <strong>Make</strong>, <strong>n8n</strong>, <strong>Zapier</strong> o tu propio servidor. Cada vez que un usuario comparta su correo, teléfono o datos de contacto, se enviará una notificación instantánea con todo el historial de la conversación.
                  </p>
                </div>

                {/* Integration Providers Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Make (Make.com) */}
                  <div
                    onClick={() => handleSelectWebhookProvider('make')}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                      selectedWebhookProvider === 'make'
                        ? 'bg-purple-50/70 border-purple-500 shadow-md ring-2 ring-purple-500/20'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-fuchsia-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                          <Zap className="w-5 h-5" />
                        </div>
                        <span className="text-[11px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                          Recomendado
                        </span>
                      </div>
                      <h3 className="font-bold text-slate-900 text-base">Make (Integromat)</h3>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        Crea escenarios visuales potentes en Make.com con el módulo <em>Custom Webhook</em>.
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-purple-100/60 flex items-center justify-between text-xs">
                      <span className="text-purple-700 font-medium">Automatizaciones Make</span>
                      {selectedWebhookProvider === 'make' && (
                        <CheckCircle2 className="w-4 h-4 text-purple-600" />
                      )}
                    </div>
                  </div>

                  {/* n8n */}
                  <div
                    onClick={() => handleSelectWebhookProvider('n8n')}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                      selectedWebhookProvider === 'n8n'
                        ? 'bg-orange-50/70 border-orange-500 shadow-md ring-2 ring-orange-500/20'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                          <RotateCcw className="w-5 h-5" />
                        </div>
                        <span className="text-[11px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                          Self-Hosted
                        </span>
                      </div>
                      <h3 className="font-bold text-slate-900 text-base">n8n Workflow</h3>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        Conecta un nodo <em>Webhook</em> en n8n Cloud o en tu propia instancia auto-hospedada.
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-orange-100/60 flex items-center justify-between text-xs">
                      <span className="text-orange-700 font-medium">Flujos n8n</span>
                      {selectedWebhookProvider === 'n8n' && (
                        <CheckCircle2 className="w-4 h-4 text-orange-600" />
                      )}
                    </div>
                  </div>

                  {/* Zapier */}
                  <div
                    onClick={() => handleSelectWebhookProvider('zapier')}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                      selectedWebhookProvider === 'zapier'
                        ? 'bg-amber-50/70 border-amber-500 shadow-md ring-2 ring-amber-500/20'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                          <Sparkles className="w-5 h-5" />
                        </div>
                        <span className="text-[11px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          No-Code
                        </span>
                      </div>
                      <h3 className="font-bold text-slate-900 text-base">Zapier</h3>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        Usa el trigger <em>Catch Hook</em> de Webhooks by Zapier para conectar miles de aplicaciones.
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-amber-100/60 flex items-center justify-between text-xs">
                      <span className="text-amber-800 font-medium">Zaps</span>
                      {selectedWebhookProvider === 'zapier' && (
                        <CheckCircle2 className="w-4 h-4 text-amber-600" />
                      )}
                    </div>
                  </div>

                  {/* Custom Webhook / API */}
                  <div
                    onClick={() => handleSelectWebhookProvider('custom')}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                      selectedWebhookProvider === 'custom'
                        ? 'bg-blue-50/70 border-blue-500 shadow-md ring-2 ring-blue-500/20'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                          <TerminalSquare className="w-5 h-5" />
                        </div>
                        <span className="text-[11px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                          REST API
                        </span>
                      </div>
                      <h3 className="font-bold text-slate-900 text-base">API Personalizada</h3>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        Envía peticiones HTTP POST en formato JSON a tu propio backend, CRM o microservicio.
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-blue-100/60 flex items-center justify-between text-xs">
                      <span className="text-blue-700 font-medium">Endpoint HTTP</span>
                      {selectedWebhookProvider === 'custom' && (
                        <CheckCircle2 className="w-4 h-4 text-blue-600" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Configuration Panel for Selected Provider */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700">
                          {selectedWebhookProvider === 'make' ? 'Make.com' : selectedWebhookProvider === 'n8n' ? 'n8n' : selectedWebhookProvider === 'zapier' ? 'Zapier' : 'API HTTP'}
                        </span>
                        <h3 className="text-lg font-bold text-slate-900">
                          Configuración del Webhook para {selectedWebhookProvider === 'make' ? 'Make' : selectedWebhookProvider === 'n8n' ? 'n8n' : selectedWebhookProvider === 'zapier' ? 'Zapier' : 'tu Endpoint'}
                        </h3>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Pega la URL proporcionada por {selectedWebhookProvider === 'make' ? 'tu Custom Webhook en Make' : selectedWebhookProvider === 'n8n' ? 'tu nodo Webhook en n8n' : selectedWebhookProvider === 'zapier' ? 'tu Catch Hook en Zapier' : 'tu servidor'} y prueba la conexión.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleTestWebhook()}
                        disabled={testingWebhook || !config.webhookUrl}
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                      >
                        {testingWebhook ? (
                          <RefreshCw className="w-4 h-4 animate-spin text-purple-300" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        <span>{testingWebhook ? 'Enviando prueba...' : 'Enviar Lead de Prueba'}</span>
                      </button>
                    </div>
                  </div>

                  {/* URL Input */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                      URL del Webhook ({selectedWebhookProvider === 'make' ? 'Make Custom Webhook URL' : selectedWebhookProvider === 'n8n' ? 'n8n Webhook URL' : selectedWebhookProvider === 'zapier' ? 'Zapier Hook URL' : 'Endpoint POST URL'})
                    </label>
                    <div className="relative flex items-center">
                      <input 
                        type="text"
                        value={config.webhookUrl || ''}
                        onChange={(e) => handleWebhookUrlChange(e.target.value)}
                        placeholder={
                          selectedWebhookProvider === 'make'
                            ? "https://hook.eu1.make.com/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                            : selectedWebhookProvider === 'n8n'
                              ? "https://n8n.tudominio.com/webhook/nuevo-lead-comercial"
                              : selectedWebhookProvider === 'zapier'
                                ? "https://hooks.zapier.com/hooks/catch/123456/abcdef/"
                                : "https://api.tuempresa.com/v1/leads"
                        }
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all pr-24"
                      />
                      {config.webhookUrl && (
                        <button
                          type="button"
                          onClick={() => handleWebhookUrlChange('')}
                          className="absolute right-3 text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 transition-colors"
                        >
                          Limpiar
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                      Método HTTP: <strong>POST</strong> | Formato del cuerpo: <strong>application/json</strong>
                    </p>
                  </div>

                  {/* Test Feedback Notice */}
                  {webhookTestResult && (
                    <div className={`p-4 rounded-xl text-xs flex items-start gap-3 animate-in fade-in duration-200 ${
                      webhookTestResult.success 
                        ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' 
                        : 'bg-rose-50 text-rose-900 border border-rose-200'
                    }`}>
                      {webhookTestResult.success ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <p className="font-semibold text-sm">
                          {webhookTestResult.success ? 'Conexión Exitosa' : 'Aviso en la Conexión'}
                        </p>
                        <p className="mt-0.5 leading-relaxed">{webhookTestResult.message}</p>
                      </div>
                    </div>
                  )}

                  {/* Step-by-Step Instructions tailored to the platform */}
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-5 space-y-3">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 text-purple-600" />
                      Guía de integración paso a paso con {selectedWebhookProvider === 'make' ? 'Make (Integromat)' : selectedWebhookProvider === 'n8n' ? 'n8n' : selectedWebhookProvider === 'zapier' ? 'Zapier' : 'tu Servidor'}
                    </h4>

                    {selectedWebhookProvider === 'make' && (
                      <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside leading-relaxed">
                        <li>
                          Abre tu cuenta en <a href="https://www.make.com" target="_blank" rel="noopener noreferrer" className="text-purple-600 font-semibold underline">Make.com</a> y crea un nuevo escenario (<strong>Create a new scenario</strong>).
                        </li>
                        <li>
                          Haz clic en el círculo central `+`, busca la app <strong>Webhooks</strong> y elige el trigger <strong>Custom webhook</strong>.
                        </li>
                        <li>
                          En la ventana emergente, haz clic en <strong>Add</strong> para crear un nuevo webhook (por ejemplo: <em>Leads Asistente AI</em>) y pulsa <strong>Copy address to clipboard</strong>.
                        </li>
                        <li>
                          Pega la dirección URL en el campo de arriba y presiona el botón <strong>"Enviar Lead de Prueba"</strong>.
                        </li>
                        <li>
                          En Make verás que el módulo cambia de estado a <span className="bg-emerald-100 text-emerald-800 font-semibold px-1.5 py-0.5 rounded">Successfully determined</span>. ¡Make ya tiene la estructura de los campos!
                        </li>
                        <li>
                          Conecta los siguientes módulos en Make a tu gusto: <strong>Google Sheets (Add a row)</strong>, <strong>WhatsApp Cloud API</strong>, <strong>Gmail</strong>, <strong>HubSpot</strong> o <strong>Slack</strong>.
                        </li>
                      </ol>
                    )}

                    {selectedWebhookProvider === 'n8n' && (
                      <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside leading-relaxed">
                        <li>En tu editor de <strong>n8n</strong>, añade un nodo inicial de tipo <strong>Webhook</strong>.</li>
                        <li>Configura el parámetro <strong>HTTP Method</strong> en <code>POST</code>.</li>
                        <li>Copia la <strong>Test URL</strong> (para probar mientras diseñas) o la <strong>Production URL</strong> (para cuando actives el workflow).</li>
                        <li>Pega la URL arriba y presiona <strong>"Enviar Lead de Prueba"</strong>.</li>
                        <li>Verás el JSON recibido con los campos del lead en la salida del nodo en n8n listos para vincular.</li>
                      </ol>
                    )}

                    {selectedWebhookProvider === 'zapier' && (
                      <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside leading-relaxed">
                        <li>En <strong>Zapier</strong>, crea un nuevo Zap y busca la app <strong>Webhooks by Zapier</strong>.</li>
                        <li>En el campo Evento, selecciona <strong>Catch Hook</strong> y pulsa Continuar.</li>
                        <li>Copia la <strong>Webhook URL</strong> que te brinda Zapier.</li>
                        <li>Pega la URL arriba y haz clic en <strong>"Enviar Lead de Prueba"</strong>.</li>
                        <li>Vuelve a Zapier y haz clic en <strong>Test trigger</strong> para confirmar la recepción del registro de prueba.</li>
                      </ol>
                    )}

                    {selectedWebhookProvider === 'custom' && (
                      <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside leading-relaxed">
                        <li>Crea un endpoint en tu servidor (Node.js, Python, PHP, Go, etc.) o Serverless Function.</li>
                        <li>Asegúrate de que admita el método <code>POST</code> y decodifique el cuerpo como <code>JSON</code>.</li>
                        <li>Pega la URL completa (incluyendo <code>https://</code>) en el campo superior y presiona <strong>"Enviar Lead de Prueba"</strong>.</li>
                        <li>El servidor recibirá el objeto completo del lead para guardarlo en tu base de datos o CRM.</li>
                      </ol>
                    )}
                  </div>

                  {/* n8n Multi-Sucursal Architecture Tip */}
                  <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 p-4 rounded-xl space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-orange-600 text-white flex items-center justify-center font-bold text-xs">
                        n8n
                      </div>
                      <h4 className="text-sm font-bold text-slate-800">Estrategia Multi-Sucursal para tu Workflow de n8n</h4>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      El webhook inyecta automáticamente el campo normalizado <code>sucursal</code> (<code>"resistencia"</code> | <code>"posadas"</code> | <code>"otra"</code>).
                      En tu n8n, simplemente conecta un nodo <strong>Switch</strong> evaluando <code>{'{{ $json.sucursal }}'}</code>:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs font-mono">
                      <div className="bg-white p-2 rounded-lg border border-orange-200">
                        <span className="text-sky-700 font-bold block mb-1">Rama 1: resistencia</span>
                        <span className="text-slate-500 font-sans text-[11px]">Notificar WhatsApp al vendedor de Resistencia.</span>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-orange-200">
                        <span className="text-teal-700 font-bold block mb-1">Rama 2: posadas</span>
                        <span className="text-slate-500 font-sans text-[11px]">Notificar WhatsApp al vendedor de Posadas.</span>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-orange-200">
                        <span className="text-slate-700 font-bold block mb-1">Rama 3: otra / default</span>
                        <span className="text-slate-500 font-sans text-[11px]">Derivar al equipo comercial general.</span>
                      </div>
                    </div>
                  </div>

                  {/* Sample JSON Payload Inspector */}
                  <div className="pt-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Estructura del Payload JSON Enviado
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const sampleJson = JSON.stringify({
                            event: 'lead.created',
                            platform: selectedWebhookProvider,
                            tenantId: tenantId || 'default',
                            timestamp: new Date().toISOString(),
                            sucursal: 'posadas',
                            sucursal_nombre: 'Posadas',
                            nombre: 'Marcos Ruiz',
                            name: 'Marcos Ruiz',
                            telefono: '+54 9 376 411 2233',
                            phone: '+54 9 376 411 2233',
                            whatsapp_number: '5493764112233',
                            wa_link: 'https://wa.me/5493764112233',
                            email: 'marcos.ruiz@ejemplo.com',
                            ubicacion: 'Posadas',
                            tiene_usado: 'Sí, Lancha Bermuda 1998 con motor',
                            tiene_usado_bool: true,
                            interesa_lanchaplan: 'Sí',
                            interesa_lanchaplan_bool: true,
                            interes: 'Cotizar Tracker 520 nueva y financiar por Lancha Plan',
                            lead: {
                              id: 'lead_abc123',
                              name: 'Marcos Ruiz',
                              email: 'marcos.ruiz@ejemplo.com',
                              phone: '+54 9 376 411 2233',
                              whatsapp_number: '5493764112233',
                              wa_link: 'https://wa.me/5493764112233',
                              ubicacion: 'Posadas',
                              sucursal: 'posadas',
                              sucursal_nombre: 'Posadas',
                              tiene_usado: 'Sí, Lancha Bermuda 1998 con motor',
                              tiene_usado_bool: true,
                              interesa_lanchaplan: 'Sí',
                              interesa_lanchaplan_bool: true,
                              interes: 'Cotizar Tracker 520 nueva y financiar por Lancha Plan',
                              date: new Date().toISOString(),
                              conversation: [
                                { role: 'user', content: 'Hola, me gustaría cotizar una lancha Tracker nueva.' },
                                { role: 'model', content: '¡Hola Marcos! ¿Te encuentras en Resistencia o Posadas? ¿Tienes un usado o te interesa el sistema Lancha Plan?' },
                                { role: 'user', content: 'Soy de Posadas, tengo un usado Bermuda 1998 y quiero financiar por Lancha Plan. Mi WhatsApp es +5493764112233.' }
                              ]
                            }
                          }, null, 2);
                          navigator.clipboard.writeText(sampleJson);
                          setCopiedJson(true);
                          setTimeout(() => setCopiedJson(false), 2500);
                        }}
                        className="text-xs font-semibold text-purple-600 hover:text-purple-800 flex items-center gap-1 cursor-pointer"
                      >
                        {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedJson ? '¡JSON Copiado!' : 'Copiar JSON de ejemplo'}</span>
                      </button>
                    </div>

                    <div className="bg-slate-900 rounded-xl p-4 font-mono text-xs text-slate-200 overflow-x-auto border border-slate-800">
<pre>{`{
  "event": "lead.created",
  "platform": "${selectedWebhookProvider}",
  "tenantId": "${tenantId || 'default'}",
  "timestamp": "${new Date().toISOString()}",
  "sucursal": "posadas",
  "sucursal_nombre": "Posadas",
  "nombre": "Marcos Ruiz",
  "name": "Marcos Ruiz",
  "telefono": "+54 9 376 411 2233",
  "phone": "+54 9 376 411 2233",
  "whatsapp_number": "5493764112233",
  "wa_link": "https://wa.me/5493764112233",
  "email": "marcos.ruiz@ejemplo.com",
  "ubicacion": "Posadas",
  "tiene_usado": "Sí, Lancha Bermuda 1998 con motor",
  "tiene_usado_bool": true,
  "interesa_lanchaplan": "Sí",
  "interesa_lanchaplan_bool": true,
  "interes": "Cotizar Tracker 520 nueva y financiar por Lancha Plan",
  "lead": {
    "id": "lead_abc123",
    "name": "Marcos Ruiz",
    "email": "marcos.ruiz@ejemplo.com",
    "phone": "+54 9 376 411 2233",
    "whatsapp_number": "5493764112233",
    "wa_link": "https://wa.me/5493764112233",
    "ubicacion": "Posadas",
    "sucursal": "posadas",
    "sucursal_nombre": "Posadas",
    "tiene_usado": "Sí, Lancha Bermuda 1998 con motor",
    "tiene_usado_bool": true,
    "interesa_lanchaplan": "Sí",
    "interesa_lanchaplan_bool": true,
    "interes": "Cotizar Tracker 520 nueva y financiar por Lancha Plan",
    "date": "${new Date().toISOString()}",
    "conversation": [
      { "role": "user", "content": "Hola, me gustaría cotizar una lancha Tracker nueva." },
      { "role": "model", "content": "¡Hola Marcos! ¿Te encuentras en Resistencia o Posadas?..." },
      { "role": "user", "content": "Soy de Posadas, tengo un usado y quiero Lancha Plan..." }
    ]
  }
}`}</pre>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'prompt' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Instrucciones Base (System Prompt)</h2>
                  <p className="text-slate-500 mt-1 text-sm leading-relaxed max-w-2xl">
                    Aquí configuras la "personalidad" del LLM y las reglas de interacción estrictas. Define cómo debe abordar las preguntas de náutica.
                  </p>
                </div>

                <div className="bg-slate-900 rounded-2xl shadow-xl overflow-hidden border border-slate-800">
                  <div className="bg-slate-950 px-4 py-3 flex items-center justify-between border-b border-slate-800">
                     <div className="flex items-center gap-2">
                         <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                         <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                         <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                         <span className="text-slate-500 text-xs font-mono ml-2">SystemInstruction.md</span>
                     </div>
                     <button
                       type="button"
                       onClick={() => {
                         updateConfig('systemPrompt', defaultSystemPrompt);
                         saveConfig({ ...config, systemPrompt: defaultSystemPrompt });
                         setStatusNotice('Instrucciones base actualizadas con la calificación comercial náutica.');
                         setTimeout(() => setStatusNotice(null), 3500);
                       }}
                       className="text-xs bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5"
                     >
                       <RefreshCw className="w-3.5 h-3.5" />
                       Cargar Plantilla Náutica (Resistencia/Posadas + Usado + Lancha Plan)
                     </button>
                  </div>
                  <textarea 
                    value={config.systemPrompt}
                    onChange={(e) => updateConfig('systemPrompt', e.target.value)}
                    className="w-full h-[320px] bg-transparent text-slate-300 font-mono text-sm leading-relaxed p-6 focus:outline-none resize-none"
                    spellCheck="false"
                  />
                </div>

                {/* Function Calling: Tools & Declarations Card */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 border border-purple-100">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-slate-800 text-base">Herramienta Activa: Function Calling (Calificación Completa)</h3>
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Conectada en Servidor
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Función <code className="text-purple-700 font-mono font-semibold bg-purple-50 px-1.5 py-0.5 rounded">enviar_lead_n8n</code> configurada con los parámetros de contacto y calificación comercial náutica.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 font-mono space-y-2">
                      <div className="text-slate-500 font-semibold uppercase text-[10px] tracking-wider">Esquema de la Función</div>
                      <div className="text-slate-700 space-y-1">
                        <div><strong className="text-purple-600">Nombre:</strong> enviar_lead_n8n</div>
                        <div><strong className="text-purple-600">Tipo:</strong> FunctionDeclaration (Google Gen AI)</div>
                        <div><strong className="text-purple-600">Descripción:</strong> Se ejecuta cuando el cliente tiene intención comercial y el asesor recopila sus datos de contacto y calificación (Resistencia/Posadas, usado como parte de pago y Lancha Plan).</div>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 font-mono space-y-2">
                      <div className="text-slate-500 font-semibold uppercase text-[10px] tracking-wider">Parámetros Recolectados</div>
                      <ul className="text-slate-700 space-y-1">
                        <li>• <code className="text-indigo-600 font-semibold">nombre</code>: Nombre del cliente</li>
                        <li>• <code className="text-indigo-600 font-semibold">telefono</code>: Teléfono o WhatsApp (+54...)</li>
                        <li>• <code className="text-indigo-600 font-semibold">ubicacion</code>: Ubicación (Resistencia o Posadas)</li>
                        <li>• <code className="text-indigo-600 font-semibold">tiene_usado</code>: Usado para entregar en parte de pago</li>
                        <li>• <code className="text-indigo-600 font-semibold">interesa_lanchaplan</code>: Interés en el sistema Lancha Plan</li>
                        <li>• <code className="text-slate-500 font-semibold">email</code>: Correo electrónico (opcional)</li>
                        <li>• <code className="text-indigo-600 font-semibold">interes</code>: Resumen de cotización o producto</li>
                        <li className="text-amber-700 font-sans text-[11px] pt-1">
                          🔒 <em>El <code className="font-mono">tenant_id</code> se inyecta programáticamente por código en el backend.</em>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'deploy' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Desplegar Compartir</h2>
                  <p className="text-slate-500 mt-1 text-sm leading-relaxed max-w-2xl">
                     Añade tu chatbot en cualquier página web copiando el tag de embebido o comparte el enlace público para demos.
                  </p>
                </div>

                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                   <h3 className="font-semibold text-slate-800 mb-4">Código para Website (Embed Snippet)</h3>
                   <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden font-mono text-sm">
                      <div className="p-4 text-slate-600 overflow-x-auto">
<pre id="embed-code">{`<!-- Copia y pega este código en tu sitio web (ej. WordPress) -->
<iframe 
  src="${window.location.origin}${window.location.pathname}?tenant=${tenantId}#/chat" 
  width="400" 
  height="600" 
  style="position:fixed; bottom: 20px; right: 20px; border:none; z-index: 9999; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15)">
</iframe>`}</pre>
                      </div>
                      <div className="bg-yellow-50 text-yellow-800 text-xs p-3 border-y border-yellow-200">
                         <strong>Importante:</strong> Mientras uses la URL de prueba de AI Studio, el widget mostrará un error de acceso denegado (Error 403) si lo insertas en otro sitio web (como WordPress) debido a políticas de seguridad. Para usarlo en producción, debes exportar la aplicación (opción Export to ZIP o GitHub) y desplegarla en un hosting público como Vercel o Netlify.
                      </div>
                      <div className="bg-slate-100 border-t border-slate-200 px-4 py-2 flex justify-end">
                         <button 
                            onClick={() => {
                              const code = `<!-- Copia y pega este código en tu sitio web (ej. WordPress) -->\n<iframe src="${window.location.origin}${window.location.pathname}?tenant=${tenantId}#/chat" width="400" height="600" style="position:fixed; bottom: 20px; right: 20px; border:none; z-index: 9999; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15)"></iframe>`;
                              navigator.clipboard.writeText(code);
                              alert('¡Código copiado al portapapeles!');
                            }}
                            className="text-blue-600 text-xs font-semibold hover:underline cursor-pointer"
                         >
                           Copiar Portapapeles
                         </button>
                      </div>
                   </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Tenant / Client Switcher Modal */}
      {isTenantModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Selector de Cliente / Tenant</h3>
                  <p className="text-xs text-slate-500">Administra múltiples clientes o sucursales</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTenantModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ID del Cliente Actual
                </label>
                <input
                  type="text"
                  value={newTenantInput}
                  onChange={(e) => setNewTenantInput(e.target.value)}
                  placeholder="ej: nautica_resistencia, cliente_posadas, empresa_xyz"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-slate-800"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Cada ID de cliente tiene su propia base de conocimientos, configuración de prompt, webhooks y tabla de leads aislada.
                </p>
              </div>

              <div>
                <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Accesos Rápidos
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {['default', 'nautica_resistencia', 'nautica_posadas'].map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setNewTenantInput(preset)}
                      className={`text-xs px-2.5 py-1 rounded-lg border font-mono transition-colors ${
                        newTenantInput === preset
                          ? 'bg-blue-50 border-blue-300 text-blue-700 font-bold'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5 text-xs text-slate-600">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">Enlace Tablero de este Cliente:</span>
                </div>
                <div className="font-mono text-[11px] text-blue-700 break-all bg-white p-2 rounded-lg border border-slate-200">
                  {`${window.location.origin}${window.location.pathname}?tenant=${newTenantInput || 'default'}#/client-dashboard`}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsTenantModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const clean = newTenantInput.trim() || 'default';
                    switchTenant(clean === 'default' ? null : clean);
                    setIsTenantModalOpen(false);
                    showNotice(`Cambiado al cliente: ${clean}`);
                  }}
                  className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm"
                >
                  Cambiar de Cliente
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
