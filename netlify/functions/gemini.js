exports.handler = async function(event, context) {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    try {
        const requestBody = JSON.parse(event.body);
        const apiKey = process.env.GEMINI_API_KEY; 

        if (!apiKey) {
            return {
                statusCode: 500,
                body: JSON.stringify({ error: { message: "API key is missing in environment variables." } })
            };
        }

        // الخطوة 1: جلب قائمة النماذج المتاحة تلقائياً لمفتاحك
        const modelsResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const modelsData = await modelsResponse.json();

        if (!modelsResponse.ok || !modelsData.models) {
            throw new Error("Failed to fetch available models from Google.");
        }

        // البحث عن أول نموذج يدعم توليد المحتوى generateContent
        const supportedModel = modelsData.models.find(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent"));

        if (!supportedModel) {
            throw new Error("No supported Gemini model found for this API key.");
        }

        // استخراج اسم النموذج المتاح تلقائياً (مثل models/gemini-1.5-flash)
        const modelName = supportedModel.name;

        // الخطوة 2: إرسال الطلب باستخدام النموذج المكتشف تلقائياً
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${apiKey}`;

        const payload = {
            contents: [{ parts: [{ text: requestBody.message }] }],
            system_instruction: { parts: [{ text: requestBody.systemPrompt }] }
        };

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        
        if (!response.ok) {
            return {
                statusCode: response.status,
                body: JSON.stringify({ error: { message: data.error?.message || "Google API Error" } })
            };
        }

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: { message: error.message || "Internal Server Error" } })
        };
    }
};