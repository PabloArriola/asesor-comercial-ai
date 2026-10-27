import React, { createContext, useContext, useState, ReactNode, useEffect, useMemo } from 'react';
import { db, auth } from '../lib/firebase';
import { doc, getDoc, setDoc, onSnapshot, collection, query, orderBy, addDoc, getDocs } from 'firebase/firestore';

export type DataSource = {
  id: string;
  type: 'text' | 'url' | 'file';
  title: string;
  content: string;
};

export type WebhookProvider = 'make' | 'n8n' | 'zapier' | 'custom';

export type ChatbotConfig = {
  name: string;
  welcomeMessage: string;
  primaryColor: string;
  systemPrompt: string;
  knowledgeBase: string;
  dataSources?: DataSource[];
  webhookUrl?: string;
  webhookProvider?: WebhookProvider;
  makeWebhookUrl?: string;
  n8nWebhookUrl?: string;
  zapierWebhookUrl?: string;
  customWebhookUrl?: string;
  logoUrl?: string;
  quickReplies?: string[];
  whatsappEnabled?: boolean;
  whatsappNumber?: string;
  whatsappResistencia?: string;
  whatsappPosadas?: string;
  whatsappDefaultMessage?: string;
  whatsappFloatingButton?: boolean;
};

export type Lead = {
  id?: string;
  name: string;
  phone: string;
  email: string;
  ubicacion?: string;
  tiene_usado?: string;
  interesa_lanchaplan?: string;
  interes?: string;
  tenant_id?: string | null;
  date: string;
  conversation: { role: 'user' | 'model'; content: string }[];
  handoff?: boolean;
};

interface ChatbotContextType {
  config: ChatbotConfig;
  updateConfig: (key: keyof ChatbotConfig, value: any) => void;
  saveConfig: (newConfig?: ChatbotConfig) => Promise<void>;
  leads: Lead[];
  addLead: (lead: Lead) => Promise<void>;
  updateLeadConversation: (leadId: string, conversation: any[], isHandoff?: boolean) => Promise<void>;
  isAdminReady: boolean;
  isAdmin: boolean; // True if the user is logged into a dashboard
  tenantId: string | null; // The current tenant ID context
  switchTenant: (newTenantId: string | null) => void;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}

const defaultKnowledge = `Empieza por agregar los productos o servicios de tu negocio en la pestaña "Fuentes de Datos".`;

export const defaultQuickReplies: string[] = [
  'Quiero ver el catálogo',
  'Consultar envíos',
  'Hablar con un asesor',
];

export const defaultSystemPrompt = `Eres un asesor comercial náutico experto, amable y profesional. Tu objetivo es asesorar al cliente sobre embarcaciones, lanchas, motores y servicios náuticos basándote en la base de datos de la empresa.

REGLA ESTRICTA DE CAPTURA Y CALIFICACIÓN DE LEADS:
Durante la conversación, si detectas interés comercial, solicita de forma amable, natural y conversacional los siguientes datos clave:
1. Datos de contacto: Nombre y Teléfono (o WhatsApp con código de área, ej: +54...).
2. Ubicación desde donde realiza la consulta: Pregunta si se encuentra en Resistencia o Posadas (nuestras sucursales).
3. Usado en parte de pago: Pregunta si tiene un usado (embarcación, lancha, motor o vehículo) para entregar como parte de pago.
4. Sistema Lancha Plan: Pregunta si está interesado en realizar el pago mediante el sistema "Lancha Plan".
5. (Opcional) Correo electrónico si lo facilita voluntariamente.

Una vez que tengas los datos de contacto (nombre y teléfono) y hayas consultado su ubicación (Resistencia o Posadas), si tiene usado para entregar y su interés en Lancha Plan, DEBES llamar inmediatamente a la función enviar_lead_n8n. No te despidas ni des por terminada la gestión sin antes ejecutar esta función.

REGLAS DE CONTACTO DIRECTO Y DERIVACIÓN A WHATSAPP:
1. CLIENTES QUE PIDEN EL CONTACTO O ESTÁN APURADOS:
Si el usuario dice explícitamente "dame el número", "pásame el WhatsApp", "no quiero dejar mis datos" o pide hablar de inmediato con un humano:
- NUNCA insistas pidiéndole datos.
- Entrega de inmediato los números y enlaces directos de WhatsApp de la sucursal correspondiente (o consulta si prefiere Posadas o Resistencia).

2. CONFIRMACIÓN Y ENLACE TRAS REGISTRO DE DATOS:
Cuando registres los datos del cliente, confirma que un asesor comercial se comunicará a la brevedad y además facilítale el enlace directo clickeable a WhatsApp para que pueda iniciar la conversación de inmediato si lo desea.`;

const defaultConfig: ChatbotConfig = {
  name: "Asistente Virtual Náutico",
  welcomeMessage: "¡Hola! Soy tu asesor comercial náutico. ¿En qué embarcación o consulta te puedo ayudar hoy?",
  primaryColor: "#0369A1", // Nautical blue
  systemPrompt: defaultSystemPrompt,
  knowledgeBase: defaultKnowledge,
  dataSources: [],
  quickReplies: defaultQuickReplies,
  webhookProvider: 'make',
  webhookUrl: '',
  makeWebhookUrl: '',
  n8nWebhookUrl: '',
  zapierWebhookUrl: '',
  customWebhookUrl: '',
  whatsappEnabled: true,
  whatsappNumber: '',
  whatsappResistencia: '',
  whatsappPosadas: '',
  whatsappDefaultMessage: '¡Hola! Estuve conversando con el asesor virtual y me gustaría cotizar una embarcación.',
  whatsappFloatingButton: true,
};

const LOCAL_STORAGE_CONFIG_KEY = 'nautic_chatbot_config';
const LOCAL_STORAGE_TENANT_KEY = 'nautic_active_tenant_id';

function getStoredConfig(tenant?: string | null): ChatbotConfig {
  try {
    if (tenant) {
      const tenantSaved = localStorage.getItem(`${LOCAL_STORAGE_CONFIG_KEY}_${tenant}`);
      if (tenantSaved) {
        const parsed = JSON.parse(tenantSaved);
        if (parsed && typeof parsed === 'object') {
          return {
            ...defaultConfig,
            ...parsed,
            quickReplies: parsed.quickReplies || defaultQuickReplies,
          };
        }
      }
    }
    const saved = localStorage.getItem(LOCAL_STORAGE_CONFIG_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') {
        return {
          ...defaultConfig,
          ...parsed,
          quickReplies: parsed.quickReplies || defaultQuickReplies,
        };
      }
    }
  } catch (e) {
    console.warn('Failed to parse cached config', e);
  }
  return defaultConfig;
}

const ChatbotContext = createContext<ChatbotContextType | undefined>(undefined);

export function ChatbotProvider({ children }: { children: ReactNode }) {
  const getInitialTenant = () => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('tenant') || localStorage.getItem(LOCAL_STORAGE_TENANT_KEY) || null;
    } catch {
      return null;
    }
  };

  const [tenantId, setTenantId] = useState<string | null>(getInitialTenant);
  const [config, setConfig] = useState<ChatbotConfig>(() => getStoredConfig(getInitialTenant()));
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isAdminReady, setIsAdminReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlTenant = params.get('tenant');
    if (urlTenant) {
      setTenantId(urlTenant);
      localStorage.setItem(LOCAL_STORAGE_TENANT_KEY, urlTenant);
    }

    const unsubAuth = auth.onAuthStateChanged((user) => {
       setIsAdminReady(true);
       if (user) {
         setIsAdmin(true);
         setTenantId(user.uid);
         localStorage.setItem(LOCAL_STORAGE_TENANT_KEY, user.uid);
       } else {
         setIsAdmin(false);
         if (urlTenant) {
           setTenantId(urlTenant);
         } else {
           const savedTenant = localStorage.getItem(LOCAL_STORAGE_TENANT_KEY);
           if (savedTenant) setTenantId(savedTenant);
           else setTenantId(null);
         }
       }
    });
    return () => unsubAuth();
  }, []);

  // Listen for config changes
  useEffect(() => {
    const activeTenant = tenantId || localStorage.getItem(LOCAL_STORAGE_TENANT_KEY);
    if (!activeTenant) return;

    const configRef = doc(db, "tenants", activeTenant, "config", "main");
    
    const unsub = onSnapshot(configRef, (docSnap) => {
      if (docSnap.exists()) {
        const cloudData = docSnap.data() as ChatbotConfig;
        setConfig(cloudData);
        try {
          localStorage.setItem(LOCAL_STORAGE_CONFIG_KEY, JSON.stringify(cloudData));
          localStorage.setItem(`${LOCAL_STORAGE_CONFIG_KEY}_${activeTenant}`, JSON.stringify(cloudData));
        } catch {}
      } else {
        // Init default if admin or sync existing local data to cloud
        const existing = getStoredConfig(activeTenant);
        const hasCustomContent = (existing.dataSources && existing.dataSources.length > 0) || (existing.knowledgeBase && existing.knowledgeBase !== defaultKnowledge);
        const initialToSave = hasCustomContent ? existing : defaultConfig;
        
        setDoc(configRef, initialToSave).catch(err => {
          console.warn("Auto-syncing config to Firestore:", err);
        });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `tenants/${activeTenant}/config/main`);
    });
    return () => unsub();
  }, [tenantId, isAdmin]);

  // Listen for leads (available for Admin and Client Dashboard)
  useEffect(() => {
    const activeTenant = tenantId || localStorage.getItem(LOCAL_STORAGE_TENANT_KEY) || 'default_tenant';

    // Hydrate from local cache immediately so both Admin and Client dashboards load instantly
    try {
      const cached = localStorage.getItem(`leads_cache_${activeTenant}`);
      if (cached) {
        setLeads(JSON.parse(cached));
      }
    } catch {}

    const leadsRef = collection(db, "tenants", activeTenant, "leads");
    const unsub = onSnapshot(query(leadsRef, orderBy("date", "desc")), (snapshot) => {
      const dbLeads = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Lead));
      if (dbLeads.length > 0) {
        setLeads(dbLeads);
        try {
          localStorage.setItem(`leads_cache_${activeTenant}`, JSON.stringify(dbLeads));
        } catch {}
      }
    }, (error) => {
      console.warn("Firestore leads sync notice (using cached leads):", error?.message);
    });
    return () => unsub();
  }, [isAdmin, tenantId]);

  const updateConfig = (key: keyof ChatbotConfig, value: any) => {
    setConfig(prev => {
      const updated = { ...prev, [key]: value };
      try {
        localStorage.setItem(LOCAL_STORAGE_CONFIG_KEY, JSON.stringify(updated));
        if (tenantId) {
          localStorage.setItem(`${LOCAL_STORAGE_CONFIG_KEY}_${tenantId}`, JSON.stringify(updated));
        }
      } catch {}
      return updated;
    });
  };

  const saveConfig = async (newConfig?: ChatbotConfig): Promise<void> => {
    const configToSave = newConfig || config;
    setConfig(configToSave);

    // 1. Immediately cache locally
    try {
      localStorage.setItem(LOCAL_STORAGE_CONFIG_KEY, JSON.stringify(configToSave));
      const targetTenant = tenantId || auth.currentUser?.uid || localStorage.getItem(LOCAL_STORAGE_TENANT_KEY);
      if (targetTenant) {
        localStorage.setItem(`${LOCAL_STORAGE_CONFIG_KEY}_${targetTenant}`, JSON.stringify(configToSave));
      }
    } catch (e) {
      console.warn("Local storage save error:", e);
    }

    // 2. Persist to Firestore
    const targetTenant = tenantId || auth.currentUser?.uid || localStorage.getItem(LOCAL_STORAGE_TENANT_KEY);
    if (targetTenant) {
      try {
        await setDoc(doc(db, "tenants", targetTenant, "config", "main"), configToSave);
      } catch (e) {
        handleFirestoreError(e, OperationType.UPDATE, `tenants/${targetTenant}/config/main`);
        throw e;
      }
    }

    // Backup to central /config/main
    try {
      await setDoc(doc(db, "config", "main"), configToSave);
    } catch {}
  };

  const addLead = async (lead: Lead) => {
    const activeTenant = tenantId || localStorage.getItem(LOCAL_STORAGE_TENANT_KEY) || 'default_tenant';
    
    // Immediate state and cache update so lead is immediately visible in dashboards
    setLeads(prev => [lead, ...prev.filter(l => l.id !== lead.id)]);
    try {
      const stored = localStorage.getItem(`leads_cache_${activeTenant}`);
      const list: Lead[] = stored ? JSON.parse(stored) : [];
      localStorage.setItem(`leads_cache_${activeTenant}`, JSON.stringify([lead, ...list.filter(l => l.id !== lead.id)].slice(0, 50)));
    } catch {}

    try {
       const leadsRef = collection(db, "tenants", activeTenant, "leads");
       if (lead.id) {
         await setDoc(doc(leadsRef, lead.id), lead);
       } else {
         await addDoc(leadsRef, lead);
       }
    } catch (e) {
       console.warn("Firestore addLead notice:", e);
    }
  };

  const updateLeadConversation = async (leadId: string, conversation: any[], isHandoff: boolean = false) => {
    const activeTenant = tenantId || localStorage.getItem(LOCAL_STORAGE_TENANT_KEY) || 'default_tenant';
    try {
      await setDoc(doc(db, "tenants", activeTenant, "leads", leadId), { conversation, handoff: isHandoff }, { merge: true });
    } catch (e) {
      console.warn("Firestore updateLeadConversation notice:", e);
    }
  };

  const switchTenant = (newTenantId: string | null) => {
    const cleanId = newTenantId && newTenantId.trim() ? newTenantId.trim() : null;
    setTenantId(cleanId);
    if (cleanId) {
      localStorage.setItem(LOCAL_STORAGE_TENANT_KEY, cleanId);
    } else {
      localStorage.removeItem(LOCAL_STORAGE_TENANT_KEY);
    }
    const storedCfg = getStoredConfig(cleanId);
    setConfig(storedCfg);
    try {
      const storedLeads = localStorage.getItem(`leads_cache_${cleanId || 'default_tenant'}`);
      if (storedLeads) {
        setLeads(JSON.parse(storedLeads));
      } else {
        setLeads([]);
      }
    } catch {}
  };

  return (
    <ChatbotContext.Provider value={{ config, updateConfig, saveConfig, leads, addLead, updateLeadConversation, isAdminReady, isAdmin, tenantId, switchTenant }}>
      {children}
    </ChatbotContext.Provider>
  );
}

export function useChatbot() {
  const context = useContext(ChatbotContext);
  if (!context) throw new Error("useChatbot must be used within ChatbotProvider");
  return context;
}
