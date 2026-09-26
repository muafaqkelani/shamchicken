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

        // تصفية النماذج: استبعاد omni و flash تماماً، والتركيز على الإصدارات الحديثة (مثل 3.x) ودعم التوليد
        const availableModels = modelsData.models.filter(m => 
            !m.name.toLowerCase().includes("omni") && 
            !m.name.toLowerCase().includes("flash") && 
            (m.name.includes("3.") || m.name.includes("gemini-pro")) &&
            m.supportedGenerationMethods && 
            m.supportedGenerationMethods.includes("generateContent")
        );

        // إذا لم توجد نماذج مطابقة، نقوم بالبحث عن أي نموذج أساسي نشط كخطة بديلة
        let selectedModelName;
        if (availableModels.length > 0) {
            // ترتيب النماذج تنازلياً لاختيار أحدث إصدار متاح (مثل 3.8 ثم 3.5 إلخ)
            availableModels.sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true }));
            selectedModelName = availableModels[0].name;
        } else {
            // خطة بديلة: استخدام نموذج pro القياسي المستقر
            selectedModelName = "models/gemini-pro";
        }

        // إرسال الطلب باستخدام النموذج المكتشف والنشط
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