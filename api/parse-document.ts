import { GoogleGenAI } from "@google/genai";

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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { base64, filename, mimeType, textContent } = req.body || {};

    if (!filename) {
      return res.status(400).json({ error: 'Falta el nombre del archivo (filename).' });
    }

    // If plain text content was sent directly (e.g. .txt, .csv, .md)
    if (textContent && typeof textContent === 'string' && textContent.trim()) {
      return res.status(200).json({
        success: true,
        title: filename,
        content: textContent.trim(),
        tokensEstimated: Math.round(textContent.length / 4)
      });
    }

    if (!base64) {
      return res.status(400).json({ error: 'Se requiere el contenido del archivo en base64 o textContent.' });
    }

    const cleanBase64 = base64.replace(/^data:[^;]+;base64,/, '');
    const actualMimeType = mimeType || 'application/pdf';

    const ai = getAi();

    const prompt = `Eres un extractor experto de bases de conocimiento para un asistente comercial de ventas.
Analiza este documento completo ("${filename}") y extrae toda la información relevante de forma ordenada y exhaustiva en formato Markdown.

Directrices de extracción:
1. Extrae todas las especificaciones técnicas (embarcaciones, lanchas, semirrígidos, motores, eslora, manga, potencia máxima, capacidad de personas).
2. Conserva íntegramente las listas de precios, cuotas, sistemas de financiación (como Lancha Plan) y tablas de cotizaciones en tablas Markdown claras.
3. Extrae servicios, ubicación de sucursales (Resistencia, Posadas, etc.), condiciones comerciales y formas de pago.
4. Organiza el contenido con títulos (#, ##, ###) y viñetas para que la IA comercial pueda buscar y responder con precisión milimétrica a los clientes.
5. NO resumas ni omitas modelos o precios: transcríbelos fielmente.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: cleanBase64,
                mimeType: actualMimeType,
              }
            },
            {
              text: prompt
            }
          ]
        }
      ],
      config: {
        temperature: 0.2,
      }
    });

    const extractedText = response.text || '';
    if (!extractedText.trim()) {
      throw new Error('No se pudo extraer texto del documento.');
    }

    return res.status(200).json({
      success: true,
      title: filename.replace(/\.[^/.]+$/, ""), // Without extension
      filename,
      content: extractedText.trim(),
      mimeType: actualMimeType
    });
  } catch (error: any) {
    console.error("Error al procesar documento con Gemini:", error);
    return res.status(500).json({ 
      error: error?.message || 'Error al procesar el archivo PDF/documento.' 
    });
  }
}
