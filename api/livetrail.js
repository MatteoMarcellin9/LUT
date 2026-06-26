const UTMB_BASE = "https://utmblive-api.utmb.world";
const TENANCY   = { year: "2026", tenant: "lavaredo" };

const ATHLETES = {
  "4310": "Sergio+Marcellin",
  "4740": "Seraina+Rizzardini",
  "4873": "Fabio+Perencin",
};

function utmbHeaders() {
  return {
    "content-type": "application/json",
    "X-Tenant": `${TENANCY.tenant}_${TENANCY.year}`,
    "User-Agent": "Mozilla/5.0",
  };
}

function parseRunner(xml, doss) {
  const fiches = xml.split('<fiche ');
  for (let i = 1; i < fiches.length; i++) {
    if (!fiches[i].includes(`doss="${doss}"`)) continue;
    const f = fiches[i];
    const field = (k) => { const m = f.match(new RegExp(`${k}="([^"]*)"`)); return m ? m[1] : null; };
    const out = { doss, passages: [], prev: [], state: {} };
    const sm = f.match(/<state ([^/]+)\/>/);
    if (sm) { out.state.code=field.call({},sm[1])||null; for(const k of ['clt','cltsex','cltcat','code']) { const m=sm[1].match(new RegExp(`${k}="([^"]*)"`)); if(m) out.state[k]=m[1]; } }
    const passIdx=f.indexOf('<pass>'), passEnd=f.indexOf('</pass>');
    if(passIdx>=0&&passEnd>passIdx){ const block=f.slice(passIdx,passEnd); (block.match(/<e ([^>]+?)>/g)||[]).forEach(e=>{out.passages.push({idpt:e.match(/idpt="([^"]*)"/)?.[1],ha:e.match(/ha="([^"]*)"/)?.[1]||e.match(/hd="([^"]*)"/)?.[1],tps:e.match(/tps="([^"]*)"/)?.[1],clt:e.match(/clt="([^"]*)"/)?.[1]});}); }
    const prevIdx=f.indexOf('<prev'), prevEnd=f.indexOf('</prev>');
    if(prevIdx>=0&&prevEnd>prevIdx){ const block=f.slice(prevIdx,prevEnd); (block.match(/<e ([^>]+?)\/>/g)||[]).forEach(e=>{out.prev.push({idpt:e.match(/idpt="([^"]*)"/)?.[1],h:e.match(/h="([^"]*)"/)?.[1],km:e.match(/km="([^"]*)"/)?.[1]});}); }
    return out;
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const results = {};
  await Promise.all(Object.entries(ATHLETES).map(async ([doss, rech]) => {
    try {
      // LiveTrail per passaggi checkpoint
      const ltUrl = `https://lavaredo.livetrail.net/coureur.php?rech=${rech}`;
      const ltR = await fetch(ltUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
      const xml = await ltR.text();
      const lt = parseRunner(xml, doss);

      // UTMB per dati aggiuntivi (ranking, foto)
      const utmbR = await fetch(`${UTMB_BASE}/runners/${doss}?locale=it`, { headers: utmbHeaders() });
      let utmb = null;
      if (utmbR.ok) utmb = await utmbR.json();

      results[doss] = {
        ...(lt || {}),
        utmb: utmb?.resume || null,
      };
    } catch(e) {
      results[doss] = { error: e.message };
    }
  }));

  return res.status(200).json(results);
}
