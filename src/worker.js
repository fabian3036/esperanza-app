export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response("Usa POST", { status: 405, headers: corsHeaders });
    }

    try {
      const body = await request.json();
      const accion = body.accion; // "guardar" o "buscar"

      // ---- GUARDAR ----
      if (accion === "guardar") {
        const texto = body.texto;
        if (!texto) {
          return new Response(JSON.stringify({ error: "Falta el texto a guardar" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }
        const clave = `nota:${Date.now()}`;
        await env.MEMORIA.put(clave, texto);
        return new Response(JSON.stringify({ ok: true, guardado: texto }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      // ---- BUSCAR ----
      if (accion === "buscar") {
        const pregunta = body.pregunta;
        if (!pregunta) {
          return new Response(JSON.stringify({ error: "Falta la pregunta" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        // Traer todas las notas guardadas
        const lista = await env.MEMORIA.list();
        const notas = [];
        for (const key of lista.keys) {
          const valor = await env.MEMORIA.get(key.name);
          if (valor) notas.push(valor);
        }

        const contexto = notas.length > 0
          ? "Estas son las notas que el usuario ha guardado:\n" + notas.map((n, i) => `${i + 1}. ${n}`).join("\n")
          : "El usuario no ha guardado ninguna nota todavía.";

        const promptFinal = `${contexto}\n\nPregunta del usuario: ${pregunta}\n\nResponde basándote únicamente en las notas de arriba. Si no encuentras la respuesta en las notas, dilo claramente.`;

        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${env.GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: promptFinal }] }] })
          }
        );

        const data = await geminiRes.json();
        const respuesta = data?.candidates?.[0]?.content?.parts?.[0]?.text || JSON.stringify(data);

        return new Response(JSON.stringify({ respuesta }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      return new Response(JSON.stringify({ error: "Acción no reconocida. Usa 'guardar' o 'buscar'" }), {
        status: 400,
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
