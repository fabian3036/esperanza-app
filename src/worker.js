export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Usa POST con un JSON { mensaje: '...' }", { status: 405 });
    }

    try {
      const body = await request.json();
      const mensaje = body.mensaje;

      if (!mensaje) {
        return new Response(JSON.stringify({ error: "Falta el campo 'mensaje'" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }

      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: mensaje }] }]
          })
        }
      );

      const data = await geminiRes.json();
      const respuesta = data?.candidates?.[0]?.content?.parts?.[0]?.text || "Sin respuesta de Gemini";

      return new Response(JSON.stringify({ respuesta }), {
        headers: { "Content-Type": "application/json" }
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
};
 
