const https = require("https");

const ENDPOINTS = {
  nhl:   "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard",
  mlb:   "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard",
  nba:   "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard",
  nfl:   "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard",
  wnba:  "https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/scoreboard",
  pwhl:  "https://site.api.espn.com/apis/site/v2/sports/hockey/pwhl/scoreboard",
  mls:   "https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/scoreboard",
  nwsl:  "https://site.api.espn.com/apis/site/v2/sports/soccer/usa.nwsl/scoreboard",
  epl:   "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard",
  eng2:  "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.2/scoreboard",
  laliga:"https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/scoreboard",
  ucl:   "https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/scoreboard",
  ligaex:"https://site.api.espn.com/apis/site/v2/sports/soccer/mex.2/scoreboard",
  arg1:  "https://site.api.espn.com/apis/site/v2/sports/soccer/arg.1/scoreboard",
  ncaavb:"https://site.api.espn.com/apis/site/v2/sports/volleyball/womens-college-volleyball/scoreboard",
};

const SPORT_KEY = {
  nhl:"NHL",mlb:"MLB",nba:"NBA",nfl:"NFL",wnba:"WNBA",pwhl:"PWHL",
  mls:"MLS",nwsl:"NWSL",epl:"EPL",eng2:"ENG2",laliga:"LALIGA",
  ucl:"UCL",ligaex:"LIGAEX",arg1:"ARG1",ncaavb:"NCAA VB",
};

const BROADCAST = {
  NHL:["ESPN+","NHL Net"],MLB:["MLB.TV"],NBA:["ESPN","ABC","NBC","Prime Video"],
  NFL:["Fox","CBS","ESPN","NBC"],WNBA:["ESPN","CBS"],PWHL:["ESPN+","Prime Video"],
  MLS:["Apple TV"],NWSL:["Prime Video","Peacock"],
  EPL:["Peacock","USA Net"],ENG2:["ESPN+"],
  LALIGA:["ESPN+","ESPN"],UCL:["CBS Sports","Paramount+"],
  LIGAEX:["ESPN Deportes"],ARG1:["ESPN Deportes","TyC Sports"],
  "NCAA VB":["ESPN","ESPN2","ESPN+"],
};

function todayStr() {
  const d = new Date();
  return d.getFullYear() + String(d.getMonth()+1).padStart(2,"0") + String(d.getDate()).padStart(2,"0");
}

function get(url) {
  return new Promise(function(resolve) {
    const req = https.get(url, function(res) {
      let b = "";
      res.on("data", function(c) { b += c; });
      res.on("end", function() { try { resolve(JSON.parse(b)); } catch(e) { resolve(null); } });
    });
    req.on("error", function() { resolve(null); });
    req.setTimeout(8000, function() { req.destroy(); resolve(null); });
  });
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=30");

  const date = todayStr();
  const all = [];

  await Promise.all(Object.keys(ENDPOINTS).map(async function(key) {
    try {
      const data = await get(ENDPOINTS[key] + "?dates=" + date + "&limit=100");
      if (!data || !data.events) return;
      const sport = SPORT_KEY[key];
      for (const ev of data.events) {
        const comp  = ev.competitions?.[0] || {};
        const teams = comp.competitors || [];
        const away  = teams.find(t => t.homeAway === "away") || teams[0] || {};
        const home  = teams.find(t => t.homeAway === "home") || teams[1] || {};
        const state = comp.status?.type?.state || "pre";
        const et    = new Date(ev.date).toLocaleTimeString("en-US", { hour:"numeric", minute:"2-digit", timeZone:"America/New_York" });
        const raw   = (comp.broadcasts || []).flatMap(b => b.names || []);
        all.push({
          id: ev.id, sport,
          away: (away.team?.abbreviation || "---").slice(0,4).toUpperCase(),
          home: (home.team?.abbreviation || "---").slice(0,4).toUpperCase(),
          awayFull: away.team?.displayName || "---",
          homeFull: home.team?.displayName || "---",
          et, status: state === "in" ? "live" : state === "post" ? "final" : "scheduled",
          as: state !== "pre" ? String(away.score ?? "") : "",
          hs: state !== "pre" ? String(home.score ?? "") : "",
          detail: state === "in" ? (comp.status?.type?.shortDetail || "") : "",
          streams: raw.length ? raw.slice(0,3) : (BROADCAST[sport] || []),
        });
      }
    } catch(e) {}
  }));

  const ORDER = { live:0, scheduled:1, final:2 };
  all.sort((a,b) => (ORDER[a.status]??1) - (ORDER[b.status]??1));

  res.status(200).json({ date, games: all });
};
