// Page entry: content.json (all words and numbers) + voices/dur.json → film
import { makeFilm } from './film.js';
const cv = document.getElementById('c'), g = cv.getContext('2d');
const Q = new URLSearchParams(location.search);
await Promise.all(['300', '400', '500', '600'].map(w => document.fonts.load(`${w} 40px Rajdhani`)).concat([document.fonts.load('20px ShareTechMono')]));
const get = async (u, d) => { try { const r = await fetch(u); return r.ok ? await r.json() : d; } catch { return d; } };
const C = await get('content.json');
const dur = await get('voices/dur.json', {});
const film = makeFilm(C, dur);
window.DUR = film.TL.DUR;
window.EV = film.events();
window.SUBS = film.subs();
window.render = t => film.render(g, t, { nosub: Q.has('nosub'), gdir: Q.get('gdir') ?? 1 });
window.TEXTS = t => film.texts(g, t);
window.READY = true;
