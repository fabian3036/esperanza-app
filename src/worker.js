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

    if (request.method === "GET") {
      return env.ASSETS.fetch(request);
    }

    if (request.method !== "POST") {
      return new Response("Método no soportado", { status: 405, headers: corsHeaders });
    }

    try {
      const body = await request.json();
      const accion = body.accion;

      // ---- GUARDAR NOTA (Memoria externa) ----
      if (accion === "guardar") {
        const texto = body.texto;
        if (!texto) {
          return new Response(JSON.stringify({ error: "Falta el texto a guardar" }), {
            status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }
        const clave = `nota:${Date.now()}`;
        await env.MEMORIA.put(clave, texto);
        return new Response(JSON.stringify({ ok: true, guardado: texto }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      // ---- BUSCAR (Memoria externa) ----
      if (accion === "buscar") {
        const pregunta = body.pregunta;
        if (!pregunta) {
          return new Response(JSON.stringify({ error: "Falta la pregunta" }), {
            status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }
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

      // ---- IDENTIFICAR (¿Qué estoy viendo?) ----
      if (accion === "identificar") {
        const imagenBase64 = body.imagen;
        const mimeType = body.mimeType || "image/jpeg";
        if (!imagenBase64) {
          return new Response(JSON.stringify({ error: "Falta la imagen" }), {
            status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        const promptVision = `Mira esta imagen e identifica qué se ve, adaptando tu respuesta según el tipo de cosa. Sé completo y detallado, no básico:

Si es un OBJETO:
- Qué es exactamente (nombre específico, no genérico)
- Para qué sirve y cómo se usa correctamente
- Marca o fabricante si es identificable
- Material del que está hecho
- Época o antigüedad aproximada si aplica
- Estado de conservación
- Valor aproximado si es relevante (antigüedad, colección, reventa)
- Curiosidades o datos poco conocidos sobre el objeto

Si es una PLANTA:
- Nombre común y nombre científico
- Familia de la planta
- Si es tóxica o segura para personas y mascotas (y qué síntomas causa si es tóxica)
- Cuidados básicos (luz, agua, tipo de suelo)
- Usos conocidos (medicinal, ornamental, comestible)
- Origen de la especie

Si es un ANIMAL o INSECTO:
- Especie o tipo específico (no genérico)
- IMPORTANCIA MÉDICA primero y de forma clara: si es venenoso, peligroso, o transmisor de enfermedades — con advertencia visible al inicio
- Qué hacer si te encuentras con este animal (evitarlo, capturarlo, llamar a alguien)
- Comportamiento típico y hábitat
- Si es común en la zona de México/Cancún

Si la imagen parece mostrar algo extraño, borroso o "paranormal" (sombras raras, luces, formas inusuales):
- Da la explicación más probable y racional con detalle (tipo de reflejo, por qué se forma esa sombra, efecto óptico o de cámara específico)
- Explica por qué NO es necesariamente algo sobrenatural, con el razonamiento completo

Si la imagen muestra principalmente a una PERSONA: no intentes identificarla ni describirla físicamente; en su lugar, analiza los objetos, ropa o elementos materiales relevantes que aparecen en la escena, siguiendo el formato de OBJETO de arriba.

Responde en español, organizado con los títulos correspondientes, de forma completa pero clara.`;

        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${env.GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { text: promptVision },
                  { inline_data: { mime_type: mimeType, data: imagenBase64 } }
                ]
              }]
            })
          }
        );
        const data = await geminiRes.json();
        const respuesta = data?.candidates?.[0]?.content?.parts?.[0]?.text || JSON.stringify(data);
        return new Response(JSON.stringify({ respuesta }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      // ---- REPARAR (Hazlo tú mismo) ----
      if (accion === "reparar") {
        const imagenBase64 = body.imagen;
        const mimeType = body.mimeType || "image/jpeg";
        if (!imagenBase64) {
          return new Response(JSON.stringify({ error: "Falta la imagen" }), {
            status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }
        const promptReparar = `Mira esta imagen de algo que necesita reparación y responde en español, de forma clara y organizada con estos títulos exactos:

PROBLEMA PROBABLE:
(explica qué parece estar dañado o mal)

HERRAMIENTAS NECESARIAS:
(lista simple)

MATERIALES NECESARIOS:
(lista simple)

PASOS A SEGUIR:
(numerados, claros, paso a paso)

DIFICULTAD: (Fácil / Media / Difícil)

TIEMPO ESTIMADO: (ej. 15-30 minutos)

Si no estás seguro del problema exacto por la imagen, dilo honestamente y da la explicación más probable.`;

        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${env.GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { text: promptReparar },
                  { inline_data: { mime_type: mimeType, data: imagenBase64 } }
                ]
              }]
            })
          }
        );
        const data = await geminiRes.json();
        const respuesta = data?.candidates?.[0]?.content?.parts?.[0]?.text || JSON.stringify(data);
        return new Response(JSON.stringify({ respuesta }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      return new Response(JSON.stringify({ error: "Acción no reconocida" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
  }
};
