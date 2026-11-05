export type ChatMessage = {
  role: 'user' | 'model';
  content: string;
};

export type CapturedLeadData = {
  name: string;
  phone: string;
  email?: string;
  ubicacion?: string;
  tiene_usado?: string;
  interesa_lanchaplan?: string;
  interes?: string;
  tenant_id?: string | null;
  date?: string;
};

export type SendMessageResult = {
  text: string;
  lead?: CapturedLeadData | null;
  functionCall?: {
    name: string;
    args: any;
  } | null;
};

export type WhatsAppConfigPayload = {
  whatsappNumber?: string;
  whatsappResistencia?: string;
  whatsappPosadas?: string;
  whatsappDefaultMessage?: string;
};

export async function sendMessage(
  history: ChatMessage[], 
  message: string, 
  systemPrompt?: string, 
  knowledgeBase?: string,
  tenantId?: string | null,
  webhookUrl?: string | null,
  whatsappConfig?: WhatsAppConfigPayload
): Promise<SendMessageResult> {
  const payload = JSON.stringify({
    history,
    message,
    systemPrompt,
    knowledgeBase,
    tenantId,
    webhookUrl,
    whatsappConfig
  });

  const doFetch = async () => {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: payload,
    });

    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${await response.text()}`);
    }

    return await response.json();
  };

  try {
    let data;
    try {
      data = await doFetch();
    } catch (initialErr) {
      console.warn("First request attempt had an issue, retrying in 1s...", initialErr);
      await new Promise(res => setTimeout(res, 1000));
      data = await doFetch();
    }

    return {
      text: data.text || '',
      lead: data.lead || null,
      functionCall: data.functionCall || null
    };
  } catch (error) {
    console.error("AI Generation Error:", error);
    throw error;
  }
}
