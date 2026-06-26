// Proxy + parser per LiveTrail (Lavaredo 50K)
const ATHLETES = {
  "4310": { name: "Sergio Marcellin",  rech: "Sergio Marcellin" },
  "4740": { name: "Seraina Rizzardini", rech: "Seraina Rizzardini" },
  "4873": { name: "Fabio Perencin",    rech: "Fabio Perencin" },
};

function parseField(str, field) {
  const m = str.match(new RegExp(`${field}="([^"]*)"`));
  return m ? m[1] : null;
}

function parseRunner(xml, doss) {
  // Isola la fiche giusta
  const fiches = xml.split('<fiche ');
  let fiche = null;
  for (let i = 1; i < fiches.length; i++) {
    if (fiches[i].includes(`doss="${doss}"`)) { fiche = fiches[i]; break; }
  }
  if (!fiche) return null;

  const out = { doss, passages: [], prev: [], state: {} };

  // Stato
  const stateM = fiche.match(/<state ([^/]+)\/>/);
  if (stateM) {
    out.state.code = parseField(stateM[1], "code");
    out.state.clt  = parseField(stateM[1], "clt");
    out.state.cltsex = parseField(stateM[1], "cltsex");
    out.state.cltcat = parseField(stateM[1], "cltcat");
  }

  // Passaggi reali
  const passIdx = fiche.indexOf('<pass>');
  const passEnd = fiche.indexOf('</pass>');
  if (passIdx >= 0 && passEnd > passIdx) {
    const block = fiche.slice(passIdx, passEnd);
    const events = block.match(/<e ([^>]+?)>/g) || [];
    for (const e of events) {
      out.passages.push({
        idpt: parseField(e, "idpt"),
        ha: parseField(e, "ha") || parseField(e, "hd"),
        tps: parseField(e, "tps"),
        clt: parseField(e, "clt"),
      });
    }
  }

  // Previsioni
  const prevIdx = fiche.indexOf('<prev');
  const prevEnd = fiche.indexOf('</prev>');
  if (prevIdx >= 0 && prevEnd > prevIdx) {
    const block = fiche.slice(prevIdx, prevEnd);
    const events = block.match(/<e ([^>]+?)\/>/g) || [];
    for (const e of events) {
      out.prev.push({
        idpt: parseField(e, "idpt"),
        h: parseField(e, "h"),
        km: parseField(e, "km"),
      });
    }
  }

  return out;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const { doss } = req.query;

  // Recupera dati per un singolo atleta o tutti
  const targets = doss ? [doss] : Object.keys(ATHLETES);
  const results = {};

  await Promise.all(targets.map(async (d) => {
    const athlete = ATHLETES[d];
    if (!athlete) return;
    try {
      const url = `https://lavaredo.livetrail.net/coureur.php?rech=${encodeURIComponent(athlete.rech)}`;
      const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!r.ok) { results[d] = { error: r.status }; return; }
      const xml = await r.text();
      const parsed = parseRunner(xml, d);
      results[d] = parsed || { error: "not found" };
    } catch (e) {
      results[d] = { error: e.message };
    }
  }));

  return res.status(200).json(results);
}
