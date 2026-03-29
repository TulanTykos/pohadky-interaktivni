export const config = { runtime: 'edge' };

function extractJSON(raw) {
  let s = raw.replace(/```json/g, '').replace(/```/g, '').trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('JSON nenalezen v odpovedi');
  s = s.slice(start, end + 1);
  try {
    return JSON.parse(s);
  } catch(e) {
    s = s.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');
    s = s.replace(/[\x00-\x1F\x7F]/g, ' ');
    return JSON.parse(s);
  }
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

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let body;
  try { body = await req.json(); } catch { body = {}; }

  const { postavy, mista, predmety, nalada, volba1, volba2, text1, text2 } = body;

  const detiInfo = `Postavy v příběhu jsou POUZE tyto: ${postavy || 'odvážný hrdina'}.
NIKDY nepřidávej žádné další postavy které nebyly vybrány — žádné babičky, starce, pocestné, lesní bytosti ani jiné vedlejší postavy pokud nejsou v seznamu.
Pokud se mezi vybranými postavami vyskytují tato jména:
- Lukášek: živý malý chlapec se zlatými vlasy — mluví ve větách, je zvídavý a odvážný
- Emmička: malinká holčička s blonďatými vlásky — teprve se učí mluvit, říká krátká slůvka
- Marta: veselý chlapec s hnědými vlasy — kamarádský a hravý
- Editka: malé miminko s hnědými vlásky — ještě nechodí samo, brouká a směje se
- Přemek: malý šibalský chlapec s hnědými vlasy — plný energie, říká krátká slova
Piš o nich jako o skutečných dětech. Přizpůsob chování jejich velikosti a schopnostem. NIKDY nepoužívej přesný věk číslicí — místo toho piš "malý", "malinký", "nemluvně", "batole" a podobně.`;

  const jsonPravidla = `DULEZITE PRAVIDLA PRO JSON:
- Pouzivej POUZE dvojite uvozovky pro klice i hodnoty
- NIKDY nepouzivej apostrofy uvnitr textu — nahrad je slovem nebo vynech
- NIKDY nepouzivej uvozovky uvnitr hodnot — pouzij jinak formulovanou vetu
- Nepouz zadne specialni znaky ani zalomeni radku uvnitr hodnot JSON
- Hodnoty musi byt na jednom radku`;

  // Fáze 1 — začátek + první větvení
  if (!volba1 && !volba2) {
    const prompt = `Jsi zkušený český pohádkář. Piš krásnou češtinou ve stylu klasických pohádek.

${detiInfo}

Místo děje: ${mista || 'kouzelná země'}
Kouzelné věci v příběhu: ${predmety || 'kouzelný předmět'}
Vyznění příběhu: ${nalada || 'šťastný konec'}

Napiš začátek pohádky (150 slov) a zastav těsně před prvním rozhodnutím.
Větvení musí být o tom CO POSTAVA ŘEKNE nebo UDĚLÁ — například zda se podělí, pozdraví, řekne pravdu, pomůže.

${jsonPravidla}

Odpověz POUZE v tomto JSON formátu:
{
  "nazev": "název pohádky",
  "text1": "text začátku pohádky",
  "otazka1": "Krátká otázka co postava řekne nebo udělá",
  "moznost1a": "První možnost pět až osm slov",
  "moznost1b": "Druhá možnost pět až osm slov",
  "moznost1c": "Třetí možnost pět až osm slov"
}`;

    try {
      const raw = await callClaude(prompt);
      const parsed = extractJSON(raw);
      return Response.json({ faze: 1, ...parsed });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  }

  // Fáze 2 — střed + druhé větvení
  if (volba1 && !volba2) {
    const prompt = `Jsi zkušený český pohádkář. Piš krásnou češtinou ve stylu klasických pohádek.

${detiInfo}

Místo děje: ${mista || 'kouzelná země'}
Kouzelné věci v příběhu: ${predmety || 'kouzelný předmět'}

Dosavadní příběh který jsi napsal:
"""
${text1 || ''}
"""

Hráč se rozhodl: ${volba1}

Pokyny:
- Přesně navaž na poslední větu dosavadního příběhu
- Ukaž přirozeně jak volba ovlivnila děj — laskavá volba věci usnadní, méně laskavá přinese drobnou překážku ze které se postava poučí
- Délka střední části: 120 slov
- Zastav těsně před druhým rozhodnutím
- Větvení musí být o tom CO POSTAVA ŘEKNE nebo UDĚLÁ
- Neobjevuj žádné nové postavy které nebyly v původním seznamu

${jsonPravidla}

Odpověz POUZE v tomto JSON formátu:
{
  "text2": "střední část pohádky navazující přesně na předchozí text",
  "otazka2": "Krátká otázka co postava řekne nebo udělá",
  "moznost2a": "První možnost pět až osm slov",
  "moznost2b": "Druhá možnost pět až osm slov",
  "moznost2c": "Třetí možnost pět až osm slov"
}`;

    try {
      const raw = await callClaude(prompt);
      const parsed = extractJSON(raw);
      return Response.json({ faze: 2, ...parsed });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  }

  // Fáze 3 — závěr
  if (volba1 && volba2) {
    const prompt = `Jsi zkušený český pohádkář. Piš krásnou češtinou ve stylu klasických pohádek.

${detiInfo}

Místo děje: ${mista || 'kouzelná země'}
Kouzelné věci v příběhu: ${predmety || 'kouzelný předmět'}
Vyznění příběhu: ${nalada || 'šťastný konec'}

Celý dosavadní příběh:
"""
${text1 || ''}

${text2 || ''}
"""

Hráč se rozhodl: ${volba2}

Pokyny:
- Přesně navaž na poslední větu dosavadního příběhu
- Ukaž jak druhá volba ovlivnila výsledek celého příběhu
- Obě volby dohromady (${volba1} a ${volba2}) formují závěr — projev to přirozeně
- Vždy skonči pozitivně — i méně laskavé volby vedou k poučení a šťastnému konci
- Na úplný konec přidej krátké poučení začínající například: A tak se naučil... nebo A tak pochopil...
- Délka závěru: 150 slov
- Neobjevuj žádné nové postavy které nebyly v původním seznamu

${jsonPravidla}

Odpověz POUZE v tomto JSON formátu:
{
  "text3": "závěr pohádky přesně navazující na předchozí text včetně poučení na konci"
}`;

    try {
      const raw = await callClaude(prompt);
      const parsed = extractJSON(raw);
      return Response.json({ faze: 3, ...parsed });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  }

  return Response.json({ error: 'Neplatny stav' }, { status: 400 });
}
