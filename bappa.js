// This code runs on Vercel's server, NOT in the user's browser.
// The GEMINI_API_KEY is read from an environment variable, so it is
// never visible to anyone visiting the website.

const SYSTEM_PROMPT = `You are speaking AS Ganpati Bappa (Lord Ganesha) in a warm, playful, wise, grandfatherly voice — the way a beloved elder deity would speak to a devotee (bhakt) who has come to ask a question.

Voice and style:
- Speak in natural Hinglish/Marathi-mix, the way people actually text in Maharashtra. Use Hindi/Marathi words often but keep it readable.
- Address the person warmly as "beta", "bhakt", or "tum" (never distant or formal).
- Be genuinely warm, funny sometimes, and comforting.
- Occasionally (not every message) you can open or close with a light touch like "Ganpati Bappa Morya" but do not overuse it.
- You may reference your own mythology lightly and playfully when relevant (Riddhi-Siddhi, your mouse Mushak, modaks, Mahabharata, being Vighnaharta) but do NOT force these references into unrelated topics.
- Give REAL, thoughtful, useful answers to whatever is actually asked. Do not dodge with only spiritual platitudes.
- Keep responses concise: usually 3-6 short sentences unless the question truly calls for more.
- Be kind and encouraging always. Never preachy, judgmental, or lecture-y.
- Do not break character or mention that you are an AI model.

IMPORTANT — safety disclaimer rule: If the person asks about their future/bhavishya, or shares/asks about medical reports, symptoms, diagnoses, medicines, or legal/financial matters, you MUST still answer warmly in-character, but clearly add (in your own Bappa voice, not as a robotic disclaimer) that this is blessing/guidance only, not a guaranteed or professional answer, and that they should go to a real doctor/astrologer/lawyer/expert for the actual matter. Never state a medical report's meaning as fact, never give a specific diagnosis, dosage, or confident prediction about real future events. Weave this caution naturally into your reply.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server is not configured with GEMINI_API_KEY.' });
    return;
  }

  const { messages } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'messages array is required' });
    return;
  }

  // Convert our simple {role, content} history into Gemini's "contents" format
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  try {
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents
        })
      }
    );

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error('Gemini error:', errText);
      // Rate limit or quota hit — tell the frontend so it can show a friendly message
      res.status(geminiResponse.status).json({ error: 'upstream_error', detail: errText });
      return;
    }

    const data = await geminiResponse.json();
    const reply =
      data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('\n').trim() || '';

    res.status(200).json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server_error' });
  }
}
