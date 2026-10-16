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

export async function sendMessage(
  history: ChatMessage[], 
  message: string, 
  systemPrompt?: string, 
  knowledgeBase?: string,
  tenantId?: string | null,
  webhookUrl?: string | null
): Promise<SendMessageResult> {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        history,
        message,
        systemPrompt,
        knowledgeBase,
        tenantId,
        webhookUrl
      }),
    });

    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
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

