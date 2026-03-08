#!/usr/bin/env node
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

let pdfLib;
try { pdfLib = require('pdf-lib'); }
catch(e) {
  try { pdfLib = require(path.join(process.env.HOME||'/home/claude','.npm-global/lib/node_modules/pdf-lib')); }
  catch(e2) { console.error('pdf-lib not found'); process.exit(1); }
}
const { PDFDocument, rgb, StandardFonts } = pdfLib;

const PDF_HEIGHT = 842;
const topY = y => PDF_HEIGHT - y;

const ZONES = {
  Date_echeance:      [{ x:141.6, y:topY(61.9),  w:86.3,  h:17.8 }, { x:165.1, y:topY(180.9), w:74.3,  h:17.8 }],
  Ville:              [{ x:241.4, y:topY(46.1),  w:77.7,  h:13.5 }, { x:16.3,  y:topY(179.4), w:70.6,  h:14.8 }],
  Date_edition:       [{ x:242.3, y:topY(59.5),  w:77.3,  h:13.0 }, { x:90.2,  y:topY(180.4), w:70.1,  h:16.8 }],
  RIB:                [{ x:153.1, y:topY(85.4),  w:187.1, h:14.9 }, { x:20.8,  y:topY(205.6), w:186.7, h:14.9 }],
  Montant:            [{ x:373.8, y:topY(83.0),  w:102.7, h:13.0 }, { x:372.4, y:topY(124.7), w:102.6, h:12.9 }],
  Montant_en_lettres: [{ x:17.8,  y:topY(153.5), w:403.0, h:11.0 }],
  A_lordre_de:        [{ x:145.4, y:topY(138.7), w:203.9, h:16.8 }],
  Payeur:             [{ x:225.5, y:topY(256.7), w:92.6,  h:40.3 }],
  Banque:             [{ x:336.4, y:topY(220.2), w:139.1, h:20.6 }],
};

// Standard font size used for ALL fields
const STD_SIZE = 12;

function numberToFrench(n) {
  const units = ['','UN','DEUX','TROIS','QUATRE','CINQ','SIX','SEPT','HUIT','NEUF','DIX','ONZE','DOUZE','TREIZE','QUATORZE','QUINZE','SEIZE','DIX-SEPT','DIX-HUIT','DIX-NEUF'];
  const tens  = ['','DIX','VINGT','TRENTE','QUARANTE','CINQUANTE','SOIXANTE','SOIXANTE','QUATRE-VINGT','QUATRE-VINGT'];
  if(n===0) return 'ZERO';
  if(n<0)   return 'MOINS '+numberToFrench(-n);
  if(n<20)  return units[n];
  if(n<70)  { const t=Math.floor(n/10),u=n%10; return tens[t]+(u>0?(u===1&&t!==8&&t!==9?'-ET-':'-')+units[u]:''); }
  if(n<80)  { const u=n-60; return 'SOIXANTE'+(u===1?'-ET-':'-')+numberToFrench(u); }
  if(n<100) { const u=n-80; return 'QUATRE-VINGT'+(u>0?'-'+numberToFrench(u):'S'); }
  if(n<1000){ const h=Math.floor(n/100),r=n%100; return (h===1?'':units[h]+'-')+'CENT'+(r===0&&h>1?'S':'')+(r>0?'-'+numberToFrench(r):''); }
  if(n<1000000){ const m=Math.floor(n/1000),r=n%1000; return (m===1?'MILLE':numberToFrench(m)+'-MILLE')+(r>0?'-'+numberToFrench(r):''); }
  const m=Math.floor(n/1000000),r=n%1000000;
  return numberToFrench(m)+'-MILLION'+(m>1?'S':'')+(r>0?'-'+numberToFrench(r):'');
}

function parseMontant(s) {
  const p = s.replace(',','.').split('.');
  const dinars = parseInt(p[0])||0;
  const msStr = p[1]?p[1].padEnd(3,'0').substring(0,3):'000';
  return { dinars, millimes: parseInt(msStr)||0, millimesStr: msStr };
}

function montantEnLettres(s) {
  const {dinars,millimes} = parseMontant(s);
  let r='## '+numberToFrench(dinars)+(dinars>1?' DINARS':' DINAR');
  if(millimes>0) r+=' '+numberToFrench(millimes)+(millimes>1?' MILLIMES':' MILLIME');
  return r+' ##';
}

function formatMontant(s) {
  const {dinars,millimesStr} = parseMontant(s);
  return `## ${dinars.toLocaleString('fr-FR').replace(/\u202f/g,' ')},${millimesStr} ##`;
}

// RIB: 14002002101700122510 → "14  002      0021017001225        10"
function formatRIB(rib) {
  const r = rib.replace(/\s/g, '');
  if (r.length !== 20) return r;
  return `${r.slice(0,2)}  ${r.slice(2,5)}      ${r.slice(5,18)}        ${r.slice(18,20)}`;
}

async function generateTraite(data) {
  const tpl = fs.readFileSync(path.join(__dirname,'template','traite_template.pdf'));
  const pdfDoc = await PDFDocument.load(tpl);
  const page = pdfDoc.getPages()[0];
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Draw text centered in zone, always start at STD_SIZE and shrink only if text overflows
  function drawInZone(text, zone) {
    if(!text) return;
    let sz = STD_SIZE;
    let tw = font.widthOfTextAtSize(text, sz);
    // Only shrink if text doesn't fit - never grow beyond STD_SIZE
    if(tw > zone.w - 2) {
      sz = Math.max(5, sz * (zone.w - 2) / tw);
      tw = font.widthOfTextAtSize(text, sz);
    }
    const x = zone.x + (zone.w - tw) / 2;
    const y = zone.y + (zone.h - sz) / 2;
    page.drawText(text, { x, y, size: sz, font, color: rgb(0,0,0) });
  }

  function apply(field, text) {
    if(!text || !ZONES[field]) return;
    ZONES[field].forEach(z => drawInZone(text, z));
  }

  apply('Date_echeance',      data.date_echeance || '');
  apply('Ville',              (data.ville || '').toUpperCase());
  apply('Date_edition',       data.date_edition || '');
  apply('RIB',                data.rib ? formatRIB(data.rib) : '');
  apply('Montant',            data.montant ? formatMontant(data.montant) : '');
  apply('Montant_en_lettres', data.montant ? montantEnLettres(data.montant) : '');
  apply('A_lordre_de',        (data.a_lordre_de || '').toUpperCase());
  apply('Payeur',             (data.payeur || '').toUpperCase());
  apply('Banque',             (data.banque || '').toUpperCase());

  return await pdfDoc.save();
}

function parseBody(req) {
  return new Promise((res,rej)=>{
    let b='';
    req.on('data',c=>b+=c);
    req.on('end',()=>{ try{res(JSON.parse(b||'{}'));}catch{res({});} });
    req.on('error',rej);
  });
}

const MIME = {'.html':'text/html','.js':'application/javascript','.css':'text/css','.pdf':'application/pdf'};

const server = http.createServer(async(req,res)=>{
  const {pathname} = url.parse(req.url);
  res.setHeader('Access-Control-Allow-Origin','*');

  if(req.method==='POST' && pathname==='/generate') {
    try {
      const data = await parseBody(req);
      const pdf = await generateTraite(data);
      res.writeHead(200,{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="traite.pdf"'});
      res.end(Buffer.from(pdf));
    } catch(e) { res.writeHead(500); res.end(JSON.stringify({error:e.message})); }
    return;
  }

  if(req.method==='POST' && pathname==='/preview') {
    try {
      const d = await parseBody(req);
      const p={};
      if(d.date_echeance) p.date_echeance = d.date_echeance;
      if(d.ville)         p.ville         = d.ville.toUpperCase();
      if(d.date_edition)  p.date_edition  = d.date_edition;
      if(d.rib)           p.rib           = formatRIB(d.rib);
      if(d.montant) {
        p.montant           = formatMontant(d.montant);
        p.montant_en_lettres = montantEnLettres(d.montant);
      }
      if(d.a_lordre_de) p.a_lordre_de = d.a_lordre_de.toUpperCase();
      if(d.payeur)      p.payeur      = d.payeur.toUpperCase();
      if(d.banque)      p.banque      = d.banque.toUpperCase();
      res.writeHead(200,{'Content-Type':'application/json'});
      res.end(JSON.stringify(p));
    } catch(e) { res.writeHead(500); res.end(JSON.stringify({error:e.message})); }
    return;
  }

  // Static files
  const fp = (pathname==='/'||pathname==='/index.html')
    ? path.join(__dirname,'public','index.html')
    : path.join(__dirname,'public',pathname);
  if(fs.existsSync(fp)) {
    res.writeHead(200,{'Content-Type':MIME[path.extname(fp)]||'text/plain'});
    res.end(fs.readFileSync(fp));
  } else { res.writeHead(404); res.end('Not found'); }
});

const PORT = process.env.PORT || 3000;

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌  Port ${PORT} déjà utilisé.`);
    console.error(`    Essayez :  PORT=3001 node server.js\n`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});

server.listen(PORT, () => {
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║  🏦  Traite Generator — Lettre de Change  ║');
  console.log('╠═══════════════════════════════════════════╣');
  console.log(`║  🌐  http://localhost:${PORT}                  ║`);
  console.log('║  ⌨   Ctrl+C pour arrêter                  ║');
  console.log('╚═══════════════════════════════════════════╝\n');
});
