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

        // جلب قائمة النماذج المتاحة من خوادم Google
        const modelsResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const modelsData = await modelsResponse.json();

        if (!modelsResponse.ok || !modelsData.models) {
            throw new Error("Failed to fetch available models from Google.");
        }

        // تصفية النماذج لاختيار أحدث نموذج "flash" يدعم التوليد تلقائياً
        const flashModels = modelsData.models.filter(m => 
            m.name.includes("flash") && 
            m.supportedGenerationMethods && 
            m.supportedGenerationMethods.includes("generateContent")
        );

        if (flashModels.length === 0) {
            throw new Error("No supported Flash model found for this API key.");
        }

        // ترتيب النماذج تلقائياً لاختيار الأحدث (الذي يمتلك الاسم الأطول أو الإصدار الأعلى)
        flashModels.sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true }));

        const selectedModelName = flashModels[0].name; // سيختار أحدث نموذج تلقائياً (مثل gemini-3.8-flash)

        // إرسال الطلب باستخدام النموذج المكتشف تلقائياً
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