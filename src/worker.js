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
        `https
