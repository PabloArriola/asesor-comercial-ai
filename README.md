# Asesor Comercial AI

Asistente de IA chatbot comercial y calificador de leads náuticos y comerciales, con soporte multi-tenant (multi-empresa), Gemini AI Function Calling y Firebase Firestore.

## Características

- 💬 **Chatbot interactivo:** Widget flotante para sitios web y página standalone.
- 🏢 **Multi-empresa (Multi-tenant):** Soporta múltiples empresas con configuración y leads independientes vía `?tenant=ID`.
- 🎯 **Captura y calificación de leads:** Nombre, teléfono, ubicación, permutas/usados e interés en financiación.
- ⚡ **Integración con CRM / Webhooks:** Envío automático a n8n, Make, Zapier o endpoints personalizados.
- 🧠 **Google Gemini AI:** Procesamiento de lenguaje natural y function calling inteligente con `@google/genai`.
- 🔥 **Firebase:** Almacenamiento serverless de configuraciones y leads en Firestore.

## Ejecución Local

1. Instalar dependencias:
   ```bash
   npm install
   ```

2. Configurar el archivo `.env`:
   ```env
   GEMINI_API_KEY="tu_api_key_de_gemini"
   APP_URL="http://localhost:3000"
   ```

3. Iniciar el servidor:
   ```bash
   npm run dev
   ```

4. Abrir en el navegador: [http://localhost:3000](http://localhost:3000)
