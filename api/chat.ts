import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";

let aiClient: GoogleGenAI | null = null;
function getAi(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is missing");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Function Calling Declaration: enviar_lead_n8n
const enviarLeadN8nDeclaration: FunctionDeclaration = {
  name: "enviar_lead_n8n",
  description: "Ejecuta esta función ÚNICAMENTE cuando el usuario tenga intención comercial y ya te haya proporcionado su nombre y teléfono, y hayas consultado su ubicación (Resistencia o Posadas), si entrega un usado como parte de pago y si le interesa el sistema Lancha Plan. Sirve para enviar los datos al CRM del cliente y a n8n.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      nombre: {
        type: Type.STRING,
        description: "Nombre completo o de pila del usuario.",
      },
      telefono: {
        type: Type.STRING,
        description: "Número de teléfono o WhatsApp de contacto (estandarizado con código de área, ej: +54...).",
      },
      ubicacion: {
        type: Type.STRING,
        description: "Ubicación o sucursal desde donde realiza la consulta (Resistencia o Posadas).",
      },
      tiene_usado: {
        type: Type.STRING,
        description: "Indica si el usuario tiene un usado (embarcación, lancha, motor) para entregar como parte de pago (ej: 'Sí, Tracker 520 con motor' o 'No').",
      },
      interesa_lanchaplan: {
        type: Type.STRING,
        description: "Indica si el usuario está interesado en el sistema de financiación Lancha Plan (ej: 'Sí', 'No', o 'Consultó detalles de cuotas').",
      },
      email: {
        type: Type.STRING,
        description: "Correo electrónico del usuario (opcional si no fue facilitado).",
      },
      interes: {
        type: Type.STRING,
        description: "Un resumen breve (1 o 2 oraciones máximo) de lo que necesita cotizar o consultar el cliente.",
      },
    },
    required: ["nombre", "telefono", "ubicacion", "tiene_usado", "interesa_lanchaplan", "interes"],
  },
};

function normalizeWhatsappNumber(rawPhone?: string): string {
  if (!rawPhone) return '';
  let digits = rawPhone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 10) {
    digits = '549' + digits;
  } else if (digits.length === 11 && digits.startsWith('9')) {
    digits = '54' + digits;
  } else if (digits.length === 12 && digits.startsWith('54') && !digits.startsWith('549')) {
    digits = '549' + digits.slice(2);
  }
  return digits;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { history, message, systemPrompt, knowledgeBase, tenantId, webhookUrl, whatsappConfig } = req.body || {};

    const rawSystemInstruction = systemPrompt || "Eres un asesor comercial náutico experto, amable y profesional.";
    const baseKnowledge = knowledgeBase 
       ? `\n\n<base_de_datos>\n${knowledgeBase}\n</base_de_datos>`
      : ``;
      
    const leadAlreadyCaptured = Array.isArray(history) && history.some(m => 
      m && m.role === 'model' && (
        m.content?.includes('Registré tu consulta') || 
        m.content?.includes('registrado tus datos') || 
        m.content?.includes('Un asesor comercial se pondrá en contacto')
      )
    );

    
    const waGeneral = ((whatsappConfig && whatsappConfig.whatsappNumber) || '').replace(/\D/g, '') || '5493624000000';
    const waResistencia = ((whatsappConfig && whatsappConfig.whatsappResistencia) || '').replace(/\D/g, '') || waGeneral;
    const waPosadas = ((whatsappConfig && whatsappConfig.whatsappPosadas) || '').replace(/\D/g, '') || waGeneral;
    const waDefaultMsg = encodeURIComponent((whatsappConfig && whatsappConfig.whatsappDefaultMessage) || '¡Hola! Quisiera consultar y cotizar sobre una embarcación.');

    const waLinkResistencia = `https://wa.me/${waResistencia}?text=${waDefaultMsg}`;
    const waLinkPosadas = `https://wa.me/${waPosadas}?text=${waDefaultMsg}`;
    const waLinkGeneral = `https://wa.me/${waGeneral}?text=${waDefaultMsg}`;

    const whatsappProtocolInstruction = `\n\nREGLAS DE CONTACTO DIRECTO Y DERIVACIÓN A WHATSAPP:
1. CLIENTES QUE PIDEN EL CONTACTO O ESTÁN APURADOS:
Si el usuario dice explícitamente "dame el número", "pásame el WhatsApp", "no quiero dar mis datos", "quiero hablar ya con alguien" o solicita contacto directo sin pasar por el formulario:
- NUNCA insistas pidiéndole datos ni entres en un bucle repetitivo.
- Ofrécele inmediatamente los enlaces directos de WhatsApp en formato Markdown clickeable:
  - Si indicó que es de Posadas:
    👉 [Escribir al WhatsApp de Sucursal Posadas](${waLinkPosadas}) (Tel: +${waPosadas})
  - Si indicó que es de Resistencia:
    👉 [Escribir al WhatsApp de Sucursal Resistencia](${waLinkResistencia}) (Tel: +${waResistencia})
  - Si aún no indicó sucursal, ofrécele ambas opciones para que elija sucursal:
    👉 [Escribir al WhatsApp de Sucursal Posadas](${waLinkPosadas})
    👉 [Escribir al WhatsApp de Sucursal Resistencia](${waLinkResistencia})

2. CONFIRMACIÓN Y ENLACE DIRECTO TRAS REGISTRO DE DATOS:
Cuando el usuario te facilite sus datos y se ejecute la función enviar_lead_n8n:
- Agradécele con calidez e infórmale que un asesor comercial se pondrá en contacto a la brevedad a su teléfono.
- ADEMÁS, incluye SIEMPRE al final de tu mensaje el enlace directo clickeable en Markdown para que el cliente pueda abrir el chat de WhatsApp de inmediato si lo desea:
  - Si es de Posadas: 👉 [Abrir WhatsApp con Asesor de Sucursal Posadas](${waLinkPosadas})
  - Si es de Resistencia: 👉 [Abrir WhatsApp con Asesor de Sucursal Resistencia](${waLinkResistencia})
  - Si es de otra ciudad o no especificó: 👉 [Abrir WhatsApp con Asesor Comercial](${waLinkGeneral})`;

    const leadRuleInstruction = leadAlreadyCaptured
      ? `\n\n[ESTADO DE SESIÓN]: Los datos del cliente ya fueron capturados y enviados con éxito en esta conversación. NO vuelvas a invocar la función \`enviar_lead_n8n\`. Continúa respondiendo normalmente y con calidez a las preguntas del usuario.`
      : `\n\nREGLA ESTRICTA DE CAPTURA Y CALIFICACIÓN DE LEADS:
Durante la conversación, si detectas interés comercial, solicita de forma amable, natural y conversacional los siguientes datos clave:
1. Datos de contacto: Nombre y Teléfono (o WhatsApp con código de área, ej: +54...).
2. Ubicación desde donde realiza la consulta: Pregunta si se encuentra en Resistencia o Posadas (nuestras sucursales). Si es de otra ciudad vecina (ej: Corrientes o Formosa), anótala en su ubicación.
3. Usado en parte de pago: Pregunta si tiene un usado (embarcación, lancha, motor o vehículo) para entregar como parte de pago (si no tiene, anota 'No').
4. Sistema Lancha Plan: Pregunta si está interesado en realizar el pago mediante el sistema "Lancha Plan" (si prefiere contado u otro medio, anota su preferencia).
5. (Opcional) Correo electrónico si lo facilita voluntariamente.

PAUTAS DE CONVERSACIÓN:
- Si el cliente hace una pregunta técnica o de precios antes de dar sus datos, respóndela primero con amabilidad y luego prosigue con la calificación.
- Una vez que tengas los datos de contacto (nombre y teléfono) y hayas consultado su ubicación (Resistencia o Posadas), si tiene usado y su interés en Lancha Plan, DEBES llamar inmediatamente a la función \`enviar_lead_n8n\` UNA SOLA VEZ.`;

    const legacyXmlInstruction = `\n\nSi por alguna razón la herramienta no se ejecutara pero el usuario proporcionó sus datos, adjunta al final <LEAD>{"name":"...","phone":"...","email":"...","ubicacion":"...","tiene_usado":"...","interesa_lanchaplan":"..."}</LEAD>.`;
    
    const finalSystemInstruction = rawSystemInstruction + baseKnowledge + leadRuleInstruction + whatsappProtocolInstruction + legacyXmlInstruction;

    const ai = getAi();

    const contents: Array<{ role: 'user' | 'model'; parts: Array<any> }> = [];

    if (Array.isArray(history)) {
      for (const msg of history) {
        if (msg && typeof msg.content === 'string' && msg.content.trim()) {
          contents.push({
            role: msg.role === 'model' ? 'model' : 'user',
            parts: [{ text: msg.content }]
          });
        }
      }
    }

    contents.push({
      role: 'user',
      parts: [{ text: message || '' }]
    });

    let response: any = null;
    let usedModel = 'gemini-2.5-flash';

    try {
      response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
        config: {
          systemInstruction: finalSystemInstruction,
          temperature: 0.7,
          tools: [{ functionDeclarations: [enviarLeadN8nDeclaration] }],
        },
      });
    } catch (primaryErr) {
      console.warn("gemini-2.5-flash attempt failed, falling back to gemini-2.0-flash:", primaryErr);
      usedModel = 'gemini-2.0-flash';
      response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents,
        config: {
          systemInstruction: finalSystemInstruction,
          temperature: 0.7,
          tools: [{ functionDeclarations: [enviarLeadN8nDeclaration] }],
        },
      });
    }

    let replyText = response.text || "";
    let capturedLead: { 
      name: string; 
      phone: string; 
      email?: string; 
      ubicacion?: string;
      tiene_usado?: string;
      interesa_lanchaplan?: string;
      interes?: string; 
      tenant_id?: string | null; 
      date?: string; 
    } | null = null;
    let functionCallResult: { name: string; args: any } | null = null;

    if (response.functionCalls && response.functionCalls.length > 0) {
      const call = response.functionCalls[0];
      if (call.name === 'enviar_lead_n8n') {
        const args = (call.args || {}) as { 
          nombre?: string; 
          telefono?: string; 
          email?: string; 
          ubicacion?: string;
          tiene_usado?: string;
          interesa_lanchaplan?: string;
          interes?: string; 
        };
        functionCallResult = { name: call.name, args };
        
        capturedLead = {
          name: args.nombre || 'Cliente Web',
          phone: args.telefono || '',
          email: args.email || '',
          ubicacion: args.ubicacion || '',
          tiene_usado: args.tiene_usado || '',
          interesa_lanchaplan: args.interesa_lanchaplan || '',
          interes: args.interes || '',
          tenant_id: tenantId || null,
          date: new Date().toISOString()
        };

        if (webhookUrl && typeof webhookUrl === 'string' && webhookUrl.startsWith('http')) {
          try {
            const rawUbic = (capturedLead.ubicacion || '').toLowerCase();
            const sucursalKey = rawUbic.includes('posadas') 
              ? 'posadas' 
              : (rawUbic.includes('resistencia') ? 'resistencia' : 'otra');
            const sucursalNombre = sucursalKey === 'posadas' 
              ? 'Posadas' 
              : (sucursalKey === 'resistencia' ? 'Resistencia' : (capturedLead.ubicacion || 'General'));
            
            const tieneUsadoBool = Boolean(
              capturedLead.tiene_usado && 
              capturedLead.tiene_usado.trim().toLowerCase() !== 'no' &&
              capturedLead.tiene_usado.trim().toLowerCase() !== 'ninguno'
            );

            const interesaLanchaPlanBool = Boolean(
              capturedLead.interesa_lanchaplan && 
              (capturedLead.interesa_lanchaplan.toLowerCase().includes('sí') || 
               capturedLead.interesa_lanchaplan.toLowerCase().includes('si') ||
               capturedLead.interesa_lanchaplan.toLowerCase().includes('cuota') ||
               capturedLead.interesa_lanchaplan.toLowerCase().includes('plan'))
            );

            const webhookPayload = {
              event: 'lead.created',
              platform: 'n8n',
              tenantId: tenantId || 'default',
              tenant_id: tenantId || 'default',
              source: 'function_calling_enviar_lead_n8n',
              timestamp: new Date().toISOString(),
              sucursal: sucursalKey,
              sucursal_nombre: sucursalNombre,
              nombre: capturedLead.name,
              name: capturedLead.name,
              telefono: capturedLead.phone,
              phone: capturedLead.phone,
              whatsapp_number: normalizeWhatsappNumber(capturedLead.phone),
              wa_link: normalizeWhatsappNumber(capturedLead.phone) ? `https://wa.me/${normalizeWhatsappNumber(capturedLead.phone)}` : '',
              email: capturedLead.email || '',
              ubicacion: capturedLead.ubicacion || '',
              tiene_usado: capturedLead.tiene_usado || '',
              tiene_usado_bool: tieneUsadoBool,
              interesa_lanchaplan: capturedLead.interesa_lanchaplan || '',
              interesa_lanchaplan_bool: interesaLanchaPlanBool,
              interes: capturedLead.interes || '',
              lead: {
                id: `lead_${Date.now()}`,
                ...capturedLead,
                sucursal: sucursalKey,
                sucursal_nombre: sucursalNombre,
                tiene_usado_bool: tieneUsadoBool,
                interesa_lanchaplan_bool: interesaLanchaPlanBool,
                whatsapp_number: normalizeWhatsappNumber(capturedLead.phone),
                wa_link: normalizeWhatsappNumber(capturedLead.phone) ? `https://wa.me/${normalizeWhatsappNumber(capturedLead.phone)}` : ''
              }
            };

            fetch(webhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(webhookPayload)
            }).catch(err => console.error("Webhook forward warning:", err));
          } catch (e) {
            console.error("Webhook forward error:", e);
          }
        }

                // Immediate structured response with WhatsApp direct link upon lead capture (super-fast, avoids timeouts)
        if (!replyText || replyText.trim() === '') {
          const nombreStr = args.nombre ? ` ${args.nombre}` : '';
          const ubicStr = args.ubicacion ? ` desde ${args.ubicacion}` : '';
          const usadoStr = args.tiene_usado ? ` (Usado: ${args.tiene_usado})` : '';
          const planStr = args.interesa_lanchaplan ? ` (Lancha Plan: ${args.interesa_lanchaplan})` : '';

          const rawU = (args.ubicacion || '').toLowerCase();
          const directLink = rawU.includes('posadas') ? waLinkPosadas : (rawU.includes('resistencia') ? waLinkResistencia : waLinkGeneral);
          const sucName = rawU.includes('posadas') ? 'Posadas' : (rawU.includes('resistencia') ? 'Resistencia' : 'Ventas');

          replyText = `¡Muchas gracias${nombreStr}! Registré tu consulta${ubicStr}${usadoStr}${planStr}. Un asesor comercial se pondrá en contacto a la brevedad al teléfono ${args.telefono || ''} para brindarte toda la información y cotización detallada.\n\nSi prefieres escribirnos tú mismo de inmediato para atención instantánea, haz clic aquí:\n👉 [Abrir WhatsApp con Asesor de ${sucName}](${directLink})`;
        }
      }
    }

    if (!replyText) {
      throw new Error("El modelo no devolvió ninguna respuesta.");
    }

    return res.status(200).json({ 
      text: replyText, 
      lead: capturedLead,
      functionCall: functionCallResult
    });
  } catch (error) {
    console.error("AI Generation Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to generate content";
    return res.status(500).json({ error: errorMessage });
  }
}
