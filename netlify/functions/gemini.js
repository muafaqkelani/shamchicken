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

        // جلب قائمة النماذج المتاحة لمفتاحك لاكتشاف البديل النشط
        const modelsResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const modelsData = await modelsResponse.json();

        if (!modelsResponse.ok || !modelsData.models) {
            throw new Error("Failed to fetch available models from Google.");
        }

        // تصفية النماذج واستبعاد أي نموذج متوقف، والبحث عن أي نموذج فلاش متاح يدعم التوليد
        const validModels = modelsData.models.filter(m => 
            m.name.includes("flash") && 
            !m.name.includes("omni") && // استبعاد النموذج الذي تسبب بالمشكلة
            m.supportedGenerationMethods && 
            m.supportedGenerationMethods.includes("generateContent")
        );

        if (validModels.length === 0) {
            throw new Error("No available active Flash models found for this API key.");
        }

        // اختيار أول نموذج فلاش نشط ومتاح
        const selectedModel = validModels[0].name;
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/${selectedModel}:generateContent?key=${apiKey}`;

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