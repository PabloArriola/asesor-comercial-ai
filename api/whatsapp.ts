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

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: Webhook verification for WhatsApp Cloud API (Meta) or test pings
  if (req.method === 'GET') {
    const mode = req.query?.['hub.mode'];
    const token = req.query?.['hub.verify_token'];
    const challenge = req.query?.['hub.challenge'];

    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'asesor_nautico_verify_token';

    if (mode === 'subscribe' && token === verifyToken) {
      return res.status(200).send(challenge);
    }
    return res.status(200).json({ 
      status: "WhatsApp Webhook Active", 
      instructions: "Usa este endpoint en n8n o Meta Cloud API para responder mensajes de WhatsApp." 
    });
  }

  // POST: Receive message from WhatsApp (n8n, Meta Cloud API, Evolution API)
  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      
      // Parse message and sender from various formats (n8n payload, direct payload, or Meta payload)
      let incomingMessage = body.message || body.text || '';
      let senderPhone = body.phone || body.from || body.sender || '';
      const systemPrompt = body.systemPrompt || "Eres un asesor comercial náutico experto, amable y resolutivo.";
      const knowledgeBase = body.knowledgeBase || '';
      const tenantId = body.tenantId || body.tenant_id || 'default';

      // If it comes in Meta WhatsApp Cloud API format:
      if (!incomingMessage && body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
        const metaMsg = body.entry[0].changes[0].value.messages[0];
        incomingMessage = metaMsg.text?.body || '';
        senderPhone = metaMsg.from || '';
      }

      if (!incomingMessage.trim()) {
        return res.status(200).json({ status: "ignored", reason: "No message text provided" });
      }

      const ai = getAi();
      const prompt = `${systemPrompt}\n\n<base_de_conocimiento>\n${knowledgeBase}\n</base_de_conocimiento>\n\n` +
        `Estás respondiendo a través de WhatsApp (número de cliente: ${senderPhone}). ` +
        `Sé conciso, profesional y conversacional. No uses títulos gigantes ni formato Markdown pesado que se vea mal en WhatsApp. ` +
        `Utiliza saltos de línea y emojis comerciales moderados.\n\n` +
        `Mensaje del cliente: "${incomingMessage}"`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { temperature: 0.7 }
      });

      const replyText = response.text || "¡Hola! Gracias por comunicarte con nuestro asesor comercial. En breve un asesor te responderá.";

      return res.status(200).json({
        success: true,
        reply: replyText,
        text: replyText,
        to: senderPhone,
        tenantId,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      console.error("WhatsApp webhook error:", err);
      return res.status(500).json({ error: err?.message || "Error procesando mensaje de WhatsApp." });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
