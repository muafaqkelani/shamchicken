exports.handler = async function(event, context) {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    try {
        // استخراج البيانات المرسلة من الواجهة الأمامية
        const requestBody = JSON.parse(event.body);
        
        // جلب المفتاح السري من متغيرات البيئة في إعدادات Netlify
        const apiKey = process.env.GEMINI_API_KEY; 
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

        // تجهيز الطلب بالهيكلية التي تطلبها Google
        const payload = {
            contents: [{ parts: [{ text: requestBody.message }] }],
            systemInstruction: { parts: [{ text: requestBody.systemPrompt }] }
        };

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        
        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Internal Server Error" })
        };
    }
};