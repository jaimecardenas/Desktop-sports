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

function todayStr(){
  return new Date().toLocaleDateString("en-CA",{timeZone:"America/New_York"}).replace(/-/g,"");
}

function get(url){
  return new Promise(function(resolve){
    var options={
      hostname:"site.api.espn.com",
      path:url,
      headers:{
        "User-Agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept":"application/json",
        "Accept-Language":"en-US,en;q=0.9",
        "Referer":"https://www.espn.com/",
        "Origin":"https://www.espn.com"
      },
      timeout:10000
    };
    var req=https.get(options,function(res){
      var b="";
      res.on("data",function(c){b+=c;});
      res.on("end",function(){try{resolve(JSON.parse(b));}catch(e){resolve(null);}});
    });
    req.on("error",function(){resolve(null);});
    req.setTimeout(10000,function(){req.destroy();resolve(null);});
  });
}

module.exports=function(req,res){
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Cache-Control","s-maxage=55,stale-while-revalidate=5");
  var date=todayStr();
  var all=[];
  var done=0;
  var total=LEAGUES.length;

  function finish(){
    all.sort(function(a,b){
      var o={live:0,scheduled:1,final:2};
      return(o[a.status]!==undefined?o[a.status]:1)-(o[b.status]!==undefined?o[b.status]:1);
    });
    res.status(200).json({date:date,games:all});
  }

  LEAGUES.forEach(function(row){
    var path="/apis/site/v2/sports/"+row[1]+"/"+row[2]+"/scoreboard?dates="+date+"&limit=100";
    get(path).then(function(data){
      if(data&&data.events){
        data.events.forEach(function(ev){
          try{
            var comp=ev.competitions[0]||{};
            var teams=comp.competitors||[];
            var away=teams.filter(function(t){return t.homeAway==="away";})[0]||teams[0]||{};
            var home=teams.filter(function(t){return t.homeAway==="home";})[0]||teams[1]||{};
            var state=comp.status.type.state||"pre";
            var et=new Date(ev.date).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",timeZone:"America/New_York"});
            var raw=[];
            (comp.broadcasts||[]).forEach(function(b){(b.names||[]).forEach(function(n){raw.push(n);});});
            all.push({
              id:ev.id,sport:row[0],
              away:((away.team||{}).abbreviation||"---").slice(0,4).toUpperCase(),
              home:((home.team||{}).abbreviation||"---").slice(0,4).toUpperCase(),
              awayFull:(away.team||{}).displayName||"---",
              homeFull:(home.team||{}).displayName||"---",
              et:et,
              status:state==="in"?"live":state==="post"?"final":"scheduled",
              as:state!=="pre"?String(away.score!=null?away.score:""):"",
              hs:state!=="pre"?String(home.score!=null?home.score:""):"",
              detail:state==="in"?(comp.status.type.shortDetail||""):"",
              streams:raw.length?raw.slice(0,3):(BROADCAST[row[0]]||[]),
            });
          }catch(e){}
        });
      }
      done++;
      if(done===total)finish();
    });
  });
};
