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
          if (key.name.startsWith("nota:")) {
            const valor = await env.MEMORIA.get(key.name);
            if (valor) notas.push(valor);
          }
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

      // ---- CONECTAR (Conexiones) ----
      if (accion === "conectar") {
        const problema = body.problema;
        if (!problema) {
          return new Response(JSON.stringify({ error: "Falta describir el problema" }), {
            status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }
        const promptConectar = `El usuario te va a describir un PROBLEMA (no una solución que ya tenga en mente). Tu trabajo es actuar como un pensador creativo que conecta ideas de campos distintos y no obvios (negocios, ingeniería, naturaleza, psicología, historia, otras industrias) para proponer estrategias originales.

Problema del usuario: "${problema}"

Responde en español con este formato exacto:

CONEXIONES ENCONTRADAS:
(2 a 4 ideas o principios de otros campos que se pueden conectar con este problema, explicando brevemente cada uno y por qué aplica aquí)

ESTRATEGIAS PROPUESTAS:
(2 a 3 estrategias concretas y accionables que nacen de esas conexiones, numeradas)

PRIMER PASO SUGERIDO:
(una acción concreta y simple que el usuario podría hacer hoy mismo para empezar)

Sé específico, evita consejos genéricos como "sé creativo" o "piensa fuera de la caja" — busca conexiones realmente no obvias.`;

        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${env.GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: promptConectar }] }] })
          }
        );
        const data = await geminiRes.json();
        const respuesta = data?.candidates?.[0]?.content?.parts?.[0]?.text || JSON.stringify(data);
        return new Response(JSON.stringify({ respuesta }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      // ---- GUARDAR IDEA (Banco de ideas) ----
      if (accion === "guardarIdea") {
        const texto = body.texto;
        if (!texto) {
          return new Response(JSON.stringify({ error: "Falta el texto de la idea" }), {
            status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        const promptClasificar = `Clasifica la siguiente idea en EXACTAMENTE una de estas categorías: Negocio, Personal, Contenido, Producto, Otro.

Idea: "${texto}"

Responde ÚNICAMENTE con la palabra de la categoría, sin explicación, sin puntuación.`;

        const claseRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${env.GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: promptClasificar }] }] })
          }
        );
        const claseData = await claseRes.json();
        let categoria = claseData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "Otro";
        const categoriasValidas = ["Negocio", "Personal", "Contenido", "Producto", "Otro"];
        if (!categoriasValidas.includes(categoria)) categoria = "Otro";

        const clave = `idea:${Date.now()}`;
        const valor = JSON.stringify({ texto, categoria, fecha: new Date().toISOString() });
        await env.MEMORIA.put(clave, valor);

        return new Response(JSON.stringify({ ok: true, guardado: texto, categoria }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      // ---- LISTAR IDEAS (Banco de ideas) ----
      if (accion === "listarIdeas") {
        const lista = await env.MEMORIA.list();
        const ideas = [];
        for (const key of lista.keys) {
          if (key.name.startsWith("idea:")) {
            const valor = await env.MEMORIA.get(key.name);
            if (valor) {
              try {
                ideas.push(JSON.parse(valor));
              } catch (e) { /* ignorar entradas corruptas */ }
            }
          }
        }
        ideas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        return new Response(JSON.stringify({ ideas }), {
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
