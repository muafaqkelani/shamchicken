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

        // اعتماد نموذج gemini-3.5-flash-lite حصراً
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`;

        const payload = {
            contents: [{ parts: [{ text: requestBody.message }] }],
            system_instruction: { parts: [{ text: requestBody.systemPrompt }] }
        };

        let response;
        let data;
        let retries = 3; 
        let delay = 1000;

        while (retries > 0) {
            response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            data = await response.json();

            if (response.ok || (response.status !== 503 && response.status !== 429)) {
                break;
            }

            retries--;
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2;
        }
        
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