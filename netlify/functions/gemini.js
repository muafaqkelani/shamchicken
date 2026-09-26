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

        // الخطوة 1: استعراض وعرض قائمة النماذج المتاحة من خوادم Google تلقائياً
        const modelsResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const modelsData = await modelsResponse.json();

        if (!modelsResponse.ok || !modelsData.models) {
            throw new Error("Failed to fetch available models from Google.");
        }

        // الخطوة 2: تصفية النماذج لاختيار نماذج "flash" النشطة التي تدعم التوليد حصراً
        const availableModels = modelsData.models.filter(m => 
            m.name.includes("flash") && 
            m.supportedGenerationMethods && 
            m.supportedGenerationMethods.includes("generateContent")
        );

        if (availableModels.length === 0) {
            throw new Error("No active Flash models found for this API key.");
        }

        // الخطوة 3: ترتيب النماذج تنازلياً لاختيار أحدث وأعلى إصدار متاح تلقائياً
        availableModels.sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true }));

        const selectedModelName = availableModels[0].name; // سيختار أحدث نموذج متاح وجاهز للطلب فوراً

        // الخطوة 4: إرسال الطلب باستخدام النموذج المكتشف والأحدث
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/${selectedModelName}:generateContent?key=${apiKey}`;

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