# stats.lk: planul proiectului

Alternativă independentă la stats.fm, cu toate feature-urile gratis. Doar web, doar Spotify, doar în engleză.

## Decizii (din cele 50 de întrebări)

| Temă | Decizie |
| --- | --- |
| Public | Doar tu și prietenii, în Spotify Development Mode |
| Domeniu | `stats.lucariki.top` (temporar) |
| Hosting | VM Ubuntu 24.04 pe Proxmox, cu Docker Compose |
| Platforme | Doar web, fără app de mobil și fără PWA |
| Surse de date | Doar Spotify: polling + import ZIP „Extended streaming history” |
| Genuri | Etichete Last.fm, filtrate la genuri reale (Spotify nu le mai dă). Last.fm e folosit doar pentru asta, nu și pentru date de ascultare. |
| Login | Doar cu Spotify |
| Design | Dark implicit, inspirat de stats.fm, dar cu identitate proprie (alt nume, alt logo, alt design) |
| Open-source | Da, mai târziu. Git îl inițializăm când zici tu. |
| Monetizare | Gratis, eventual donații |

**Nu facem:** app de mobil, PWA, alte platforme decât Spotify, podcasturi, statistici de skip/shuffle/device, playlisturi automate.

## Limitările Spotify (verificate în noiembrie 2026)

- **Maxim 5 useri** pe app în Development Mode (din februarie 2026; înainte erau 25). Fiecare user trebuie adăugat manual în Spotify Dashboard → User Management.
- **Proprietarul app-ului trebuie să aibă Spotify Premium.** Fără Premium, app-ul nu mai funcționează.
- Extended Quota (fără limită de useri) se dă doar firmelor, cu minimum 250.000 de useri activi lunar.
- Câmpuri eliminate: `popularity`, `followers`, plus endpoint-urile batch (`GET /artists?ids=`, `GET /tracks?ids=`). Detaliile artiștilor și ale pieselor importate le luăm unul câte unul, încet, din worker.
- **Genurile nu mai vin:** la toți artiștii testați, Spotify returnează lista de genuri goală. Le luăm de pe Last.fm (`LASTFM_API_KEY`).
- Recently played: doar ultimele 50 de piese și fără durata reală ascultată (o estimăm din durata piesei).

## Cum se strâng datele

1. **La login:** se salvează imediat ultimele 50 de piese.
2. **Worker:** citește fiecare user la 3 minute (configurabil). Cu 5 useri, asta înseamnă mai puțin de 2 request-uri pe minut.
3. **La deschiderea dashboard-ului:** sync imediat, ca datele să fie la zi („aproape instant”).
4. **Import ZIP:** tot istoricul, cu minutele exacte ascultate. Se unește cu datele de mai sus fără duplicate.

## Roadmap

- [x] **Faza 1: Fundația.** Login Spotify, tokenuri criptate, worker de sync, bază de date, dashboard minimal (minute azi și pe 7 zile, top 5 artiști, ultimele piese, banner despre limitare), Docker.
- [x] **Faza 2: Import și ghid.** Pagina `/guide` cu 8 pași, pagina `/import`. ZIP-ul e citit în browser, iar pe server ajung doar piesa, ora și durata. Redările sub 30 de secunde sunt ignorate. Nu apar duplicate față de ce a salvat deja worker-ul. Worker-ul caută pe Spotify piesele importate, începând cu cele mai ascultate.
- [x] **Faza 3a: Statistici de bază.** Navigare comună. `/top/{tracks,artists,albums,genres}` pe 4 săptămâni, 6 luni, 1 an, all-time sau interval custom, sortate după redări sau minute. Până se strânge istoric, apare topul Spotify. Pagini de artist, piesă și album (redări, minute, prima ascultare, ziua record, minute pe lună). `/activity` cu heatmap pe 12 luni, streak-uri și grafice pe oră, zi și lună (cu tooltip și tabel).
- [x] **Faza 3b: Insights și Wrapped.** `/insights/compare`: săptămâna, luna sau anul curent față de aceleași zile din perioada anterioară, cu schimbările din top. `/insights/discover`: artiști noi și „forgotten favorites” (minim 10 redări, nimic în ultimele 90 de zile). `/insights/milestones`: praguri pentru minute, redări, artiști și streak, cu progres, plus istoricul celor atinse (inclusiv „a 100-a redare din X”). `/wrapped/{an}`: Wrapped pentru orice an.
- [x] **Faza 4a: Social.**
  - `/settings`: cine îți vede profilul (doar eu, prieteni sau toată lumea; implicit doar eu) și dacă se vede ce asculți acum.
  - `/friends`: cereri de prietenie, cine ascultă ceva acum (live), feed cu ce au ascultat prietenii în ultimele 7 zile, lista oamenilor de pe stats.lk.
  - `/u/{spotifyId}`: profil cu now playing, compatibilitate de gusturi (% plus artiștii comuni) și topuri pe 4 săptămâni.
  - Pe pagina de artist: „Top listeners” printre userii pe care îi poți vedea.
  - Now playing în dashboard: worker-ul îl actualizează la 30 de secunde, iar al tău se cere direct de la Spotify.
- [x] **Faza 4b: Share și ascundere.**
  - **Ascundere:** „Hide from others” pe paginile de artist și piesă, plus lista din `/settings`. Ce e ascuns nu apare pe profil, în feed, în now playing, în „Top listeners”, în taste match sau pe cardurile de share. Statisticile tale rămân complete.
  - **Share:** `/share` generează imagini 1080×1920 (top artiști, top piese, Wrapped) cu butoane Share (meniul de share al telefonului) și Download. Butoane „Share” există și pe paginile Top și Wrapped.
- [x] **Faza 5: Cont și legal.**
  - Export CSV sau JSON din Settings (JSON include și profilul, prietenii și elementele ascunse).
  - Ștergerea contului: tastezi „delete” și se șterg toate datele.
  - `/privacy` și `/terms`, footer pe toate paginile, mesaj de acord la login.
  - `/admin` pentru ID-urile din `ADMIN_SPOTIFY_IDS`: starea worker-ului (heartbeat), useri, redări, coada de metadate, mărimea bazei de date.
  - **De făcut de tine:** pune `CONTACT_EMAIL` în `.env`. Textele legale sunt un punct de plecare, nu consultanță juridică.
- [x] **Faza 5b: Finisare UI.** Logo și favicon, meniu de cont, bară de navigare jos pe telefon, componente comune (`src/components/ui.tsx`), titluri de tab, pagini 404 și de eroare, stări goale.
- [x] **Faza 6: UI runda 2.**
  - **Accent verde** pentru toată lumea (nu se alege din setări). Logo și favicon tot verzi.
  - **Pagina principală** (`/`) e o prezentare a produsului, ca la stats.fm: hero animat, previzualizări de top, heatmap și ore, FAQ. Numerele și artiștii sunt reali: totaluri anonime din toți userii, fără elementele ascunse, puse în cache pentru o oră.
  - **`/login`** separat, cu butonul verde „Continue with Spotify”.
  - **Username-uri:** profilul e la `/u/{username}` (de exemplu `/u/lucariki`), iar username-ul se schimbă din Settings. Link-urile vechi cu ID-ul Spotify duc automat la cel nou.
  - **Top:**
    - Pe fiecare rând: redările și minutele din perioada aleasă, inclusiv pe topul Spotify (din istoricul salvat, altfel „No plays saved”).
    - Bare proporționale pe rânduri.
    - Pe desktop, o coloană cu rezumatul perioadei.
  - **Activity:**
    - Orele colorate pe momente ale zilei, cu legendă; weekendul colorat separat.
    - Vârful marcat pe fiecare grafic și o propoziție-rezumat. Fără ceas circular.
  - **Trofee și niveluri:**
    - 50 de niveluri cu nume din cariera muzicală („Bedroom listener” până la „Legend”).
    - 20 de trofee în 4 categorii, cu trepte bronz/argint/aur.
    - `/insights/trophies` înlocuiește Milestones. Nivelul și trofeele apar și pe dashboard și pe profil.
  - **Settings pe tab-uri:**
    - Profil, Privacy, Preferences (fus orar, prima zi a săptămânii, perioada și sortarea implicite pentru Top), Connections, Data (inclusiv ștergerea doar a istoricului importat), Sessions (dispozitive, „Log out everywhere”).
  - **Ghidul** ocupă tot ecranul, cu pașii pe două coloane și locuri pentru capturi.
  - **Limite la import:**
    - Fără redări dinainte de octombrie 2008 sau mai lungi de 4 ore.
    - Maxim 1.000.000 de redări importate pe cont.
    - Maxim 300 de bucăți pe minut.
  - **Capturile pentru ghid** sunt în `public/guide/`, decupate pe formatul ramei (16:10). Dacă Spotify își schimbă paginile, se înlocuiesc cu fișiere cu același nume.
  - **Idee pentru mai târziu:** marcăm importurile care nu se potrivesc cu redările salvate deja prin API în aceeași perioadă.
- [x] **Faza 6b: Finisare după feedback.**
  - **Pagina principală:** FAQ cu deschidere animată, animații care pornesc doar când secțiunea e chiar pe ecran, link spre pagina principală în meniul de cont.
  - **Trofee:** insigne-medalie (hexagon bronz/argint/aur, gri când sunt blocate), folosite pe pagina de trofee, pe profil și pe pagina principală.
  - **Dashboard:** carduri cu titlu, iconiță și separatoare. Timpii la „Recently played” se actualizează singuri („3 minutes ago” plus ora). Sync la 45 de secunde și la schimbarea piesei; pagina se reîncarcă singură când apare o redare nouă.
  - **Profil public:** opțiunea „Public” (oricine are link-ul, fără cont). Vizitatorii fără cont văd profilul fără meniul aplicației.
  - **Settings în stilul stats.fm:** meniu pe grupe (Account, Stats and data), titlu mare cu Save sus (activ doar când ai schimbat ceva). Profile are poza de pe Spotify, nume afișat editabil (login-ul nu-l mai suprascrie), link verificat live („Available”/„Taken”), bio și contoare de caractere. Dropdown-uri proprii, cu căutare la fusul orar. Privacy are opțiuni cu iconițe și un switch pentru now playing.
  - **Peste tot:** iconițe rotunde la titlurile de secțiuni și la carduri; paginile apar cu fade, iar listele, barele, graficele și heatmap-ul se animă la încărcare.
  - **Worker:** dacă Spotify limitează căutarea pieselor importate, se oprește doar căutarea, cât cere Spotify. Now playing și salvarea redărilor continuă.
- [x] **Faza 6c: Istoricul importat complet, fără să așteptăm Spotify.**
  - **Motivul:** Spotify a blocat căutările pentru aproape 24 de ore după vreo 650 de cereri în 13 minute (4 noiembrie 2026), deci 8.000 de piese ar fi durat săptămâni. Salvarea redărilor și now playing nu au fost afectate.
  - **Artiști și albume din export:** la import, fiecare piesă e legată imediat de artistul și albumul cu acel nume (`src/lib/import/link.ts`). Dacă nu le știm, se creează rânduri cu `imported`. Când Spotify răspunde pentru o piesă, rândurile `imported` sunt înlocuite de cele reale, păstrând poza, genurile și ce e ascuns. Până atunci, exportul dă doar artistul principal, deci colaborările lipsesc.
  - **Imagini:** de la Deezer, doar după nume, cu potrivire exactă (`src/lib/pictures.ts`). Termenii Deezer cer uz necomercial; de reverificat dacă stats.lk iese vreodată din zona asta.
  - **Spotify:** 5 căutări la 15 minute (circa 480 pe zi), artiștii întâi. Pauza cerută de Spotify se păstrează în bază și peste restarturi.
  - **Bară de progres:** pe `/import` (urcare, apoi coperți și genuri, live) și pe dashboard cât timp mai e de lucru.
  - **Funcții noi:** `/insights/timeline` (anii unul lângă altul și erele tale) și „On this day” pe dashboard.
  - **Next.js:** verificarea „instant navigation” rulează doar pe segmentele care o cer, fiindcă toate paginile logate citesc sesiunea.
- [x] **Faza 6d: Dashboard cu panou lateral.** Ales de tine din 4 variante (Spotlight, Bento, Chapters, Side rail). Now playing, top artiști și redările recente stau pe coloana principală, fără cutii. Tot restul e într-un singur panou lateral, împărțit prin linii: ultimele 7 zile, nivelul, On this day, genurile și scurtăturile. Pe telefon, panoul coboară sub coloana principală.
- [x] **Heatmap cu redările zilei.** Click pe o zi din graficul de pe Activity deschide o fereastră cu tot ce ai ascultat atunci, cu ora și durata. Merge și din tastatură.
- [x] **Discover după import.** Mesajul „Your history here starts…” apare doar cât timp nu ai importat nimic. Spotify nu spune când a fost creat contul, deci importul e semnalul.
- [x] **Teste în proiect.** `npm test` rulează pe baza separată `statslk_test`, cu chei false și fără rețea, deci nu poate atinge datele reale sau serviciile externe.
- [ ] **Faza 7: Deploy** pe `stats.lucariki.top`, pe serverul `srv1` cu ISPConfig și Apache (nu pe Proxmox, cum era planul inițial). Aplicația și Postgres rulează în Docker, ISPConfig face HTTPS și trimite traficul spre `127.0.0.1:3000`. Backup zilnic în `./backups`. Pașii sunt în README, la Production.
  - **Hotărât pe 3 noiembrie 2026: rămânem la 5 useri** (Development Mode). Extended Quota cere firmă înregistrată și minim 250.000 de useri activi pe lună (din mai 2025), iar Developer Policy III.13 interzice metricile derivate. Variantele pentru mai târziu: hibrid cu Last.fm pentru restul userilor sau open source self-hosted.

## Stack

Next.js 16 (App Router, TypeScript, Tailwind) · PostgreSQL 17 · Drizzle ORM · worker Node (tsx) · Docker Compose.
