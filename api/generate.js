export const config = { runtime: 'edge' };

function extractJSON(raw) {
  // Odstran markdown code bloky
  let s = raw.replace(/```json/g, '').replace(/```/g, '').trim();
  // Najdi prvni { a posledni }
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('JSON nenalezen v odpovedi');
  s = s.slice(start, end + 1);
  // Pokus o parse
  try {
    return JSON.parse(s);
  } catch(e) {
    // Zkus opravit — nahrad nepárové apostrofy
    s = s.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');
    // Odstraň ridici znaky
    s = s.replace(/[\x00-\x1F\x7F]/g, ' ');
    return JSON.parse(s);
  }
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let body;
  try { body = await req.json(); } catch { body = {}; }

  const { postavy, mista, predmety, nalada, volba1, volba2 } = body;

  const detiInfo = `Pokud se mezi postavami vyskytují tato jména:
- Lukášek: živý pětiletý chlapec se zlatými vlasy
- Emmička: dvouletá holčička s blonďatými vlásky
- Marta: veselý chlapec s hnědými vlasy
- Editka: roční miminko s hnědými vlásky
- Přemek: dvouletý chlapec s hnědými vlasy
Piš o nich jako o skutečných dětech. Přizpůsob chování věku.`;

  const jsonPravidla = `DULEZITE PRAVIDLA PRO JSON:
- Pouzivej POUZE dvojite uvozovky pro klice i hodnoty
- NIKDY nepouzivej apostrofy uvnitr textu — nahrad je slovem nebo vynech
- NIKDY nepouzivej uvozovky uvnitr hodnot — pouzij jinak formulovanou vetu
- Nepouz zadne specialni znaky ani zalomeni radku uvnitr hodnot JSON
- Hodnoty musi byt na jednom radku`;

  // Fáze 1
  if (!volba1 && !volba2) {
    const prompt = `Jsi zkušený český pohádkář. Piš krásnou češtinou ve stylu klasických pohádek.

${detiInfo}

Postavy: ${postavy || 'odvážný hrdina'}
Místo: ${mista || 'kouzelná země'}
Kouzelné věci: ${predmety || 'kouzelný předmět'}
Vyznění: ${nalada || 'šťastný konec'}

Napiš začátek pohádky (150 slov) a zastav na PRVNÍM větvení.
Větvení musí být o tom CO POSTAVA ŘEKNE nebo UDĚLÁ.
Příklady: "Pozdraví staříčka nebo ho přejde?", "Podělí se o jídlo nebo si ho nechá?", "Řekne pravdu nebo zalže?"

${jsonPravidla}

Odpověz POUZE v tomto JSON formátu:
{
  "nazev": "název pohádky bez uvozovek",
  "text1": "text začátku pohádky který končí těsně před rozhodnutím",
  "otazka1": "Krátká otázka co postava řekne nebo udělá",
  "moznost1a": "První možnost pět až osm slov",
  "moznost1b": "Druhá možnost pět až osm slov",
  "moznost1c": "Třetí možnost pět až osm slov"
}`;

    try {
      const apiRes = await callClaude(prompt);
      const parsed = extractJSON(apiRes);
      return Response.json({ faze: 1, ...parsed });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  }

  // Fáze 2
  if (volba1 && !volba2) {
    const prompt = `Jsi zkušený český pohádkář. Piš krásnou češtinou ve stylu klasických pohádek.

${detiInfo}

Postavy: ${postavy || 'odvážný hrdina'}
Místo: ${mista || 'kouzelná země'}
Kouzelné věci: ${predmety || 'kouzelný předmět'}

Hráč zvolil: ${volba1}

Napiš střední část pohádky (120 slov). Ukaž jak volba ovlivnila příběh.
Laskavá volba — věci se daří. Méně laskavá — drobná překážka, postava se poučí, nic zlého.
Pak zastav na DRUHÉM větvení — opět o tom co postava řekne nebo udělá.

${jsonPravidla}

Odpověz POUZE v tomto JSON formátu:
{
  "text2": "střední část pohádky která končí těsně před rozhodnutím",
  "otazka2": "Krátká otázka co postava řekne nebo udělá",
  "moznost2a": "První možnost pět až osm slov",
  "moznost2b": "Druhá možnost pět až osm slov",
  "moznost2c": "Třetí možnost pět až osm slov"
}`;

    try {
      const apiRes = await callClaude(prompt);
      const parsed = extractJSON(apiRes);
      return Response.json({ faze: 2, ...parsed });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  }

  // Fáze 3
  if (volba1 && volba2) {
    const prompt = `Jsi zkušený český pohádkář. Piš krásnou češtinou ve stylu klasických pohádek.

${detiInfo}

Postavy: ${postavy || 'odvážný hrdina'}
Místo: ${mista || 'kouzelná země'}
Kouzelné věci: ${predmety || 'kouzelný předmět'}
Vyznění: ${nalada || 'šťastný konec'}

První volba hráče: ${volba1}
Druhá volba hráče: ${volba2}

Napiš závěr pohádky (150 slov). Ukaž jak obě volby ovlivnily výsledek.
Vždy skonči pozitivně — i méně laskavé volby vedou k poučení a zlepšení.
Na konci přidej poučení začínající například slovy: A tak se hrdina naučil...

${jsonPravidla}

Odpověz POUZE v tomto JSON formátu:
{
  "text3": "závěr pohádky včetně poučení"
}`;

    try {
      const apiRes = await callClaude(prompt);
      const parsed = extractJSON(apiRes);
      return Response.json({ faze: 3, ...parsed });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  }

  return Response.json({ error: 'Neplatny stav' }, { status: 400 });
}

async function callClaude(prompt) {
  const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!apiRes.ok) {
    const err = await apiRes.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Anthropic error');
  }
  const data = await apiRes.json();
  return data.content?.map(b => b.text || '').join('') || '';
}
