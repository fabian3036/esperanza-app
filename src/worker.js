export default {
  async fetch(request, env) {
    // Encabezados CORS para permitir llamadas desde cualquier origen
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    // Responder a la verificación previa (preflight) del navegador
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response("Usa POST con un JSON { mensaje: '...' }", {
        status: 405,
        headers: corsHeaders
      });
    }

    try {
      const body = await request.json();
      const mensaje = body.mensaje;

      if (!mensaje) {
        return new Response(JSON.stringify({ error: "Falta el campo 'mensaje'" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: mensaje }] }]
          })
        }
      );

      const data = await geminiRes.json();
      const respuesta = data?.candidates?.[0]?.content?.parts?.[0]?.text || JSON.stringify(data);

      return new Response(JSON.stringify({ respuesta }), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
  }
};
