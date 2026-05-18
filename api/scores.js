const https = require("https");

const LEAGUES = [
  ["NHL","hockey","nhl"],["MLB","baseball","mlb"],["NBA","basketball","nba"],
  ["NFL","football","nfl"],["WNBA","basketball","wnba"],["MLS","soccer","usa.1"],
  ["NWSL","soccer","usa.nwsl"],["EPL","soccer","eng.1"],["ENG2","soccer","eng.2"],
  ["LALIGA","soccer","esp.1"],["UCL","soccer","uefa.champions"],
  ["LIGAMX","soccer","mex.1"],["LIGAEX","soccer","mex.2"],["ARG1","soccer","arg.1"],
  ["PWHL","hockey","pwhl"],["NCAAVB","volleyball","womens-college-volleyball"],
];

const BROADCAST = {
  NHL:["ESPN+","NHL Net"],MLB:["MLB.TV"],NBA:["ESPN","ABC","NBC","Prime Video"],
  NFL:["Fox","CBS","ESPN","NBC"],WNBA:["ESPN","CBS"],MLS:["Apple TV"],
  NWSL:["Prime Video","Peacock"],EPL:["Peacock","USA Net"],ENG2:["ESPN+"],
  LALIGA:["ESPN+","ESPN"],UCL:["CBS Sports","Paramount+"],
  LIGAMX:["Univision","TUDN","ViX"],LIGAEX:["ESPN Deportes"],
  ARG1:["ESPN Deportes","TyC Sports"],PWHL:["ESPN+","Prime Video"],
  NCAAVB:["ESPN","ESPN2","ESPN+"],
};

function todayStr() {
  var d = new Date();
  return d.getFullYear() + String(d.getMonth()+1).padStart(2,"0") + String(d.getDate()).padStart(2,"0");
}

function get(url) {
  return new Promise(function(resolve) {
    var req = https.get(url, function(res) {
      var b = "";
      res.on("data", function(c) { b += c; });
      res.on("end", function() {
        try { resolve(JSON.parse(b)); } catch(e) { resolve(null); }
      });
    });
    req.on("error", function() { resolve(null); });
    req.setTimeout(8000, function() { req.destroy(); resolve(null); });
  });
}

module.exports = function(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=55, stale-while-revalidate=5");
  var date = todayStr();
  var all = [];
  var done = 0;
  var total = LEAGUES.length;

  function finish() {
    all.sort(function(a,b) {
      var o = {live:0,scheduled:1,final:2};
      var oa = o[a.status] !== undefined ? o[a.status] : 1;
      var ob = o[b.status] !== undefined ? o[b.status] : 1;
      return oa - ob;
    });
    res.status(200).json({date:date, games:all});
  }

  LEAGUES.forEach(function(row) {
    var url = "https://site.api.espn.com/apis/site/v2/sports/" + row[1] + "/" + row[2] + "/scoreboard?dates=" + date + "&limit=100";
    get(url).then(function(data) {
      if (data && data.events) {
        data.events.forEach(function(ev) {
          try {
            var comp = ev.competitions[0] || {};
            var teams = comp.competitors || [];
            var away = teams.filter(function(t){return t.homeAway==="away";})[0] || teams[0] || {};
            var home = teams.filter(function(t){return t.homeAway==="home";})[0] || teams[1] || {};
            var state = comp.status.type.state || "pre";
            var et = new Date(ev.date).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",timeZone:"America/New_York"});
            var raw = [];
            (comp.broadcasts||[]).forEach(function(b){(b.names||[]).forEach(function(n){raw.push(n);});});
            all.push({
              id: ev.id, sport: row[0],
              away: ((away.team||{}).abbreviation||"---").slice(0,4).toUpperCase(),
              home: ((home.team||{}).abbreviation||"---").slice(0,4).toUpperCase(),
              awayFull: (away.team||{}).displayName||"---",
              homeFull: (home.team||{}).displayName||"---",
              et: et,
              status: state==="in"?"live":state==="post"?"final":"scheduled",
              as: state!=="pre" ? String(away.score!=null?away.score:"") : "",
              hs: state!=="pre" ? String(home.score!=null?home.score:"") : "",
              detail: state==="in" ? (comp.status.type.shortDetail||"") : "",
              streams: raw.length ? raw.slice(0,3) : (BROADCAST[row[0]]||[]),
            });
          } catch(e) {}
        });
      }
      done++;
      if (done === total) finish();
    });
  });
};
