# rawe_ceek research: data, calendar design, weather, graphics, notifications, Firestore, the champion window, art and the desktop app

Item RW.RESEARCH, researched on 2026-11-26 by John of the Lone Gunmen (Richard did the online research, Melvin the local files, three helpers read web pages), for the item owner M. This is research only: no code was written and no package was installed. Every fact has a source link in its section and is marked VERIFIED (a page or a live request was read on 2026-11-26) or UNVERIFIED (a snippet, a paraphrase or memory). Where something is my own design, my own pick or my own estimate it says so.

## Contents

- Short answer
- Recommendations at a glance
- What is open, and what I did not do
- 1. Data per series: sources, times, results, standings, terms, limits, scraping or AI
- 2. Fields for the calendar, the list and the popup, and how the layout can work
- 3. Live weather for the day popup
- 4. Graphics per round: silhouettes, iconic corners, pictures, flags
- 5. Notifications on the PWA
- 6. Firestore: data model, rules, offline cache, the desktop writer
- 7. The champion window: how Charles Leclerc can still become World Drivers' Champion
- 8. Art sources: liveries, F2 and F3 colours, the helmet, and what you may use
- 9. The desktop app and the Chrome app (the parity standard)
- Questions for you (in the HTML version of this note)


## Short answer

rawe_ceek is feasible, runs inside free tiers and fits the stack you already use (a PWA on pwa-kit, Vercel for `api/`, Firestore, a small local service on your PCs). Seven findings change the plan, and you should read them before the sections:

1. **Leclerc cannot become champion any more.** He has been mathematically out since round 18 (25 October 2026); Antonelli clinched one race later and leads with 402 points to Leclerc's 250 (6th). Two races are left (Qatar on 29 November, Abu Dhabi on 6 December). The best Charles can still reach is third place. The window you asked for must say that honestly, with a "best possible" line and a next-season view (question 7).
2. **Formula 1's own guidelines forbid text and data mining and any AI use of its rights.** I read the clause on the F1 site twice. So the scraping and AI functions of the desktop app must keep AI away from F1 content; the push texts for results come from a fixed template over the numbers. I treat F2, F3 and F1 Academy the same way to be safe (question 1).
3. **No single feed covers the five series.** F1 has two free community APIs (Jolpica, OpenF1); F2, F3 and F1 Academy have no public feed but embed their data in the official pages; the WEC has one calendar file per round plus HTML. All the official sites allow personal, non-commercial use only, which fits a private app and rules out a public one (question 1).
4. **Three time traps.** The Las Vegas F1 race is "Sunday 22 November" in the community API but Saturday evening there; the F1 Academy calendar prints standard-time offsets all year; F2 and F3 round dates can omit the Thursday practice, and F2 Abu Dhabi still shows `00:00` placeholder times. Store UTC plus the circuit's time zone and group by the circuit-local date (question 2).
5. **The day cell you describe does not fit a phone** (a month cell is about 56 px wide). Four layouts are drawn as mockups in section 2 of the HTML version; I recommend the full cell on wide screens and a compact month plus a day card on phones.
6. **Notifications are possible on both phones**, but the free Vercel schedule can make the "1 hour before" reminder arrive 60 to 30 minutes before the session; exact timing needs a Firebase function and a card on file (question 5).
7. **Do not build the Electron desktop app.** Your own apps are moving to "PWA plus a local service", and the parity rule says the Chrome app must act like the desktop app. Two prerequisites exist only on unmerged branches or open items (question 9).

## Recommendations at a glance

| Question | Recommendation | Main alternative |
|---|---|---|
| 1. Data and terms | One source per series (Jolpica, F2 and F3 round pages, F1 Academy page data, WEC calendar files), collected by the local service into Firestore; no AI on F1-group content, templated result texts | OpenF1 for F1 detail; ask the F1 group for a licence only if the app ever goes public |
| 2. Fields and layout | UTC plus IANA zone, circuit-local date as the cell key; layout A on wide screens and D on phones | B (swipeable day columns) or C (weekend card) |
| 3. Weather | Open-Meteo, called from the page itself, 15-minute cache, attribution link | The service writes a snapshot to Firestore; MET Norway as second source |
| 4. Graphics | F1DB silhouettes, flag-icons, Wikimedia Commons photos with a licence record, silhouette alone where there is no photo | Own line drawings for all 30 circuits |
| 5. Notifications | SmakMal's pattern: Web Push, a due table, a Vercel Schedule every 15 minutes, the service as an extra caller | A Firebase scheduled function every 5 minutes (Blaze plan, card) |
| 6. Firestore | One document per series season, owner uid pinned, no client writes on race data, desktop writer with a service account key path in an environment variable | Application default credentials instead of a key file; or public read without sign-in |
| 7. Champion window | Pure function of the standings, three states plus a next-season view, honest "eliminated, third is possible" today | The simple pairwise rule without enumeration |
| 8. Art | Colours, shapes and numbers only, no logos; LEGO Racing #32 for F1 Academy; blue F2, orange F3 | Abstract the cars further before any public release |
| 9. Desktop and Chrome app | PWA plus local service, no Electron, the service under the lease; Gemini at most for WEC and Wikipedia content | The old Electron shape on desktop-kit |

## What is open, and what I did not do

- **Questions for you** are at the end of this page (HTML version): fourteen decisions, each with a recommendation and a free comment, and one field for anything else. Formula 3 appears twice in your request, so I covered five series (F1, F2, F3, F1 Academy, WEC) and ask what you meant.
- **Not tested in a browser:** Open-Meteo from a real page (CORS), push on an iPhone in the EU, the sign-in redirect on an iPhone Home Screen app, the colour values, how any circuit outline looks. Nothing was downloaded or drawn.
- **Not read:** the formula1.com Terms of Use and any public F1 ICS feed; the local service source (`.ts` bodies) on its branches; the hex colours of any livery (they are proposals, UNVERIFIED).
- **My own picks, not facts:** 14 of the 30 iconic corners in question 4, the F2 and F3 colours, the picture strength of 25 to 40 percent, the design rules and the layouts in question 2, the effort figures.
- **Legal readings** of every terms clause are plain-words readings, not legal advice.
- **2027:** no confirmed session times exist yet for any of the five series (the F1 2027 calendar has 24 rounds without times; WEC 2027 has 9 rounds and a Qatar prologue with some sessions "TBC").

## 1. Data per series: sources, times, results, standings, terms, limits, scraping or AI

**Short answer.** No single feed covers the five series, so use one source per series and keep a fallback for each. F1 has two free community APIs (Jolpica and OpenF1). F2, F3 and F1 Academy have no public feed, so read the data that is already embedded in their official pages. The WEC publishes one calendar file per round and plain HTML for the rest. Almost all of it is structured, so plain parsing code does the work; an AI call is needed only in a few small places, and **Formula 1's own guidelines forbid using its rights with AI at all** (see 1.3). Every official site allows personal, non-commercial use only, which fits a private app and rules out a public one. Everything below was fetched on 2026-11-26.

### 1.1 The recommended source per series

| Series | Calendar with session times | Results | Standings | Fallback | How often |
|---|---|---|---|---|---|
| F1 | OpenF1 sessions (UTC plus offset); Jolpica schedule as the cross-check | Jolpica | Jolpica | The other of the two; formula1.com racing pages for dates only | Calendar once a day; results every 5 minutes for 3 hours after the race ends; standings once after results |
| F2 | fiaformula2.com round page, embedded JSON (local time, offset, IANA zone) | Same JSON, `results[]` | Standings page, HTML table | The F1 schedule of the same weekend, for dates only | Calendar once a day; on a session day every 5 minutes; results every 5 minutes for 30 minutes after each session |
| F3 | fiaformula3.com, same as F2 | Same | Same | Same | Same |
| F1 Academy | f1academy.com calendar page, the `__NEXT_DATA__` JSON in the HTML | Results page, same JSON | Standings page, same JSON | F1 weekend dates; recompute offsets from our own zone table | Same as F2 (the site caches for only 5 seconds) |
| WEC | fiawec.com, one ICS file per round (plus epoch times in the race page) | `resultats-1` page, HTML, latest race only | `manufacturers-classification` page, HTML | Wikipedia for the round list and results | Calendar once a day; hourly; every 5 minutes for an hour after a race finishes |

The same table, with the reasoning, was compiled by Richard (online research) in `RW-richard.md`, section Q1.6. The cadence figures are my recommendation, set well inside the limits each source states.

### 1.2 Rules that apply to every series

These are my rules, drawn from the findings below.

1. **Store UTC plus the circuit's IANA time zone.** Compute the local clock and the viewer's clock from those two, never from a stored offset (details in question 2).
2. **Keep our own table of IANA zones per circuit.** F1 Academy prints wrong summer offsets (1.5), the F2 and F3 sites are right, the WEC ICS has no zone definition (1.6), and Jolpica gives UTC only (1.3).
3. **Persist every result when it appears.** The WEC site keeps only the latest race in its page, and F2 and F3 round pages may change after the season.
4. **Send a descriptive User-Agent** with a contact, and respect the cache headers (F2 and F3 five minutes, WEC two minutes, Jolpica ten minutes). Polling faster than the cache only adds load.
5. **Validate the shape of every response** against a schema, and raise an alert when it changes. Four of the five sources are scraped, so a redesign is the main risk.
6. **Keep the data private.** Firestore holds the user's own copy with owner-only read (question 6). Do not publish it or expose it to other users.
7. **Show the source and the fetch time** in the app (question 2).

### 1.3 Formula 1

**Best source.** Two free APIs, used together.

- **Jolpica-F1**, `https://api.jolpi.ca/ergast/f1/` (Ergast successor, same JSON shape): schedule, results (`/results`, `/sprint`, `/qualifying`) and standings (`/driverstandings`, `/constructorstandings`). Source: [Jolpica repository](https://github.com/jolpica/jolpica-f1).
- **OpenF1**, `https://api.openf1.org/v1/`: sessions in UTC with `gmt_offset` and an `is_cancelled` flag, plus `session_result` and `championship_drivers` as a fallback. Source: [OpenF1 docs](https://openf1.org/docs/).

Why both: Jolpica is simple and stable but gives UTC only. OpenF1 is the only free source with the time-zone offset and a cancelled flag, which mattered in 2026 (see below).

**Times.**

- Jolpica gives each session as UTC, for example `{"date":"2026-11-27","time":"13:30:00Z"}`, plus the circuit's latitude and longitude. No local offset. Source: the Jolpica schedule `https://api.jolpi.ca/ergast/f1/2026.json` (fetched 2026-11-26).
- OpenF1 gives `date_start` in UTC and `gmt_offset` as a fixed offset (for Qatar `03:00:00`). Source: `https://api.openf1.org/v1/sessions?meeting_key=1301` (fetched 2026-11-26).
- **Date trap.** Jolpica lists Las Vegas round 21 as `"date":"2026-11-22","time":"04:00:00Z"`. That is Saturday 21 November at 20:00 local time (UTC-8), not Sunday 22. Always convert from the UTC timestamp; never trust the `date` field as the local day. Source: same schedule file.

**Terms and limits.**

| Point | Jolpica | OpenF1 |
|---|---|---|
| Licence and use | Data under CC BY-NC-SA 4.0, "freely available for non-commercial use"; commercial use by arrangement with admin@jolpi.ca. [TERMS.md](https://raw.githubusercontent.com/jolpica/jolpica-f1/main/TERMS.md), updated 2025-08-27 | "Intended for educational purposes, personal learning projects, research, and non-commercial fan engagement." [openf1.org](https://openf1.org/) |
| Free tier | Free, no key | Historical data from 2023 is free without a key; real-time data needs a paid subscription (about EUR 9.90 a month, price not re-checked) |
| Rate limit | 4 requests per second burst, 500 per hour sustained; HTTP 429 beyond that; "will decrease" in future. [rate_limits.md](https://github.com/jolpica/jolpica-f1/blob/main/docs/rate_limits.md) | 3 requests per second and 30 per minute on the free tier. [openf1.org](https://openf1.org/) |
| Cache | `Cache-Control: max-age=600` | Not noted |
| robots.txt | `Allow: /`, with `Content-Signal: search=yes,ai-train=no,use=reference`. [robots.txt](https://api.jolpi.ca/robots.txt) | The URL returns a 404 page, so no declared rules. [robots.txt](https://openf1.org/robots.txt) |
| Trade marks | Not stated | "OpenF1 is an unofficial project and is not associated in any way with the Formula 1 companies." |

- Jolpica's ShareAlike clause means: show the credit "Data: Jolpica-F1 (CC BY-NC-SA 4.0)", and do not republish the data as a public dataset.
- Jolpica's robots file names AI training crawlers (ClaudeBot, GPTBot, CCBot and others) as disallowed, and its signal says AI training is off. Calling the API as a normal client is not crawling, but this is a second reason not to feed its content into AI (below).
- OpenF1's `circuit_image` and `country_flag` fields point to PNG files on `media.formula1.com`. Those are Formula 1's files with no licence stated: do not copy them (see question 4).

**Cadence (my recommendation, inside 500 an hour).** Calendar: one Jolpica call a day (`/2026.json`) and two OpenF1 calls (meetings and sessions; the sessions answer for a whole year is about 190 KB, so filter by `meeting_key`). Race day: poll `/current/last/results.json` every 5 minutes from the scheduled end, for at most 3 hours (36 calls), and stop when the new result appears. Standings: one call after the results. Sprints: `/current/last/sprint.json`.

**Sample, schedule round** (trimmed, Jolpica, round 22):

```json
{"round":"22","raceName":"Qatar Grand Prix","Circuit":{"circuitId":"losail","Location":{"lat":"25.49","long":"51.4542","locality":"Lusail","country":"Qatar"}},"date":"2026-11-29","time":"16:00:00Z","FirstPractice":{"date":"2026-11-27","time":"13:30:00Z"},"Qualifying":{"date":"2026-11-28","time":"18:00:00Z"}}
```

**Sample, session with offset** (trimmed, OpenF1):

```json
{"session_name":"Practice 1","date_start":"2026-11-27T13:30:00+00:00","circuit_short_name":"Lusail","country_code":"QAT","gmt_offset":"03:00:00","year":2026,"is_cancelled":false}
```

**The official site, formula1.com.** Its robots.txt allows everything except `/en/latest/tags/*`. [robots.txt](https://www.formula1.com/robots.txt) Its Terms of Use were NOT read, and I did not check for public ICS feeds. Use the site only for the 2027 calendar and as a date cross-check.

**The AI clause (found and read on 2026-11-26).** Formula 1's fan guidelines say, under the heading "Artificial Intelligence":

> The FORMULA 1 Rights cannot be used for text and data mining and in or with any artificial intelligence technology, including in connection with training; development; or operation of large language models or other generative artificial intelligence models, tools or systems without an express licence from the Formula 1 companies.

The same page defines "the FORMULA 1 Rights" as "Our Marks and Other Intellectual Property Rights collectively", and limits "educational" use of the other rights to "a private, educational purpose only", not websites or social media. Source: [formula1.com fan guidelines](https://www.formula1.com/en/toolbar/guidelines.html). The licence enquiry address on the page is brandprotection@f1.com. The F1 results and timing data are also stated as the property of Formula One World Championship Limited in the F1 app terms (found by the web helper, see question 8).

**The data clause (same page, read by me on 2026-11-26).** Under "Timing Data": "Our Statistics, Results and Timing Data is protected by copyright and database rights. Individual pieces of the data can be used incidentally within editorial material to genuinely inform but substantial pieces of the data may not be reproduced or used commercially through scraping or any other means." The sentence does not say whether "commercially" applies to "reproduced" as well. My reading: a private calendar that keeps the schedule and shows one session's result is a small, non-commercial use; copying whole results tables and standings into a store others could read is the grey area. That is one reason the Firestore store stays private (question 6).

What this means for the app, in my reading (not legal advice):

- Do not send formula1.com pages, F1 timing data or F1 results text to an AI model, and do not use them to train or tune anything.
- Whether a plain-data lookup counts as "text and data mining" is unclear. Numbers fetched from Jolpica and shown as they are need no AI at all.
- The clause is on the F1 page. The F2, F3 and F1 Academy sites belong to the same group and carry the same personal-use terms, but I did not find the AI clause on their own pages, so I treat them the same way to be safe.
- Result summaries ("Antonelli won from pole") can be built from a fixed template over the numbers, with no AI. That is my recommendation. An AI-written summary over Jolpica's JSON is a grey area (question for you, see the form).

**2026 calendar changes the app must handle** (Jolpica, OpenF1 and Wikipedia, fetched 2026-11-26):

- The calendar has 23 rounds. The April Bahrain and Saudi Arabian rounds did not run (OpenF1 marks them `is_cancelled: true`).
- The "Bahrain Grand Prix" ran at Sepang (Kuala Lumpur) as round 16 on 4 October. Wikipedia attributes the changes to the 2026 Iran war. Source: [2026 Formula One World Championship](https://en.wikipedia.org/wiki/2026_Formula_One_World_Championship).
- Sprints in 2026 were at rounds 2, 4, 5, 9, 12 and 17.
- Two rounds are left: Qatar (race Sunday 29 November 16:00Z) and Abu Dhabi (race Sunday 6 December 13:00Z). No sprints.

**2027.** Jolpica `/2027.json` returns `"total":"0"`, so there is no schedule there yet. The official F1 page lists 24 rounds from Bahrain (race 14 March) to Abu Dhabi (finale 12 December), with 10 sprints (Bahrain, Australia, Japan, Canada, Monaco, Britain, Italy, Sao Paulo, Qatar, Abu Dhabi). Sources: [formula1.com racing 2027](https://www.formula1.com/en/racing/2027) and [Wikipedia](https://en.wikipedia.org/wiki/2027_Formula_One_World_Championship). Session times are not published anywhere I read. Changes against 2026: no Dutch GP, Barcelona out and Belgium in, Portugal and Turkey return, Bahrain and Saudi return.

### 1.4 Formula 2 and Formula 3

**Best source: the official sites, read as pages.** There is no public API and no ICS. Both sites run on the same platform (server-rendered Next.js).

- Round page: `https://www.fiaformula2.com/en/racing/2026/{slug}` (F3 on `fiaformula3.com`). The page embeds a `meetingSessions` JSON array inside the Next.js data chunks (`self.__next_f.push`).
- F2 slugs (14): melbourne, miami-gardens, montreal, monte-carlo, barcelona, spielberg, silverstone, spa-francorchamps, budapest, monza, madrid, baku, lusail, yas-marina. F3 slugs (9): melbourne, monte-carlo, barcelona, spielberg, silverstone, spa-francorchamps, budapest, monza, madrid.
- Standings: `/en/standings/2026/drivers` and a `/teams` sibling, as HTML tables.
- The pages also call `api.formula1.com` with a private key. **Do not use that API.**

**Times.** Each session carries `startTime` (**local clock, no offset**), `endTime`, `gmtOffset` (for example `+03:00`), `timezone` (an IANA name such as `Asia/Qatar`), `state`, `shortName`, `meetingSessionKey` and, when finished, `results[]`. UTC is `startTime` minus `gmtOffset`. The offsets include daylight saving correctly (Monaco shows +02:00 in June). The meeting fields include `meetingNumber`, which equals the F1 round number, `meetingCode`, `meetingStartDate`, `meetingEndDate`, `circuitOfficialName` and `meetingTimezone`.

**Sample** (trimmed, F2 Lusail sprint, re-fetched by Richard and checked against the Qatar F1 weekend):

```json
{"session":"Race 1","shortName":"Sprint Race","startTime":"2026-11-28T19:15:00","endTime":"2026-11-28T20:05:00","gmtOffset":"+03:00","sessionType":"Race","state":"upcoming","meetingSessionKey":11645,"timezone":"Asia/Qatar"}
```

That sprint is 16:15Z. The F2 feature race is 15:00 local on 29 November, which is 12:00Z. Source: [F2 Lusail round page](https://www.fiaformula2.com/en/racing/2026/lusail).

**Traps.**

- `meetingStartDate` can omit a Thursday practice. At Monaco the F2 and F3 practice is Thursday 4 June but `meetingStartDate` says 2026-06-05. Group by the session dates, not by the meeting dates. Source: [F2 Monaco page](https://www.fiaformula2.com/en/racing/2026/monte-carlo) and [F3 Monaco page](https://www.fiaformula3.com/en/racing/2026/monte-carlo).
- F2 Abu Dhabi had `00:00` placeholder times on 2026-11-26. Refetch it daily, and show "time to be confirmed" until it changes. Source: [F2 Yas Marina page](https://www.fiaformula2.com/en/racing/2026/yas-marina).
- The 2026 sites list no Sakhir or Jeddah round for either series. I did not find why.

**Terms, robots, limits.**

- Terms (read by Richard, clause "Intellectual property rights"): "The material and content provided on this Site is for your personal, non-commercial use only (save where expressly provided) and you agree not for yourself or through or by way of assistance from any third party to distribute, copy, extract or commercially exploit such material or content." Source: [F2 terms](https://www.fiaformula2.com/en/information/terms-and-conditions.6XzLrOyLLmDREjs3oMriKp). The F3 and F1 Academy footers carry the same clause (checked by the helper, not re-read by me). There is no wording about robots or scraping.
- The word "extract" is the risk word. A private app that reads the pages for the owner's own display is arguably personal use, but it is a grey area, so the question is yours (see the form). This is my plain reading, not legal advice.
- robots.txt and the sitemap return HTTP 404, so no declared rules. [F2 robots.txt](https://www.fiaformula2.com/robots.txt)
- No rate limit is stated. The page cache is `public, max-age=300`. The helper made about 17 requests one second apart (F2) and 11 (F3), all HTTP 200.

### 1.5 F1 Academy

**Best source: the official site, reading the `__NEXT_DATA__` JSON inside each HTML page** (`props.pageProps.pageData`). It is clean JSON with ISO times.

- Calendar: `https://www.f1academy.com/Racing-Series/Calendar` (SeasonId 4 is 2026, 3 is 2025, 2 is 2024, 1 is 2023; no 2027 id yet).
- Results: `/Racing-Series/Results?raceid=N` (2026 RaceIds 22, 24, 25, 26, 27 and 28). Standings: `/Racing-Series/Standings/Driver` and `/Team` (row shape not inspected).
- **robots.txt disallows `/_next/*`** (and allows `/_next/static/*`). Therefore read the JSON out of the HTML page, and **do not** call the `/_next/data/...json` routes. [robots.txt](https://www.f1academy.com/robots.txt)
- Terms: the same personal, non-commercial clause as F2. The cache is `public,max-age=5`, and no rate limit is stated.

**Sample** (trimmed, round 1):

```json
{"RaceId":22,"RoundNumber":1,"RaceStartDate":"2026-03-13","CircuitName":"Shanghai International Circuit","State":"POST-RACE","Sessions":[{"SessionCode":"PRACTICE","SessionName":"Free Practice","SessionStartTime":"2026-03-13T09:10:00+08:00","Unconfirmed":false}]}
```

**The offset bug (verified in the JSON by Richard).** `SessionStartTime` carries the **standard-time** offset all year, so summer sessions are wrong by one hour if you trust the offset:

| Round | Printed | Real local offset that day |
|---|---|---|
| Montreal, 22 May | -05:00 | -04:00 |
| Silverstone, 3 July | +00:00 | +01:00 |
| Zandvoort, 21 August | +01:00 | +02:00 |
| Austin, 22 October | -06:00 | -05:00 |

Shanghai (+08:00, no daylight saving) and Las Vegas (-08:00, standard time in November) are right. Recommendation: take the local clock text and our own IANA zone for the circuit, and ignore the printed offset. It is unconfirmed whether the clock text itself is right (not compared with what the site displays), so cross-check against the F2 or F3 session times of the same weekend, which carry correct offsets: if they differ by exactly one hour, the offset is wrong, not the clock. This is a place where an AI check would help, but see 1.3 for the limit.

**2026 and 2027.** Six rounds in 2026, all on F1 weekends. For 2027 the series announced seven rounds on 2026-11-10 (dates only). Source: [formula1.com article](https://www.formula1.com/en/latest/article/f1-academy-unveils-calendar-for-2027-season.1mYuyMEiCaWyI8pAfg5K0O) (title "F1 ACADEMY unveils calendar for 2027 season", read by the helper).

### 1.6 FIA WEC

**Best source: the official site, one ICS file per round plus HTML.** There is no public JSON API (the helper searched the page code).

- Season pages: `https://www.fiawec.com/en/season/2026` and `/en/season/2027`.
- **ICS per round**: `https://www.fiawec.com/en/race/calendar/<raceId>`. Each session is an event, for example `SUMMARY:6 Hours of Monza - Free Practice 1` with `DTSTART;TZID=Europe/Rome:20261106T103000`. The file has `TZID` local times **with no VTIMEZONE block**, so the parser must know the zone; Le Mans uses UTC (`Z`); Spa uses `Europe/Paris`. Source: [Monza ICS](https://www.fiawec.com/en/race/calendar/5066) (read by Richard).
- Fallback for times: the race page `https://www.fiawec.com/en/race/<slug>` carries `data-timestamp` epochs (UTC). The `ld+json` `subEvent` dates there are placeholders: do not use them.
- 2026 raceIds: Imola prologue 5042, Imola 4948, Spa 4949, Le Mans 4951, Sao Paulo 4952, COTA 4953, Fuji 4954, Barcelona 5065, Monza 5066. 2027 raceIds seen: Qatar 5043, Imola 5044, Spa 5045, Fuji 5046, COTA 5047, Bahrain 5048, Sao Paulo 5049, Le Mans 5051, Silverstone 5055. **The 2027 ICS files return 404** (ids 5043 and 5044 tried): session times are not published yet.
- Standings: `https://www.fiawec.com/en/page/manufacturers-classification?season_id=4175` (2026; 2025 is 4172), HTML tables.
- Results: `https://www.fiawec.com/en/page/resultats-1`. **Only the latest race is in the page.** Older races need a POST to a Symfony live component, which is brittle, so save each result right after the race.
- The timing site `fiawec.alkamelsystems.com` is behind a Cloudflare Turnstile check (not bypassed; do not use). `plus.fiawec.com` is a React page with no usable data.

**Terms, robots, limits.**

- Terms, section "Copyright" (read by Richard): "This website and all its contents, including texts, images, videos and databases are protected by copyright. Le Mans Endurance Management only gives permission to view the content for personal and private use to the extent that you are the legitimate end user of the website, and specifically excludes use for any public display or distribution." Source: [legal notice](https://www.fiawec.com/en/page/mentions-legales-1). There is no explicit scraping clause. Treat it as personal use only, with no republishing.
- robots.txt: `User-agent: *`, `Allow: /`, no Disallow, no crawl delay. [robots.txt](https://www.fiawec.com/robots.txt)
- No rate limit is stated or seen (about 40 requests by the helper, no 429). `Cache-Control: max-age=120`, `Access-Control-Allow-Origin: *`. Plain HTTP works with no bot wall.
- The WEC is run by Le Mans Endurance Management, not the Formula 1 group, so the F1 AI clause does not apply to it by its words (my reading).

**2026 is finished.** Eight rounds plus the Imola prologue; the last round was the 6 Hours of Monza on Sunday 8 November (race 11:00 local, 10:00Z). Qatar and Bahrain were cancelled and replaced by Barcelona (18 October) and Monza (8 November); Wikipedia gives the Iran war as the reason. Toyota won the manufacturers' title (215 points) and the #8 Toyota crew the drivers' title (115); Ferrari finished third with 150 points. At Monza the #38 Cadillac won, the #51 Ferrari was third and the #50 Ferrari ninth. Sources: [2026 FIA WEC](https://en.wikipedia.org/wiki/2026_FIA_World_Endurance_Championship) and the fiawec.com standings above (read by the helper). So there is no WEC event before the 2027 opener.

**2027 is published.** Nine rounds plus a Qatar prologue (21-22 March, Wikipedia only), announced 2026-06-12: Qatar 1812km, Imola, Silverstone, Spa, Le Mans, Sao Paulo, COTA, Fuji, Bahrain. Source: [fiawec.com news](https://www.fiawec.com/en/news/fia-wec-reveals-nine-round-2027-calendar-as-series-expands/13598) and [Wikipedia](https://en.wikipedia.org/wiki/2027_FIA_World_Endurance_Championship). Race starts are known only for rounds 1 to 5, as the helper read them:

| Round | Race start (local) | UTC |
|---|---|---|
| Qatar, Sat 27 Mar | 13:00 (UTC+3) | 10:00Z |
| Imola, Sun 11 Apr | 13:00 (UTC+2) | 11:00Z |
| Silverstone, Sun 25 Apr | 13:00 (UTC+1) | 12:00Z |
| Spa, Sat 15 May | 14:00 (UTC+2) | 12:00Z |
| Le Mans, 12-13 Jun | 16:00 (UTC+2) | 14:00Z |

All other 2027 sessions are "to be confirmed". Support series on WEC weekends (Le Mans Cup, Radical Cup) are not needed for the five series and were not verified.

### 1.7 Which F2, F3 and F1 Academy rounds share an F1 weekend

**Every F2, F3 and F1 Academy round in 2026 and in the announced 2027 calendars runs on an F1 weekend** (same circuit, same dates). None is standalone. The 2026 and 2027 F1 dates come from [formula1.com racing 2026](https://www.formula1.com/en/racing/2026) and [racing 2027](https://www.formula1.com/en/racing/2027); the series dates from each series' round pages and 2027 announcements. The 2027 F2 and F3 table is from [RacingNews365](https://racingnews365.com/f2-and-f3-unveil-2027-calendars-racing-across-four-continents), dated 2026-10-05 in the source I saw (read by the helper).

**2026** (F2 has 14 rounds, F3 has 9, F1 Academy has 6; dates are race weekends):

| F1 round | Grand Prix, circuit | Dates | F2 | F3 | F1 Academy |
|---|---|---|---|---|---|
| 1 | Australia, Albert Park | 6-8 Mar | yes | yes | |
| 2 | China, Shanghai | 13-15 Mar | | | yes (round 1) |
| 3 | Japan, Suzuka | 27-29 Mar | | | |
| 4 | Miami | 1-3 May | yes | | |
| 5 | Canada, Montreal | 22-24 May | yes | | yes (round 2) |
| 6 | Monaco | 5-7 Jun (F2 and F3 start Thu 4 Jun) | yes | yes | |
| 7 | Spain, Barcelona | 12-14 Jun | yes | yes | |
| 8 | Austria, Red Bull Ring | 26-28 Jun | yes | yes | |
| 9 | Britain, Silverstone | 3-5 Jul | yes | yes | yes (round 3) |
| 10 | Belgium, Spa | 17-19 Jul | yes | yes | |
| 11 | Hungary | 24-26 Jul | yes | yes | |
| 12 | Netherlands, Zandvoort | 21-23 Aug | | | yes (round 4) |
| 13 | Italy, Monza | 4-6 Sep | yes | yes | |
| 14 | Spain, Madrid | 11-13 Sep | yes | yes (last F3 round) | |
| 15 | Azerbaijan, Baku | 24-26 Sep | yes | | |
| 16 | Bahrain GP at Sepang | 2-4 Oct | | | |
| 17 | Singapore | 9-11 Oct | | | |
| 18 | USA, COTA | 23-25 Oct | | | yes (round 5, starts Thu 22 Oct) |
| 19 | Mexico City | 30 Oct-1 Nov | | | |
| 20 | Brazil, Sao Paulo | 6-8 Nov | | | |
| 21 | Las Vegas | 19-21 Nov | | | yes (round 6) |
| 22 | Qatar, Lusail | 27-29 Nov | yes | | |
| 23 | Abu Dhabi, Yas Marina | 4-6 Dec | yes | | |

F1 weekends with none of the three: rounds 3, 16, 17, 19 and 20. For today (2026-11-26) what is left is F1 Qatar and Abu Dhabi and F2 Qatar and Abu Dhabi. F3, F1 Academy and WEC are over for 2026.

**2027** (F2 has 14 rounds, F3 has 10, F1 Academy has 7; dates only, no session times):

| F1 round | Grand Prix, circuit | Dates | F2 | F3 | F1 Academy |
|---|---|---|---|---|---|
| 1 | Bahrain | 12-14 Mar | yes | yes | |
| 2 | Saudi Arabia, Jeddah | 19-21 Mar | yes | yes | yes |
| 3 | Australia | 2-4 Apr | yes | yes | |
| 4 | Japan | 9-11 Apr | | | |
| 5 | China | 16-18 Apr | | | yes |
| 6 | Miami | 30 Apr-2 May | | | |
| 7 | Canada | 21-23 May (F2 and F3 "subject to contract", from Thu 20 May) | yes | yes | yes |
| 8 | Monaco | 4-6 Jun (F2 and F3 from Thu 3 Jun) | yes | yes | |
| 9 | Portugal, Portimao | 18-20 Jun | | | |
| 10 | Britain, Silverstone | 2-4 Jul | yes | yes | yes |
| 11 | Austria | 9-11 Jul | yes | yes | |
| 12 | Belgium, Spa | 23-25 Jul | | | |
| 13 | Hungary | 30 Jul-1 Aug | | | yes (first time) |
| 14 | Italy, Monza | 3-5 Sep | yes | yes | |
| 15 | Spain, Madrid | 10-12 Sep | yes | yes | |
| 16 | Azerbaijan | 24-26 Sep | yes | | |
| 17 | Turkey, Istanbul | 1-3 Oct (F2 and F3 "subject to FIA circuit homologation") | yes | yes (finale) | |
| 18 | Singapore | 8-10 Oct | | | |
| 19 | USA, COTA | 22-24 Oct | | | yes |
| 20 | Mexico City | 29-31 Oct | yes | | |
| 21 | Brazil | 5-7 Nov | | | |
| 22 | Las Vegas | 18-20 Nov | | | yes |
| 23 | Qatar | 3-5 Dec | yes | | |
| 24 | Abu Dhabi | 10-12 Dec | yes | | |

The official sites have no 2027 page yet (`/en/racing/2027` on the F2 and F3 sites returns HTTP 500), and the F2 and F3 2027 calendars omit Spa, Budapest, Barcelona and Miami.

**WEC.** No WEC round shares a circuit and weekend with an F1 round, in 2026 or 2027. Some only clash by date with an F1 round elsewhere, which matters for a fan who follows both:

- 2026: Le Mans (10-14 Jun) with F1 Barcelona (14 Jun); COTA (4-6 Sep) with F1 Monza (6 Sep); Fuji (25-27 Sep) with F1 Baku (26 Sep); Monza (6-8 Nov) with F1 Sao Paulo (8 Nov). Imola, Spa, Sao Paulo and Barcelona do not clash.
- 2027: Imola (9-11 Apr) with F1 Japan; Sao Paulo (9-11 Jul) with F1 Austria; COTA (10-12 Sep) with F1 Madrid; Fuji (24-26 Sep) with F1 Baku; Bahrain (4-6 Nov) with F1 Sao Paulo. Qatar (25-27 Mar), Silverstone (23-25 Apr) and the Le Mans race weekend (12-13 Jun) are free.

For the app: the calendar can mark "same weekend as F1" for F2, F3 and F1 Academy and link the days, but a WEC day needs no link.

### 1.8 What needs scraping, and where an AI call helps

**Plain parsing code, no AI** (structured data, with a schema check and an alert): F2 and F3 `meetingSessions` JSON, F1 Academy `__NEXT_DATA__`, WEC ICS, and both F1 APIs.

**Where an AI call could help, and the limit on each:**

| Task | Needs AI? | Limit |
|---|---|---|
| WEC results and standings HTML when the layout shifts | Maybe | The WEC is not an F1-group series, so the F1 clause does not apply by its words. Use code first, AI only as a repair step |
| 2027 calendars for F2, F3 and F1 Academy (articles and tables) | One-off parse | The F2 and F3 table is on RacingNews365, a third-party site. Their terms were not read. The official F1 articles fall under the F1 clause, so prefer the third-party table |
| F1 Academy offset check | No | A deterministic comparison with the F2 or F3 times of the same weekend does it |
| Result summaries | No | Use a fixed template over the numbers (1.3) |
| 2027 session times as they appear (all series) | No | Same parsers, run daily |

The upshot: **the AI functions your other apps have are not needed for data collection in this app.** Nothing mandatory requires AI. If you still want AI in the desktop service, the safest use is on the WEC pages and on Wikipedia, and never on F1-group content.

### 1.9 Recommendation

1. Use the sources in 1.1. Plain parsing code for all five, with a schema check and a fallback each.
2. Run the collection in the local service on your PC (question 9), write the result to Firestore, and let the phone read only Firestore (question 6). Then the phone never touches the official sites, and the "personal use" reading stays intact.
3. Do **not** use AI on Formula 1 content (1.3). Build result summaries from a template.
4. Use the F1 page's unofficial line, "This website is unofficial and is not associated in any way with the Formula 1 companies," and show the Jolpica credit (question 8 covers the credits).
5. Ask the F1 group for a licence only if you ever want the app to leave private use. Contacts named in the terms: general@en.formula1.com (the F2 terms) and brandprotection@f1.com (the F1 guidelines).

### 1.10 Not verified

- The formula1.com Terms of Use and any public F1 ICS feed were not checked.
- OpenF1 2027 data, and any formal OpenF1 terms page (the `/terms` address returns 404; the terms are the FAQ text only). The paid tier price (EUR 9.90 a month) was read but not re-checked.
- Whether the F1 AI clause is meant to reach plain numbers fetched from a community API. My reading is unclear, so I ask you.
- The AI clause on the F2, F3 and F1 Academy pages: not found, and not looked for on every page.
- F3 standings content, the F1 Academy standings and results row shape, the F1 Academy 2027 article (all read by the helper only), and the WEC results POST route.
- F1 Academy: whether the printed clock time is right (only the offset was shown wrong).
- The legal readings of every terms clause are plain-words readings, not legal advice.
- No 2027 session times exist for any of the five series yet; F2 Abu Dhabi 2026 has `00:00` placeholders.

## 2. Fields for the calendar, the list and the popup, and how the layout can work

This section is my own design work on top of the data found in question 1. The field names, the rules and the four layouts are proposals (labelled "my design"); the example times are real, from the sources named under each example. The design principles are mine and have no outside source.

### 2.1 What you asked for, as a checklist

- **Calendar view, one day cell** (series chosen in the hamburger menu): the flag, the city, the country and the race name; as background a track silhouette with an opaque picture of an iconic corner; bottom-left the list of that day's sessions, each with a results button; a click on the day opens a detail popup with live weather.
- **Chronological list view:** the first tile of a weekend has the track layout, the flag, the city, the country and the race name; then one tile per event day.
- Both views for five series (F1, F2, F3, F1 Academy, FIA WEC); F3 was named twice in the request, see the questions.

### 2.2 The fields (my design; the source of each is in question 1)

**Weekend** (one per round and series):

| Field | Example (F1, Qatar) | Used in |
|---|---|---|
| series, season, round | f1, 2026, 22 | filter, list tile |
| name | Qatar Grand Prix | cell, first list tile, popup |
| circuitName | Lusail International Circuit | popup, art lookup |
| city, country | Lusail, Qatar | cell, list tile |
| countryCode (ISO 3166-1 alpha-2) | QA | flag |
| timeZone (IANA) | Asia/Qatar | every local time |
| lat, long | 25.49, 51.4542 | live weather |
| startDate, endDate (circuit-local dates) | 2026-11-27 to 2026-11-29 | which cells the weekend fills |
| status | scheduled, live, completed, cancelled, moved | badge; OpenF1 has an `is_cancelled` flag |
| sharedWith | f2 round 13 | popup line "also this weekend" |
| artKeys | silhouette id, corner id | background (question 4) |
| source (name, url, fetchedAt) | Jolpica, 2026-11-26 | the "last updated" and source line |

**Session** (3 to 12 per weekend):

| Field | Example | Note |
|---|---|---|
| kind | practice, qualifying, sprint-qualifying, sprint, race, hyperpole | one set for all series so the app can colour and sort |
| name | "Practice 1", "Sprint Race", "Qualifying - LMGT3" | as the source prints it |
| class | hypercar, lmgt3, lmp2, none | WEC only (qualifying and hyperpole are per class) |
| startUtc | 2026-11-27T13:30:00Z | the one stored instant; local and viewer times are computed |
| endUtc | nullable | Jolpica gives no end time; OpenF1, F2, F3, F1 Academy and the WEC calendar file do |
| localDate | 2026-11-27 | circuit-local date, used to put the session in a cell |
| timeConfidence | confirmed, placeholder, tbc | F2 Yas Marina shows 00:00 placeholders today; WEC 2027 has "TBC" sessions |
| status | upcoming, live, completed, cancelled | |
| resultsState | none, pending, provisional, final | drives the results button |

**Result** (per session, only when a source has one): state (provisional or final), fetchedAt, and rows with position, car number, driver code and name, team, time or gap or status, points (and laps and class for WEC). Store the top 10 plus the followed driver or car. The F1 and F2 rows exist in the sources named in question 1; practice sessions often have no result source, and then the button is simply not shown.

**Live, never stored:** weather (question 3). **Static art per circuit:** flag, silhouette, corner picture and its credit line (question 4).

### 2.3 Rules the views should follow (my design)

1. **Group by the circuit-local date.** F1 Academy in Las Vegas runs Thursday 18:00 local, which is Friday 03:00 in Central Europe. The cell is the Thursday of the race weekend. The Jolpica Las Vegas date trap (a "Sunday 22 Nov" race that is Saturday evening local) is the same problem for F1.
2. **Show the viewer's own time as the main clock**, with the circuit-local time next to it, and a "+1d" tag when the viewer's date differs from the circuit's date. Never show only the circuit time.
3. **Compute, do not store, the local and viewer times.** Store UTC and the IANA zone. Do not trust the printed offset in the F1 Academy calendar (it shows standard time all year: Silverstone in July prints +00:00 and COTA in October prints -06:00, where summer time applies; see question 1). F2 and F3 offsets are correct.
4. **Results button states:** hidden (no source), "not yet" (grey, session not finished), "pending" (finished, nothing published), "provisional" (shown, tagged), "final". An optional "hide results until I tap" switch protects spoilers (my idea, not asked for).
5. **Follow list:** highlight Leclerc and #16 in F1, the Ferrari #50 and #51 in the WEC, and the F1 Academy driver of the lego team (question 8), in results and in the cell.
6. **Always print a "last updated" time and the source name** in the popup, so a stale number is visible. The F1 Academy and F2 pages cache for 5 seconds and 5 minutes, WEC for 2 minutes (question 1), so more frequent polling gains nothing.
7. **WEC classes:** qualifying and hyperpole exist once per class. Default to Hypercar only (your request names the 499P), with a switch for LMGT3.

### 2.4 Does the day cell fit? Four layouts

The cell you describe holds a flag, three text lines, a background picture and up to five session rows with a button each (the WEC Saturday has five sessions with all classes, three with Hypercar only; an F1 Friday has two). On a phone a seven-column month cell is 390 / 7 = about 56 px wide, about 50 px after the borders. A line such as "Qatar Grand Prix" needs about 85 px at 11 px type (my estimate), and "Qualifying 19:00" plus a button needs more. So on a phone the literal cell cannot carry the content; on a desktop (a cell of 150 px or more) it can. Four ways to deal with that, drawn as live mockups in the HTML version of this note (the real Qatar times from question 1, the weather and art are placeholders):

| Layout | How it works | Good | Weak |
|---|---|---|---|
| A. Full cells | A month grid; each race-weekend day cell carries everything you listed | exactly your description | needs a wide screen (about 1000 px and more); unusable on a phone |
| B. Day columns | A week strip with day columns 150 px wide that you swipe sideways; about two and a half columns show on a phone | every day shows everything, also on a phone | not a month overview; more swiping |
| C. Weekend card under a week strip | A thin week strip of date numbers, and under it one card per race weekend with the header once and a column per day | the header is not repeated three times; fits a phone | it is no longer a month grid of equal cells |
| D. Compact month plus a day card | The month grid shows only the flag and dots for the sessions; the selected day opens as a large card under the grid (silhouette, corner picture, flag, text, sessions); the popup with weather opens from the card | the best overview and phone fit | one extra tap before the content shows |

#### Mockups of the four layouts, the popup and the list

(The four layouts, the detail popup and the chronological list are drawn as live mockups in RW.RESEARCH.html, next to this file. The table above describes them.)

The chronological list view needs no such compromise: each tile is a full-width block, as you described (first tile with the layout, flag, city, country and race name; then a tile per day). The detail popup shows the weekend header, the sessions as a table (circuit-local, viewer time, results button), the live weather, the "also this weekend" line, and the last-updated and source line.

### 2.5 One worked example per series (real data)

The viewer column assumes a viewer in Central Europe (UTC+1 in winter, UTC+2 in summer), only to show the conversion; the app uses the viewer's own zone. UTC is local time minus the offset. Conversions are my arithmetic.

**F1, Qatar GP (round 22, upcoming), circuit zone UTC+3.** Sources: [Jolpica schedule](https://api.jolpi.ca/ergast/f1/2026.json) (times in UTC), [OpenF1 sessions](https://api.openf1.org/v1/sessions?meeting_key=1301) (`gmt_offset` 03:00:00, VERIFIED 2026-11-26).

| Session | Circuit local | UTC | Viewer (CET) | Results state now |
|---|---|---|---|---|
| Practice 1 | Fri 27 Nov 16:30 | 13:30Z | Fri 14:30 | none yet |
| Practice 2 | Fri 27 Nov 20:00 | 17:00Z | Fri 18:00 | none yet |
| Practice 3 | Sat 28 Nov 17:30 | 14:30Z | Sat 15:30 | none yet |
| Qualifying | Sat 28 Nov 21:00 | 18:00Z | Sat 19:00 | none yet |
| Race | Sun 29 Nov 19:00 | 16:00Z | Sun 17:00 | none yet |

No sprint this weekend. The cell for Friday 27 Nov would show: flag of Qatar, "Lusail, Qatar", "Qatar Grand Prix", and the two practice sessions. Also on this weekend: F2 round 13 (shared weekend).

**F2, Lusail (round 13, upcoming), UTC+3.** Source: [fiaformula2.com round page](https://www.fiaformula2.com/en/racing/2026/lusail) (embedded JSON, VERIFIED 2026-11-26, state "upcoming").

| Session | Circuit local | UTC | Viewer (CET) |
|---|---|---|---|
| Practice | Fri 27 Nov 14:00 | 11:00Z | Fri 12:00 |
| Qualifying | Fri 27 Nov 18:00 | 15:00Z | Fri 16:00 |
| Sprint Race | Sat 28 Nov 19:15 | 16:15Z | Sat 17:15 |
| Feature Race | Sun 29 Nov 15:00 | 12:00Z | Sun 13:00 |

**F3, Monaco (a finished round, June), UTC+2.** Source: [fiaformula3.com round page](https://www.fiaformula3.com/en/racing/2026/monte-carlo) (VERIFIED 2026-11-26, timezone Europe/Monaco). F3 has no 2026 round left.

| Session | Circuit local | UTC | Viewer (CET, summer time, equal to local) |
|---|---|---|---|
| Practice | Thu 4 Jun 13:25 | 11:25Z | Thu 13:25 |
| Qualifying A | Fri 5 Jun 11:05 | 09:05Z | Fri 11:05 |
| Qualifying B | Fri 5 Jun 11:29 | 09:29Z | Fri 11:29 |
| Sprint Race | Sat 6 Jun 10:45 | 08:45Z | Sat 10:45 |
| Feature Race | Sun 7 Jun 07:45 | 05:45Z | Sun 07:45 |

Results exist for these sessions on the round page (the results arrays are in the same JSON). Monaco's F3 weekend has a Thursday session, so the cell block starts one day before the F1 weekend (F1 Monaco is 5 to 7 June).

**F1 Academy, Las Vegas (round 6, finished), UTC-8.** Source: [f1academy.com calendar](https://www.f1academy.com/Racing-Series/Calendar) (`__NEXT_DATA__`, VERIFIED 2026-11-26; the -08:00 offset is correct in November). This is the example for the "+1d" rule.

| Session | Circuit local | UTC | Viewer (CET) | Top driver in the calendar data |
|---|---|---|---|---|
| Free Practice | Thu 19 Nov 18:00 | Fri 20 Nov 02:00Z | Fri 20 Nov 03:00 (+1d) | A. Palmowski |
| Qualifying | Thu 19 Nov 21:30 | Fri 20 Nov 05:30Z | Fri 20 Nov 06:30 (+1d) | A. Palmowski |
| Reverse Grid Race | Fri 20 Nov 18:15 | Sat 21 Nov 02:15Z | Sat 21 Nov 03:15 (+1d) | A. Larsen |
| Feature Race | Sat 21 Nov 16:20 | Sun 22 Nov 00:20Z | Sun 22 Nov 01:20 (+1d) | A. Palmowski |

All four sessions are on the circuit-local Thursday to Saturday, but the viewer in Europe would find them on Friday to Sunday. The cell grouping must follow the circuit-local date, with the viewer time and "+1d" in the row.

**FIA WEC, 6 Hours of Monza (round 8, finished), UTC+1.** Sources: the round calendar file [fiawec.com ICS, race 5066](https://www.fiawec.com/en/race/calendar/5066) (local times with an IANA zone, VERIFIED 2026-11-26) and the [Monza race page](https://www.fiawec.com/en/race/6-hours-of-monza-2026).

| Session | Circuit local | UTC |
|---|---|---|
| Free Practice 1 | Fri 6 Nov 10:30 | 09:30Z |
| Free Practice 2 | Fri 6 Nov 14:30 | 13:30Z |
| Free Practice 3 | Sat 7 Nov 10:30 | 09:30Z |
| Qualifying LMGT3 | Sat 7 Nov 14:20 | 13:20Z |
| Hyperpole LMGT3 | Sat 7 Nov 14:40 | 13:40Z |
| Qualifying Hypercar | Sat 7 Nov 15:00 | 14:00Z |
| Hyperpole Hypercar | Sat 7 Nov 15:20 | 14:20Z |
| Race (6 hours) | Sun 8 Nov 11:00 | 10:00Z |

The viewer in Central Europe sees the same clock as Monza (CET). The Saturday has five rows with all classes and three with Hypercar only. The results page shows only the latest race as server-rendered HTML, so the app must save a result when it appears (question 1). Ferrari result: the #51 finished 3rd and the #50 9th in the Hypercar race (VERIFIED on the results page, per question 1).

### 2.6 Recommendation

- **Fields:** the three tables in 2.2 (weekend, session, result), with UTC plus the IANA zone as the only stored times, the circuit-local date as the cell key, and `timeConfidence` for placeholder and TBC sessions.
- **Calendar layout:** layout **A (full cells) on wide screens and layout D (compact month plus a day card) on phones**: one component with a width switch at about 900 px. It keeps your description exactly where it fits and gives the same content on the phone one tap later.
- **Main alternative:** layout B (swipeable day columns) if you want the content visible without a tap on the phone and accept no month overview. Layout C if you prefer one weekend card per race.
- **Not recommended:** forcing layout A onto a phone; the text would have to shrink to about 7 px (my estimate).

Not verified: the 56 px and 85 px figures (my estimates, not measured in a browser), whether an F1 practice result is available from OpenF1 (not checked), the F2 Yas Marina times (placeholders today), and the F1 Academy offset interpretation (Richard's observation: the local clock time looks right, the printed offset looks wrong; this is unconfirmed).

## 3. Live weather for the day popup

All facts below were fetched on 2026-11-26. "VERIFIED" means the page or a live request was read that day; "UNVERIFIED" means a search snippet, a paraphrase or memory. A researcher read most pages; I did the recommendation and the design points (marked "my design").

### 3.1 Short answer

Use **Open-Meteo**, called from the page itself (phone and PC browser, each from its own IP), one request per circuit with `current`, `hourly` and `daily` blocks, a 15-minute cache, and a "Weather data by Open-Meteo.com" link in the popup. It needs no key, forecasts 16 days with hourly detail, reports "current" conditions from 15-minute model data, is free for a private app with no ads, and also has an archive for "typical weather" beyond the forecast horizon. No free weather source gives asphalt temperature; only OpenF1 has track temperature, for finished F1 sessions.

### 3.2 Open-Meteo: what you get

| Item | Fact | Source |
|---|---|---|
| Endpoint | `https://api.open-meteo.com/v1/forecast?latitude=..&longitude=..&hourly=..` | [docs](https://open-meteo.com/en/docs), VERIFIED |
| Horizon | `forecast_days` 0 to 16 (default 7). A live request for Yas Marina returned 384 hourly values, the last "2026-12-11T23:00". | [docs](https://open-meteo.com/en/docs), VERIFIED (live request) |
| Models | Default `best_match` combines regional and global models. Days 1 to about 7 come from higher-resolution models (ICON, ARPEGE and AROME, UKMO, MET Nordic where they cover); days 8 to 16 from global models (GFS, IFS) on a coarse grid. The lower skill of days 8 to 16 is general knowledge (UNVERIFIED). | [docs](https://open-meteo.com/en/docs), VERIFIED |
| "Current" | "Current conditions are based on 15-minutely weather model data." It is a model value for the grid cell, not a station reading. A live request returned `"interval":900`. | [docs](https://open-meteo.com/en/docs), VERIFIED |
| Useful variables | hourly: `temperature_2m`, `apparent_temperature`, `precipitation`, `precipitation_probability`, `weather_code`, `cloud_cover`, `wind_speed_10m`, `wind_gusts_10m`, `wind_direction_10m`, `relative_humidity_2m`, `uv_index`, `is_day`. daily: `sunrise`, `sunset`, `uv_index_max`, `temperature_2m_max`, `temperature_2m_min`, `precipitation_probability_max`. | [docs](https://open-meteo.com/en/docs), VERIFIED |
| Time zone | `timezone=auto` resolves the zone from the coordinates and returns `utc_offset_seconds`; that is one fixed value for the whole response, so a DST change inside the window is ignored. `timeformat=unixtime` returns epoch seconds, which compare directly with a session's UTC start. | [docs](https://open-meteo.com/en/docs), VERIFIED |
| Weather codes | WMO codes (0 clear, 1 mainly clear, 2 partly cloudy, 3 overcast, 45 fog, 51 to 57 drizzle, 61 to 67 rain, 71 to 77 snow, 80 to 82 showers, 95 to 99 thunderstorm). The app maps them to its own lego-style icons. | [docs](https://open-meteo.com/en/docs), VERIFIED |
| Errors | HTTP 400 with `"error": true` and a `reason`. | [docs](https://open-meteo.com/en/docs), VERIFIED |

Precipitation probability is "based on ensemble weather models with 0.25° (~27 km) resolution" and can be missing for some hours: the app must handle `null` (my caution, not tested).

### 3.3 Open-Meteo: terms, limits, licence

- **Free tier, no key:** "No API key, no sign-up, no credit card." ([open-meteo.com](https://open-meteo.com/), VERIFIED). **Non-commercial only:** "You may only use the free API services for non-commercial purposes." ([terms](https://open-meteo.com/en/terms), VERIFIED). The terms name "private or non-profit sites without subscriptions or ads" and "personal home automation" as non-commercial (paraphrase). A private PWA with no ads, no subscription and no payment fits.
- **Limits:** less than 10,000 calls a day, 5,000 an hour, 600 a minute, 300,000 a month ([terms](https://open-meteo.com/en/terms), [pricing](https://open-meteo.com/en/pricing), VERIFIED). One request is usually one call, but more than 10 variables or more than 2 weeks for one place count as several ("a request for 2 weeks of data with 15 weather variables will be calculated as 1.5 API calls", [pricing FAQ](https://open-meteo.com/en/pricing), VERIFIED). The popup request has about 28 variables over 16 days, so budget about 3 calls per request; still tiny for one user.
- **Per IP and per application:** the limits apply per IP and per application, and users on shared hosts such as Vercel, Netlify or Render may hit them sooner ([terms](https://open-meteo.com/en/terms), paraphrase, VERIFIED; the maintainer says reports of this "for shared hosts like Vercel and Cloudflare Pages have grown", [discussion 853](https://github.com/open-meteo/open-meteo/discussions/853), VERIFIED). This is the main argument for calling from the phone and PC browsers and against a Vercel proxy.
- **At the limit:** HTTP 429 with "Daily API request limit exceeded." ([issue 438](https://github.com/open-meteo/open-meteo/issues/438), VERIFIED). Whether a 429 carries CORS headers is not known, so a browser may show it as a generic network error (UNVERIFIED): the popup treats every failed fetch the same way.
- **Licence:** data under CC BY 4.0; "You must include a link next to any location Open-Meteo data are displayed", for example "Weather data by Open-Meteo.com" ([licence](https://open-meteo.com/en/licence), VERIFIED; British spelling in the URL).
- **Paid:** a subscription gives a commercial licence and an API key; plans from 1M calls a month, prices not shown on the page ([pricing](https://open-meteo.com/en/pricing), VERIFIED).
- **Privacy:** IP addresses "may be collected for server maintenance and misuse prevention"; logs are deleted after 90 days ([terms](https://open-meteo.com/en/terms), VERIFIED). The app sends the circuit's public coordinates, never the user's location.

### 3.4 Browser calls: CORS

The project README lists "CORS supported" ([GitHub](https://github.com/open-meteo/open-meteo), VERIFIED); one third-party write-up claims `Access-Control-Allow-Origin: *` (search snippet, UNVERIFIED). The researcher could not run a browser, so **no browser has been seen to call it**. Test this first in the build (a one-line fetch from the Chrome app and from the phone). If it fails, the fallback is the desktop-snapshot option in 3.7.

A second risk (my inference, UNVERIFIED): mobile carriers put many phones behind one shared IP, so a per-IP limit could be used up by strangers. For one user making a few calls a day this should be rare, and the cache and the snapshot fallback cover it.

### 3.5 The alternatives

| Source | Key | Free limits | Forecast days | Commercial | Credit | Fit |
|---|---|---|---|---|---|---|
| Open-Meteo | no | 10,000/day, 600/min | 16, hourly | free tier non-commercial only | required (link) | **best** |
| [MET Norway](https://api.met.no/doc/TermsOfService) | no, but an identifying User-Agent or Origin | 20 requests/s, obey `Expires`; repeat gap 3 h outside the Nordic region | about 9 | any purpose | required ("Data from MET Norway") | best second source; a browser cannot set the User-Agent, so the guide recommends a proxy ([docs](https://docs.api.met.no/doc/WebClients.html)) |
| [OpenWeatherMap](https://openweathermap.org/price) | yes | 60/min, 1,000,000/month | 5 (3-hourly) free; One Call 3.0: 8 days, 1,000/day, separate subscription | allowed | obligatory | key would sit in page code; short horizon |
| [WeatherAPI.com](https://www.weatherapi.com/pricing.aspx) | yes | 100,000/month | 3 | free covers commercial apps | required by the terms | horizon too short |
| [Visual Crossing](https://www.visualcrossing.com/resources/documentation/what-can-i-do-with-the-visual-crossing-weather-free-plan/) | yes, and "not in client code" | 1,000 records/day | 15 | allowed | required | key must stay in a backend |
| [Tomorrow.io](https://tomorrow.io/a/faq/weather-api/what-is-rate-limiting-in-the-context-of-a-weather-api) | yes | 500/day, 25/hour, 3/s | 5 on the free plan (the page is inconsistent) | not stated | not stated | low caps |
| [Weatherbit](https://www.weatherbit.io/pricing) | yes | 50/day | 7, daily only | non-commercial | not stated | unsuitable |

All VERIFIED on 2026-11-26 except where a cell says "not stated" (the support pages returned 403 or did not say). CORS of every alternative is UNVERIFIED.

### 3.6 What no free forecast API gives, and what exists

- **Track (asphalt) temperature:** none of the forecast APIs has it. Open-Meteo has `soil_temperature_0cm`, a model ground temperature that is not asphalt in the sun; if shown, label it "ground temperature (model)", never "track temperature" ([docs](https://open-meteo.com/en/docs), VERIFIED).
- **OpenF1 `weather` endpoint (F1 only):** fields `air_temperature`, `track_temperature`, `humidity`, `pressure`, `rainfall`, `wind_direction`, `wind_speed`, updated every minute ([docs](https://openf1.org/docs/), VERIFIED). A live request on 2026-11-26 returned the Las Vegas weekend (for example 2026-11-20T00:16Z: air 13.0 °C, track 14.8 °C, humidity 55.9 %, rainfall 1), so finished sessions of this season are free and need no key. Free tier: historical data from 2023, 3 requests per second and 30 per minute, "non-commercial fan engagement" named as a use, credit not required. Real-time data needs the paid Sponsor tier (EUR 9.90 a month; [openf1.org](https://openf1.org/), VERIFIED). CORS from a browser is not stated, so the desktop service should fetch it. It covers F1 only as far as the pages say; nothing for F2, F3, F1 Academy or WEC (UNVERIFIED for those series).
- **FIA weather-report PDFs** exist per F1 session on fia.com (the file for Austria FP1 was found, 370.9 KB), but the text layer was unreadable to the fetch tool, so the figures are UNVERIFIED. Not an API; not recommended.
- **Rain radar:** Open-Meteo has no radar tiles. [RainViewer](https://rainviewer.com/api/transition-faq.html) has a keyless public API; since 2026-01-01 it is limited to zoom 7, 2 hours of past frames, 100 requests per IP per minute, with no nowcast, "personal and educational use only", attribution mandatory ([api page](https://www.rainviewer.com/api.html); the two pages disagree on some limits, the transition page is the more specific). [LibreWXR](https://github.com/JoshuaKimsey/LibreWXR) is an AGPL self-hosted replacement; reliability not checked. A radar map is a later extra, not v1.

### 3.7 How the popup should work (my design)

**Where the coordinates come from.** Jolpica returns `lat` and `long` for every F1 circuit ([circuits](https://api.jolpi.ca/ergast/f1/2026/circuits/?format=json&limit=3), VERIFIED; example Albert Park `-37.8497, 144.968`). F2, F3 and F1 Academy race on F1 weekends, so they reuse the F1 record. WEC venues that are not on the 2026 F1 calendar (for example Le Mans, Fuji and Imola) need a small hand-checked circuits table (id, name, lat, long, IANA zone); the Open-Meteo geocoding API (GeoNames) gives a town centre, not the track, which is acceptable for a 1 to 25 km grid but should be checked for Le Mans. Which WEC venues lack a Jolpica record was not checked.

**Request.** One request per circuit: `current`, `hourly`, `daily`, `timezone=auto`, `timeformat=unixtime` (my addition, so hourly values compare with the session's UTC start), and `start_date` and `end_date` narrowed to the event (the day before the first session to the day after the last) instead of 16 days, which also keeps the call weight near 1. The researcher ran the full URL for Yas Marina on 2026-11-26 and got the expected blocks (VERIFIED); the `unixtime` variant itself was not requested (UNVERIFIED for the sunrise and sunset format).

**What the popup shows** (all from that one response, my design): a "Now at the circuit" block (temperature, feels-like, wind with gusts and direction, rain now, cloud, humidity, icon, day or night) only when the selected day is today in circuit time or a session is live, labelled "model value for the circuit's grid cell, updated HH:MM, not a trackside sensor"; an hourly strip from one hour before the first session to one hour after the last, with session start and end marked and bars for rain, its probability and wind; a day summary (high, low, rain chance, UV max, sunrise, sunset); the attribution line.

**Cache.** Key by latitude and longitude at 2 decimals plus the window; keep it in memory and in IndexedDB or localStorage (not in the service worker's precache) with `fetchedAt`. Time to live 15 minutes for today or a live session, 60 minutes for other days. Show the cache at once and refresh in the background, only while the page is visible. On HTTP 429 or any failure keep the last payload with "as of HH:MM", wait at least 60 seconds with back-off, never loop. Volume: one popup opening is at most one request, so a heavy day is about 300 weighted calls against a limit of 10,000; prefetching a whole season is about 24 requests.

**Past the horizon, finished rounds, offline.**
- More than 16 days ahead: "Forecast not available yet. Typical for these dates: 21 to 29 °C, rain on about 2 days in 10 (last 5 years)", computed once per round from the [Historical Weather API](https://open-meteo.com/en/docs/historical-weather-api) (ERA5 from 1940, 5 days delay, VERIFIED). The recipe (mean daily high and low, share of days over 1 mm of rain, typical wind) is my design, not an Open-Meteo feature; the Climate API is a projection tool, not a source for "typical" values ([docs](https://open-meteo.com/en/docs/climate-api), VERIFIED). The desktop service computes it once per round and stores it with the round. Days 8 to 16 should be labelled "outlook".
- Finished F1 sessions: the desktop service stores a small OpenF1 summary (air and track temperature min and max, humidity, wind, a rain flag) with the session. Finished F2, F3, F1 Academy and WEC sessions show model values (`past_days` up to 92 days, or the archive), labelled "modelled".
- Offline: the cached payload shows dimmed with "Last updated HH:MM, offline"; with nothing cached the popup says "Weather needs a connection". The stored typical weather and the session summaries come from the Firestore offline cache.

### 3.8 Recommendation

1. **Source:** Open-Meteo, called directly from the phone and PC browser, with the 15-minute cache and the attribution link.
2. **Why:** it is the only source that is keyless, has 16 days with hourly detail and 15-minute "current", offers the archive for typical weather, is free for a private app, and leaves nothing to host or keep running. The live data at the moment of opening is why the browser should call it; the desktop service runs only while the PC is on (your design), so a snapshot would go stale.
3. **Main alternative:** the desktop service fetches weather for the next rounds every 30 to 60 minutes and writes a snapshot to Firestore. It is more robust if the phone's IP is throttled or CORS fails, but is stale whenever the PC is off and adds writes. Choose it only if the first browser test or real use shows 429 or CORS errors. MET Norway is the second source if Open-Meteo is unavailable (it needs an Origin that names a reachable domain, which a localhost build lacks).
4. **Hybrid worth doing in v1:** the desktop service writes only the data that never changes or needs a rate-limited source: the typical-weather summary per round and the OpenF1 summary of each finished F1 session.
5. **Not in v1:** rain radar, and asphalt temperature for any series but F1 (label it honestly as absent).
6. **If the app were ever shared:** Open-Meteo stays free only without ads, subscriptions or payments and while calls come from the users' own IPs; commercial use would need an Open-Meteo key and an OpenF1 licence.

**Not verified:** CORS from a real browser (any source); the body of a 429 and its CORS headers; the exact call-weight formula (the FAQ's variables and weeks rule is verified); the `unixtime` format of sunrise and sunset; MET Norway's hourly versus 6-hourly split; Tomorrow.io's free forecast days and terms; whether any open-source project models asphalt temperature; the FastF1 weather columns and F1's own live-timing terms (not read, so not recommended); OpenF1's terms for non-F1 series and the delay before a finished session's weather is available; RainViewer's real rate limit; LibreWXR's reliability; which WEC venues lack coordinates; Open-Meteo commercial prices.

## 4. Graphics per round: silhouettes, iconic corners, pictures, flags

All facts were fetched on 2026-11-26. "VERIFIED" means a page or a repository file was read that day; "UNVERIFIED" means a search snippet, memory, or a page that refused the fetch. Two researchers read the pages; I re-checked four licence facts myself through the live APIs (marked "re-checked"). Where a line says "mine" it is a pick or a design judgement, not a source fact. Nothing here is legal advice: the licence readings are plain-words readings.

### 4.1 Short answer

- **Track silhouettes:** use the [F1DB circuit SVG assets](https://github.com/f1db/f1db/tree/main/src/assets/circuits) (CC BY 4.0). They have one ready SVG per circuit layout, 160 in total, and cover every circuit of the 2026 and 2027 F1 calendars and the WEC, **except Le Mans**.
- **Le Mans:** use the public-domain Commons file `Circuit_de_la_sarthe_rev12.svg` (a 2002-era layout; check by eye against today's shape).
- **Flags:** use [flag-icons](https://github.com/lipis/flag-icons) (MIT) as SVG files, never emoji, because Windows Chrome and Edge may show letters instead of flags.
- **Iconic corner pictures:** take one Wikimedia Commons photo per circuit (CC0 or public domain first, then CC BY, then CC BY-SA), store it in the app, show it faded in one colour behind the silhouette, and build an About-page credit list from a stored licence record. Where Commons has no good photo, show the silhouette alone or a drawn line illustration.
- **Corners:** the sources name the corner as famous or iconic for 9 of the 30 circuits and as a standout for 7 more; for the other 14 the corner is only my pick (table in 4.5).
- **No logos, wordmarks or F1 typefaces anywhere:** F1's own guidelines say its marks and fonts need a written licence ([formula1.com guidelines](https://www.formula1.com/en/toolbar/guidelines.html), VERIFIED).

### 4.2 What each round needs (mine)

One small record per circuit in Firestore, shared by every series that races there:

| Field | Example | Note |
|---|---|---|
| `circuitId` | `spa-francorchamps` | One per circuit, so F1, F2, F3, F1 Academy and WEC share the same art |
| `layoutId` | `catalunya-6` | The F1DB layout id for that round's year (the layout can change between years) |
| `silhouette` | an inline path string | Copied from the SVG at build time, not fetched at run time |
| `countryCode` | `be` | Picks the flag file |
| `cornerName` | `Eau Rouge and Raidillon` | Shown in the popup as a caption |
| `picture` | file name plus the licence record | See 4.6 |

The 30 circuits to illustrate are the 27 F1 circuits of 2026 and 2027, plus Le Mans, Imola and Fuji from the WEC (Interlagos, Bahrain, Lusail, COTA, Spa and Silverstone are shared with F1). The F2, F3 and F1 Academy calendars add no circuit beyond the F1 list ([F2](https://www.fiaformula2.com/Calendar), [F3](https://www.fiaformula3.com/Calendar), [F1 Academy](https://www.f1academy.com/Racing-Series/Calendar), all opened and VERIFIED by the researcher).

### 4.3 Track silhouettes

**F1DB (recommended).**

- Licence: "F1DB is licensed under a Creative Commons Attribution 4.0 International License" ([README](https://raw.githubusercontent.com/f1db/f1db/main/README.md), re-checked). It credits "Jules Roy" for the "Circuit SVG assets". The licence has no NonCommercial clause. Credit, a licence link and a note of changes are needed only when the app is shared ([CC BY 4.0 legal code](https://creativecommons.org/licenses/by/4.0/legalcode)).
- Content: 160 SVG files, one per circuit layout, named like `melbourne-2.svg` (re-checked through the [GitHub contents listing](https://api.github.com/repos/f1db/f1db/contents/src/assets/circuits/black)). Each file in the `black/` folder is one closed path in a 500 by 500 box with no `viewBox`, stroke only (VERIFIED by the researcher on two files). Sizes of the single-path files are small: `fuji-1.svg` 875 bytes, `melbourne-2.svg` 2,076 bytes, `madring-1.svg` 4,495 bytes (re-checked).
- Layouts: each 2026 race file names its layout in `circuitLayoutId` (Australia is `melbourne-2`, Abu Dhabi is `yas-marina-2`; VERIFIED by the researcher in the [F1DB season data](https://github.com/f1db/f1db/tree/main/src/data/seasons/2026/races)). So the app stores one `layoutId` per round.
- Freshness: release v2026.21.0 on 2026-11-22; the Madring outline was updated on 2026-03-14 ([releases](https://github.com/f1db/f1db/releases), [commits](https://github.com/f1db/f1db/commits/main/src/assets/circuits), VERIFIED by the researcher).
- The SVG files are not in the release zip ("they are not bundled with the standard release artifacts"), so copy them from the repository once.
- How to use them (mine): add `viewBox="0 0 500 500"`, drop the fixed width and height, change `stroke:#000` to `stroke:currentColor`, and inline the path. Then CSS colours it: faint in a calendar cell, full colour on the first tile of the list.
- Not known: how the outlines were drawn (the README does not say). If they were traced from official graphics, a third-party right is possible. The risk is low for a private app; for a public app, ask the maintainers or re-trace from the MIT data below.

**Main alternative: [bacinger/f1-circuits](https://github.com/bacinger/f1-circuits)** (MIT, "Copyright (c) 2019-2025 Tomislav Bacinger", [licence](https://raw.githubusercontent.com/bacinger/f1-circuits/master/LICENSE.md)).

- GeoJSON lines in longitude and latitude, 40 circuits, each file one closed loop of about 84 to 200 points (six files read exactly: Madring 116, Yas Marina 133, Albert Park 146, Silverstone 135, Miami 103, Imola 84). It has Madring (`es-2026`) but no Fuji and no Le Mans.
- It holds one shape per circuit and no layout version. Albert Park, Yas Marina, Silverstone and Marina Bay match the current layouts by length; **Barcelona does not clearly**: its length field (4,655 m) is the 2007 to 2020 value, while F1DB says the layout since 2023 is `catalunya-6`, 4.657 km, so it needs a look by eye.
- Use it if you want your own drawing style (variable stroke, fill, rotation) or want to avoid the CC BY credit. It needs a one-time build script: a closed line, a simple equirectangular projection (x = (longitude minus lon0) times cos(lat0), y = minus (latitude minus lat0)), fit into a 500 box, round to one decimal. About 1.5 to 3 KB per circuit (the researcher's estimate). A public app must ship the MIT notice. The README says "This repository is unofficial and is not associated in any way with the Formula 1 companies."

**Gap: Le Mans (Circuit de la Sarthe).**

- First choice: [`Circuit de la sarthe rev12.svg`](https://commons.wikimedia.org/wiki/File:Circuit_de_la_sarthe_rev12.svg) by Alexander Jones (AlexJ): "Public domain", attribution not required, 24 KB, "Used 2002-" (re-checked through the Commons API). The 2002 and the 2018 shapes differ only in details (chicane positions, Tertre Rouge; the researcher's inference from the [Wikipedia layout history](https://en.wikipedia.org/wiki/Circuit_de_la_Sarthe): circuit N°15, 13.626 km, "Since 2018"). At card size it should look the same, but nobody has looked at it by eye.
- Second choice: [`Circuit de la Sarthe track map.svg`](https://commons.wikimedia.org/wiki/File:Circuit_de_la_Sarthe_track_map.svg) by Will Pittenger, CC BY-SA 3.0 (credit, and share-alike on an adapted copy).
- Third choice: trace from OpenStreetMap (ODbL, credit, and the traced coordinates stay open, [copyright page](https://www.openstreetmap.org/copyright)). The researcher's Overpass requests failed (502 and timeouts), so whether Le Mans and Madring are clean OSM ways is not confirmed.

**Not recommended.**

| Source | Why not | Source link |
|---|---|---|
| OpenF1 `circuit_image` | PNG files hosted on `media.formula1.com`, no licence given, F1 marks belong to Formula One Licensing B.V. | [OpenF1 docs](https://openf1.org/docs/) |
| MultiViewer circuit data | Lap telemetry, about 450 to 500 points, no licence text, so all rights reserved by default | [example response](https://api.multiviewer.app/api/v1/circuits/22/2025) |
| TUMFTM racetrack database | LGPL-3.0 on data is awkward, metres not coordinates, and it misses 13 of the circuits (Miami, Madring, Monaco, Baku, Marina Bay, Las Vegas, Lusail and more) | [README](https://github.com/TUMFTM/racetrack-database) |
| Liquipedia files | "copyrighted, but used with permission of the rights holder" | [example file page](https://liquipedia.net/formula1/File:F1_Shanghai_International_Circuit_infobox_lightmode.svg) |

### 4.4 Silhouette coverage per circuit

Layout ids are the F1DB ones named by the researcher. Where it says "read race.yml", several layouts exist and the id for the 2026 or 2027 round has not been read yet: open the `circuitLayoutId` in that round's `race.yml` before use.

| Circuit | Series | F1DB layout id | Note |
|---|---|---|---|
| Albert Park | F1 | `melbourne-2` | 2022 to now, 5.278 km; `melbourne-1` is the old one |
| Shanghai | F1 | `shanghai-1` | |
| Suzuka | F1 | `suzuka-2` | |
| Miami | F1 | `miami-1` | |
| Montreal | F1 | read race.yml | `montreal-1` to `-6` exist |
| Monaco | F1 | read race.yml | `monaco-1` to `-6` exist |
| Barcelona-Catalunya | F1 (2026 only), WEC 2026 | `catalunya-6` | 2023 to now, 4.657 km |
| Red Bull Ring | F1 | read race.yml | `spielberg-1` to `-3` exist |
| Silverstone | F1, WEC 2027 | `silverstone-8` | 2010 to now, 5.891 km |
| Spa-Francorchamps | F1, WEC | read race.yml | `spa-francorchamps-1` to `-4` exist |
| Hungaroring | F1 | read race.yml | `hungaroring-1` to `-3` exist |
| Zandvoort | F1 (2026 only) | read race.yml | `zandvoort-1` to `-5` exist |
| Monza | F1, WEC 2026 | read race.yml | `monza-1` to `-7` exist |
| Madring (Madrid) | F1 | `madring-1` | 5.416 km, 22 turns, updated 2026-03-14 |
| Baku | F1 | `baku-1` | The only layout |
| Sepang | F1 (2026 only, round 16) | `sepang-1` | |
| Marina Bay | F1 | `marina-bay-4` | 2023 to now, 4.927 km |
| COTA | F1, WEC | `austin-1` | |
| Mexico City | F1 | read race.yml | `mexico-city-1` to `-3` exist |
| Interlagos | F1, WEC | `interlagos-2` | 1990 to now, 4.309 km |
| Las Vegas | F1 | `las-vegas-1` | |
| Lusail | F1, WEC | `lusail-1` | |
| Yas Marina | F1 | `yas-marina-2` | 2021 to now, 5.281 km; `yas-marina-1` is 2009 to 2020 |
| Bahrain (Sakhir) | F1 (2027), WEC | `bahrain-1` | Grand Prix layout 5.412 km; `-2` is the endurance layout |
| Jeddah | F1 (2027) | `jeddah-1` | 6.174 km, 27 turns, the largest file (about 15 KB in black-outline) |
| Portimao | F1 (2027) | `portimao-1` | |
| Istanbul Park | F1 (2027) | `istanbul-1` | |
| Imola | WEC | `imola-3` | 4.909 km; the data lists 2020 to 2025, so check 2026 and 2027 |
| Fuji | WEC | `fuji-2` | 4.563 km, 16 turns; `fuji-1` is 1976 to 1977 |
| Le Mans | WEC | **none** | Commons rev12 (4.3); F1DB has only `bugatti-1` |

Sources: the researcher's reading of the [F1DB circuit data](https://github.com/f1db/f1db/tree/main/src/data/circuits) and the [bacinger files](https://github.com/bacinger/f1-circuits). Whether WEC races on the same layout as F1 at each shared circuit (Bahrain, Imola, Spa, COTA, Interlagos) is from memory (UNVERIFIED). The WEC circuit lists come from the [FIA release of 28 July 2026](https://www.fia.com/news/fia-and-fia-wec-confirm-venues-final-two-rounds-2026) (Barcelona and Monza replace the last two 2026 rounds, "subject to the approval of the FIA World Motor Sport Council") and the [fiawec.com 2027 calendar news](https://www.fiawec.com/en/news/fia-wec-reveals-nine-round-2027-calendar-as-series-expands/13598) (nine rounds, Silverstone added). Question 1 covers the dates; the two sources differ on Le Mans 2027 ("9-13 June" on the news page, "6-13 June" on the home page).

### 4.5 Flags

- **Do not use emoji.** [Microsoft Learn](https://learn.microsoft.com/en-in/globalization/fonts-layout/emoji): "This line might be rendered as letters (for example, Windows with Chromium browsers such as Edge or Chrome), or it might be rendered as flags." A 2025 article ([Gigazine](https://gigazine.net/gsc_news/en/20250204-flag-emojis-on-windows)) says the same for Chrome on Windows. No 2026 source says it changed (UNVERIFIED for 2026), and this app runs in Chrome on a Windows PC.
- **flag-icons (recommended):** "The MIT License (MIT), Copyright (c) 2013 Panayiotis Lipiridis" ([licence](https://raw.githubusercontent.com/lipis/flag-icons/main/LICENSE), re-checked). Folders `flags/4x3` and `flags/1x1`; release v7.6.0 on 2026-10-15. The notice must ship with the files in a shared app.
- **Size:** the 25 countries total about 200 KB in `4x3`, but **Spain (81 KB) and Mexico (85 KB) are 166 KB of that**, because they carry a detailed coat of arms; Brazil, Saudi Arabia and Portugal are 7 to 10 KB; the rest are 0.2 to 1.4 KB. Embed only the 25 files, not the package.
- **Main alternative: [circle-flags](https://github.com/HatScripts/circle-flags)** (MIT, "Copyright (c) 2026 HatScripts"), round flags, about 17 KB for the same 25 (Spain 2.0 KB, Mexico 1.7 KB). Take only Spain and Mexico from it if the size bothers you, or run `svgo` on them (not tested).
- Twemoji flags (CC BY 4.0) and Noto Color Emoji are not needed. Wikimedia Commons flags are public domain but one file at a time, with uneven size; `Flag of Monaco.svg` carries a note that "The use of such symbols is restricted in many countries."

Size figures: the researcher's reading of the [flag-icons](https://api.github.com/repos/lipis/flag-icons/contents/flags/4x3) and [circle-flags](https://api.github.com/repos/HatScripts/circle-flags/contents/flags) file listings (VERIFIED, sum is the researcher's addition).

### 4.6 The iconic corner of each circuit

Source key (all opened 2026-11-26; the fetch tool returns a summary of each page, so a quote was not checked against raw HTML):

- [ESPN](https://www.espn.com/f1/story/_/id/17373251/where-does-eau-rouge-rank-f1-best-corners), [McLaren](https://www.mclaren.com/racing/formula-1/2017/summer-break/best-9-corners-3188884/) (nine fan-voted corners), [F1.com writers](https://www.formula1.com/en/latest/article/130r-blanchimont-and-the-wall-of-champions-our-writers-on-the-trickiest.2FDbAXxaAHdkjkTkZQeIby.2FDbAXxaAHdkjkTkZQeIby), [Monzanet](https://www.monzanet.it/en/formula-1s-legendary-curves-the-icons-that-made-history/), [24h-lemans.com landmarks](https://www.24h-lemans.com/en/news/landmarks-of-the-24-hours-of-le-mans-circuit-57442).
- VERIFIED-ICONIC: a page names the corner as famous, best, iconic or legendary. VERIFIED-STANDOUT: a page names it as a signature, tough or landmark feature but does not say "iconic". UNVERIFIED: my pick, from memory or a page that named no corner.

| Circuit | Suggested picture subject | Status | What the source says |
|---|---|---|---|
| Spa-Francorchamps | Eau Rouge and Raidillon | VERIFIED-ICONIC | ESPN: "Put simply, this is still the best corner in F1." |
| Monza | Parabolica, now Curva Alboreto | VERIFIED-ICONIC | ESPN: "Perhaps the most iconic corner of F1's most iconic circuit." Monzanet: renamed "Curva Alboreto in 2021" |
| Silverstone | Maggotts, Becketts and Chapel | VERIFIED-ICONIC | ESPN: "This is absolutely what a set of F1 corners should look like." Copse is the alternative with a Commons photo |
| Interlagos | Senna S | VERIFIED-ICONIC | ESPN: "An iconic corner with an iconic name." |
| Monaco | Loews (Fairmont) hairpin; alternative the Swimming Pool chicanes | VERIFIED-ICONIC | McLaren on the pool: "one of Monaco's most recognisable features." |
| Suzuka | 130R | VERIFIED-ICONIC | McLaren: "one of the fastest corners in F1" |
| Istanbul Park (2027) | Turn 8, the long triple-apex left | VERIFIED-ICONIC | F1.com writers: "a triple-apex left-hander that spans about 640 metres" |
| Zandvoort (2026 only) | Tarzan | VERIFIED-ICONIC | The circuit's [corner page](https://circuitzandvoort.nl/en/corners) calls it the "most famous" corner |
| Le Mans | Porsche Curves; alternatives Tertre Rouge, Arnage, the Mulsanne chicanes | VERIFIED-ICONIC | 24h-lemans.com: "One of the best-loved sections for many drivers." |
| Montreal | Wall of Champions | VERIFIED-STANDOUT | F1.com writers: "a wall just waiting to punish any mistakes." The page does not say "iconic" |
| Madring | La Monumental, the banked semicircular corner | VERIFIED-STANDOUT | [Motor Sport](https://www.motorsportmagazine.com/articles/single-seaters/f1/madrings-la-monumental-the-banked-corner-thats-unlike-anything-else-in-f1/): "not to exceed a 24% gradient", "steeply banked semicircular sweep". A search snippet said "24-degree banking", which is wrong. Direction (left or right) not stated |
| Baku | Turn 8, the old-town section | VERIFIED-STANDOUT | F1.com writers: "It demands perfect commitment, but is unforgiving". The castle detail is memory |
| Sepang | Turn 14, the final hairpin | VERIFIED-STANDOUT | F1.com writers: "Turn 14 could be notoriously tough at Sepang." |
| Bahrain | Turn 10 and 11 downhill switchback | VERIFIED-STANDOUT | F1.com writers: "that downhill switchback at 11 in Bahrain" |
| Miami | The Hard Rock Stadium section (a landmark) | VERIFIED-STANDOUT | [F1.com guide](https://www.formula1.com/en/latest/article/circuit-guide-everything-you-need-to-know-about-the-miami-international-autodrome.zMEQ1nU4xZKuvc9EsGXDr): "winds around the iconic Hard Rock Stadium" |
| Las Vegas | The Strip straight past the casinos (a landmark) | VERIFIED-STANDOUT | [F1.com guide](https://www.formula1.com/en/latest/article/circuit-guide-everything-you-need-to-know-about-the-las-vegas-strip-circuit.1W9ULMy0aEkvfsJ9tRzItg): "iconic sights such as the Caesars Palace, the Bellagio and the Venetian" |
| Marina Bay | Night skyline section | UNVERIFIED (mine) | The Singapore Sling is named in a source, but whether it is still in the current layout is memory |
| COTA | Turn 1, the steep uphill hairpin | UNVERIFIED (mine) | Two pages read, none calls a corner iconic |
| Mexico City | The Foro Sol stadium section | UNVERIFIED (mine) | Pages read, none ties to the pick |
| Albert Park | Turns 1 and 2 by the lake | UNVERIFIED (mine) | The F1.com guide names no iconic corner |
| Shanghai | Turns 1 to 3, the opening spiral | UNVERIFIED (mine) | The F1.com guide names no iconic corner |
| Barcelona (2026 only) | Turn 3 and the last chicane | UNVERIFIED (mine) | The F1.com guide names no iconic corner |
| Hungaroring | Turn 1, the downhill hairpin | UNVERIFIED (mine) | The F1.com guide names no iconic corner |
| Red Bull Ring | Turn 3 (Remus) with the hills | UNVERIFIED (mine) | Memory only |
| Lusail | Turn 1 and the floodlit straight | UNVERIFIED (mine) | Memory only |
| Yas Marina | The hotel section over the track | UNVERIFIED (mine) | Memory only |
| Jeddah | The seafront high-speed esses | UNVERIFIED (mine) | Memory only |
| Portimao (2027) | Turn 1 and the hills | UNVERIFIED (mine) | A WEC track explainer was read, no quote ties to the pick |
| Imola | Acque Minerali or Tamburello | UNVERIFIED (mine) | A track guide was read, no quote ties to a corner |
| Fuji | The start straight with Mount Fuji behind | UNVERIFIED (mine) | The fiawec.com Fuji page refused the fetch |

So **9 of 30 are sourced as iconic, 7 more as standouts (two of those are landmarks, not corners), and 14 are my picks.** A circuit does not need a famous corner for the feature to work: the pick can just be the most photogenic section. Ask the user to confirm or change the 14 picks (form question).

### 4.7 Where the pictures can come from

**Wikimedia Commons (recommended).** The licence is per file, and the Commons API returns it: `action=query`, `prop=imageinfo`, `iiprop=extmetadata`, filter `LicenseShortName|LicenseUrl|UsageTerms|AttributionRequired|Artist` ([API help](https://www.mediawiki.org/wiki/API:Imageinfo); the exact call is in the researcher's note). The desktop service can read it at build time and store it beside the picture. The Artist field can hold HTML, so strip it before showing a credit. Re-checked through the live API on 2026-11-26:

| File | Author | Licence | Credit needed |
|---|---|---|---|
| `Circuit de Monaco - Épingle du Loews Fairmont (54777022015).jpg` (Loews hairpin) | crash71100 | CC0 | no |
| `Fairmont Hairpin Monaco IMG 1011.jpg` | Alexander Migl | CC BY-SA 4.0 | yes |
| [`Eau rouge.jpg`](https://commons.wikimedia.org/wiki/File:Eau_rouge.jpg) | ph-stop | CC BY-SA 2.0 | yes |
| `Eau Rouge at Spa Francorchamps.jpg` | ContextCreator | CC0 | no |
| `Eau Rouge 1997.jpg` | Matthead | CC BY-SA 2.5 | yes |
| `Copse Corner, Silverstone - geograph.org.uk - 4586571.jpg` | Ian S | CC BY-SA 2.0 | yes |

(The Monaco file page address has brackets in it, so it is given here as a file name: search for it on [commons.wikimedia.org](https://commons.wikimedia.org/).) Coverage differs by circuit: a search for Maggotts and Becketts returned nothing, and the searches for the Monza Parabolica and Le Mans corners found no corner photo (the Monza results were Ascari and Curva Grande, public domain, and a Herbert 1999 car photo). So each circuit must be checked one by one.

The duties, from the [CC BY-SA 4.0 deed](https://creativecommons.org/licenses/by-sa/4.0/): "You must give appropriate credit, provide a link to the license, and indicate if changes were made." and "you must distribute your contributions under the same license as the original." Trademarks are a separate matter: [Commons: Non-copyright restrictions](https://commons.wikimedia.org/wiki/Commons:Non-copyright_restrictions) says "Trademark laws control the commercial use of logos, terms, and names" and "Reusers are responsible for compliance."

My reading: CC0 and public domain need nothing; CC BY needs a credit, a licence link and a change note ("cropped, one colour"); CC BY-SA needs the same and, if the filtered picture is ever given to others, it must go out under CC BY-SA too. For a private app on your own PC and phone, nothing is distributed, so the share-alike clause would only matter if the app were ever shared (UNVERIFIED as law). Choose photos with no cars, sponsor boards or recognisable faces, or crop them out.

**Own drawings or Blender renders.** No licence and no credit. A one-colour SVG line drawing is the cheapest in file size and the best for text legibility. Draw from the track geometry or your own reference, not from a Commons photo, because a drawing traced from a CC BY-SA photo is itself CC BY-SA. The Blender set-up planned for the cars and the Leclerc head could be reused for corner scenes (Blender renders only where vector cannot reach the style, per the studio rule).

**Agency, F1 and circuit press photos: do not use.** The [F1 guidelines](https://www.formula1.com/en/toolbar/guidelines.html) say "All rights in still images/ photos/ screenshots are the property of their respective owners" and "Such content should not be reproduced without the consent of the relevant third party rights holder." The "generally acceptable" line there is about fans' own photos and videos. Agency licences are paid and per use (memory, UNVERIFIED), and circuit press kits have terms nobody found.

**Unsplash and Pexels: fallback only.** [Unsplash](https://unsplash.com/license): "irrevocable, nonexclusive, worldwide copyright license to download, copy, modify, distribute", no attribution needed. [Pexels](https://www.pexels.com/license/): "All photos and videos on Pexels are free to use." and "Attribution is not required." Neither licence clears trademarks, logos or people in a photo; the Pexels brand-help page returned HTTP 403, so its editorial rules are not read. Coverage of named corners is probably poor (my expectation, not checked).

### 4.8 Does a picture behind the text hurt readability? (mine)

Yes, it can, and a phone day cell is small. The one fact checked: [WCAG 2.2 success criterion 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) needs "a contrast ratio of at least 4.5:1" for normal text, measured against the background "over which the text is rendered in normal usage", and failure technique F83 is "background images that do not provide sufficient contrast with foreground text." A busy full-colour photo has dark and bright areas in one cell, so some of the text will fail.

The user wrote "an opaque image". That can mean solid or see-through; I read it as a clear picture next to the silhouette and recommend showing it at reduced strength. Ask in the form.

- Fade the picture to about 25 to 40 percent (a starting guess, untested) and map it to a duotone of the series accent, so the brightness range is narrow and the text contrast is predictable. A CSS grayscale filter plus an overlay colour does it; an SVG `feColorMatrix` gives a real duotone. The filter runs at display time, so the stored file stays the original and the credit stays simple.
- Put a gradient scrim under the bottom-left session list and a small solid chip behind the day number and city line.
- A thin one-colour line drawing of the corner is the most legible and the lightest, and removes the licence question; the faded duotone photo looks more "real".
- Test the finished cell at phone size in light and dark themes with a contrast checker, on the worst-case picture (Monaco and Le Mans have the most bright detail).

### 4.9 Effort (mine, not sourced)

| Route | Per circuit | Note |
|---|---|---|
| Commons CC0 or public domain photo | about 10 minutes | Search, check the licence in the API, crop. Found for Monaco and Spa; not for Monza or Le Mans in the searches |
| Commons CC BY or CC BY-SA photo | about 15 to 20 minutes | The same plus the credit record |
| Own one-colour SVG line drawing | about 1 to 2 hours | No licence, best phone legibility |
| Own Blender render | several hours, more for the first | No licence; reuses the car set-up |

For 30 circuits: about 6 to 10 hours by the Commons route if a photo exists for all, about 30 to 60 hours by drawing. A hybrid is the sensible first release: Commons photos for the 9 circuits with a sourced iconic corner, the silhouette alone or a drawing for the rest.

### 4.10 Notices for the About page

Needed when the app is shared, harmless while it is private (my suggested wording, built from the sources above):

- Circuit layouts: "F1DB (https://github.com/f1db/f1db), Creative Commons Attribution 4.0 International (https://creativecommons.org/licenses/by/4.0/). SVG assets by Jules Roy. Files recoloured and resized for this app."
- Flags: "flag-icons, Copyright (c) 2013 Panayiotis Lipiridis, MIT License", with the MIT text shipped next to the files.
- Le Mans, if rev12 is used: "Circuit de la Sarthe layout: Alexander Jones (AlexJ), public domain, via Wikimedia Commons" (a courtesy). If the CC BY-SA 3.0 map is used instead: credit Will Pittenger and keep the licence.
- Pictures: one line each from the stored record (file page, author, licence name and link, change).
- OpenStreetMap only if a trace is used: "Contains data from OpenStreetMap contributors, Open Database License (ODbL)".
- bacinger only if chosen: "bacinger/f1-circuits, Copyright (c) 2019-2025 Tomislav Bacinger, MIT", with its disclaimer.
- Trademark line (my suggestion): "Unofficial private fan app, not affiliated with or endorsed by Formula 1, the FIA or any circuit. F1 and related marks belong to their owners." The F1 guidelines say the marks cannot be used "without a specific written licence", so the app must not show logos or wordmarks; this sentence is not an F1 requirement I read.

### 4.11 Recommendation for question 4

1. Silhouettes from F1DB, one `layoutId` per round, inlined at build time. Le Mans from the public-domain Commons file, checked by eye.
2. Flags from flag-icons `4x3` (25 files), never emoji.
3. Pictures: a hybrid. Commons photos (CC0 or public domain first) for the circuits where one exists, faded in one colour behind the silhouette, with a stored licence record and a generated credit list. Silhouette alone or a drawn line illustration where none exists.
4. A scrim under the session list and a contrast check, whatever the picture.
5. Main alternative: own line illustrations for all 30 circuits (no licences, best legibility, consistent look, 30 to 60 hours).

### 4.12 Not verified

- The 14 corner picks marked "mine"; the direction of La Monumental; whether the Sling is in the current Marina Bay layout.
- Which Commons files exist for most of the 30 circuits (only Monaco, Spa and Silverstone were checked, and nothing was downloaded).
- Anything by eye: no SVG or GeoJSON was drawn or looked at, so shape quality, orientation, the Barcelona layout in bacinger and the Le Mans 2002 against 2018 shape are unseen.
- F1DB layout ids for Montreal, Monaco, Red Bull Ring, Spa, Hungaroring, Zandvoort, Monza and Mexico City; how the F1DB outlines were made.
- OpenStreetMap coverage (Overpass failed); the Fuji circuit page; the Pexels brand page; the formula1.com terms for circuit PNGs and flag images; terms of circuit press photos and agency licences.
- Whether share-alike reaches a private filtered copy; the ODbL and LGPL readings. All are plain-words readings, not legal advice.
- Whether Windows 11 Chrome or Edge shows flag emoji in 2026 (latest sources are 2024 and 2025).
- The 25 to 40 percent picture strength is a starting guess. The effort figures are estimates.

## 5. Notifications on the PWA

**Short answer.** Web Push works on Android and on iPhone (iPhone only for an app installed to the Home Screen, iOS 16.4 or later). Send it with the same pieces SmakMal already uses: pwa-kit's `push/server` sender, one idempotent dispatcher endpoint on Vercel, a Vercel Schedule every 15 minutes, and the desktop service as an extra caller. Keep the notifications to send in a small "due" table in Firestore, so a changed session time only changes one row. The one thing that costs precision: on the free Vercel plan the "1 hour before" reminder arrives somewhere between about 60 and 30 minutes before the session.

### 5.1 What the phone needs (verified)

| Fact | Exact words or value | Source | Status |
|---|---|---|---|
| iPhone: Home Screen web apps only, iOS 16.4 or later | "Add web push to Home Screen web apps in iOS 16.4 or later and Webpages in Safari 16 for macOS 13 or later." | [Apple, Sending web push notifications in web apps](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers) | VERIFIED |
| iPhone: permission needs a tap | "Provide a method for the user to grant permission with a gesture, such as clicking or tapping a button. When the user completes the gesture, call the push subscription method immediately from the gesture's event handler code." | same Apple page | VERIFIED |
| iPhone: every push must be shown | "Safari doesn't support invisible push notifications. Present push notifications to the user immediately after your service worker receives them. If you don't, Safari revokes the push notification permission for your site." | same Apple page | VERIFIED |
| iPhone: payload limit and errors | `PayloadTooLarge`: "The payload size is over the limit of 4 KB."; 404 invalid path; 410 "The device token has expired."; 429 too many requests | same Apple page; [RFC 8030](https://www.rfc-editor.org/rfc/rfc8030.html) | VERIFIED |
| iPhone: delivery headers | `TTL` may keep a message "30 days or fewer"; `Urgency` `high` "To attempt to deliver the notification immediately"; `Topic` coalesces, max 32 characters | same Apple page | VERIFIED |
| iPhone: no notification buttons | caniuse: `Notification.actions` is "Not supported" in Safari on iOS; supported in Chrome, Firefox and Samsung Internet for Android | [caniuse](https://caniuse.com/mdn-api_notification_actions) | VERIFIED (as extracted) |
| iPhone 26: any site added to the Home Screen opens as a web app | "By default, every website added to the Home Screen opens as a web app." | [WebKit, Safari 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/) | VERIFIED |
| Android: Push API | Chrome, Firefox and Samsung Internet for Android: supported | [caniuse Push API](https://caniuse.com/push-api) | VERIFIED (as extracted) |
| `userVisibleOnly` | "A boolean indicating that the returned push subscription will only be used for messages whose effect is made visible to the user." Chrome and Edge reject a subscription without it | [MDN PushManager.subscribe](https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe) | VERIFIED |
| Declarative Web Push | "now available on iOS and iPadOS 18.4 for web apps added to the Home Screen"; optional, Android still needs a service worker | [WebKit, Safari 18.4](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/) | VERIFIED |
| Web Push in the EU on iPhone in 2026 | Apple said it keeps "the existing Home Screen web apps capability in the EU" (2024); nothing found about push there in 2026 | [MacRumors, 2024-03-01](https://www.macrumors.com/2024/03/01/apple-walks-back-decision-to-disable-eu-web-apps/) | UNVERIFIED for push |

In plain words: on Android a normal Push API subscription works from the browser or the installed app. On iPhone the user must first add the app to the Home Screen, then tap a "Turn on notifications" button inside the installed app. iPhone shows no buttons on a notification, so a tap on it must open the right session. Always show a notification for every push, and keep the message under 4 KB.

### 5.2 What SmakMal already does (local files, read on 2026-11-26)

| Fact | Where | Status |
|---|---|---|
| Sends with the `web-push` library: TTL 6 hours, `topic` per kind, a 404 or 410 deletes the subscription | `C:\git_personal\smakmal\lib\reminders\send.ts:4,21,24,29,35,39` | VERIFIED |
| One website endpoint `POST /api/reminders/run`, guarded by a `CRON_SECRET` bearer token with a constant-time compare | `smakmal\lib\reminders\route.ts:6,22-26,61-62` | VERIFIED |
| Two callers, the user's pick "Desktop + Vercel" (2026-11-15): a Vercel Schedule and the desktop app's 15-minute timer | `smakmal\lib\reminders\route.ts:2`; `smakmal\desktop\src\reminders.ts:8,39-42` | VERIFIED |
| The Vercel trigger: `"schedules": {"reminders": {"schedule": "*/15 * * * *", "path": "/api/reminders/run", "requestMethod": "POST"}}` | `smakmal\vercel.json:8-14` | VERIFIED |
| The dispatcher is idempotent and zone aware: a reminder is due from its time for 90 minutes (`LOOKBACK_MINUTES`), once a day per kind, with the device's IANA time zone | `smakmal\lib\reminders\schedule.ts:4,10,18,34-37` | VERIFIED |
| Subscriptions in Firestore `users/{uid}/pushSubscriptions/{deviceId}`, per-kind switches and a time zone, owner-only rules; the sender reads with a service account over REST (no Admin SDK) | `smakmal\src\lib\pushReminders.ts:34-35,51-56`; `smakmal\firestore.rules:80-104`; `smakmal\lib\reminders\firestore.ts:5,23,31-32` | VERIFIED |
| Permission asked only when a reminder is switched on, never on load; iPhone outside the Home Screen shows an "install first" state | `smakmal\src\lib\pushStore.ts:1-4,40-52,62-82` | VERIFIED |
| `pwa-kit/push/server` (v0.3.0) is a sender with no dependency (`node:crypto`): VAPID, encrypted payload, TTL, urgency, topic; result `sent` or `gone` (404 or 410) | `C:\git_personal\pwa-kit\README.md:225-263,295` | VERIFIED |
| BrickBudget's queued BT.NOTIFY.PUSH-BASE: planned with the desktop app as sender; re-scoped on 2026-11-21 to "Web Push sent from the leased service or Vercel". Nothing built; no push code in budget-tracker or lego-tracker | `C:\git_personal\_wt-chrome-items\docs\research\APPS.CHROME.md:74,169`; item store `items.json`, key `BT.NOTIFY.PUSH-BASE` | VERIFIED |

### 5.3 Who sends: the options

| Option | Cost, card | Smallest step, precision | "1 hour before" | PC off | Main risk | Source |
|---|---|---|---|---|---|---|
| Desktop service only | 0, no | exact | only while a PC is on | nothing is sent | one point of failure | design |
| Vercel Cron Jobs (old) on Hobby | 0, no | "once per day", "+-59 min" | **no** | works | far too coarse; UTC only | [Vercel cron usage](https://vercel.com/docs/cron-jobs/usage-and-pricing) |
| **Vercel Schedules (beta) on Hobby** | 0, no | every 15 minutes, jitter window "Always 15 minutes", 5,000 runs per billing period | about 60 to 30 minutes before | works | beta; limits "may change before general availability" | [Vercel Schedules](https://vercel.com/docs/schedules), [limits](https://vercel.com/docs/schedules/limits) |
| Firebase scheduled function (Blaze) | expected 0; **card needed** | Cloud Scheduler job every 5 minutes | within 5 minutes | works | card on file, "budget alerts do not cap your usage or charges" | [Firebase schedule functions](https://firebase.google.com/docs/functions/schedule-functions), [plans](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans) |
| GitHub Actions schedule | 0 in a public repo; a private repo likely runs out of the monthly allowance | "once every 5 minutes", delayed or dropped at busy times; disabled after 60 days idle in a public repo | roughly | works | delays and drops | [GitHub events that trigger workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows) |
| cron-job.org, QStash, Cloudflare Cron | 0, no | 1 minute (cron-job.org), exact (QStash, 1,000 messages a day on Free, 7 days maximum delay), UTC (Cloudflare) | yes | works | each still needs a public endpoint or a host; a third party | [cron-job.org FAQ](https://cron-job.org/en/faq/), [QStash pricing](https://upstash.com/pricing/qstash), [Cloudflare limits](https://developers.cloudflare.com/workers/platform/limits/) |

Quotes that matter, from the pages above: Vercel Cron Jobs "are a legacy feature and will be migrated to Schedules in the future" and a Hobby job "configured as `0 1 * * *` ... will trigger anywhere between 1:00 am and 1:59 am". Vercel Schedules are "available in Beta on all plans"; over the run limit "Scheduled runs, which Vercel skips"; each schedule takes "Any IANA timezone". Vercel says a run can arrive twice: "Make your handler safe to run more than once". An every-15-minute schedule is 2,880 runs in 30 days, inside the 5,000. A Firebase scheduled function needs the Blaze plan (a payment method): the schedule page itself does not say so (I re-fetched it on 2026-11-26), but the [plans page](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans) says "Cloud Billing accounts require a payment method." and that after a downgrade to Spark "You cannot do new deploys of any new or any existing Cloud Functions", and the pricing page lists Cloud Functions invocations as "Not applicable" on Spark. One Cloud Scheduler job is inside "an allowance of three jobs per Google account, at no charge" and a 5-minute schedule is 8,640 invocations in 30 days against "No-cost up to 2M/month" ([Firebase pricing](https://firebase.google.com/pricing)). Cloud Messaging itself is "No-cost" on both plans, but the direct `web-push` library needs no Firebase messaging SDK or second service worker, so it is the smaller choice for one owner. `web-push` is at version 4.0.0 (MPL-2.0), about 14.1 million downloads in the week to 2026-11-24 ([npm downloads API](https://api.npmjs.org/downloads/point/last-week/web-push)); pwa-kit's own `push/server` makes even that dependency unnecessary.

### 5.4 The design (recommended)

- **A "due" table, not one scheduled message per notification.** Collection `dueNotifications`, document id `{kind}__{seriesId}__{sessionId}`, fields `kind` (day, hour, result), `dueAt`, `expiresAt`, `title`, `body`, `url`. The desktop service writes and updates these rows when it syncs the calendar (a moved session changes one row). Reasons: session times move; per-notification schedulers have caps (QStash Free 1,000 messages a day, Vercel Hobby 500 dynamic schedules); settings are applied when sending, so a settings change needs no rewrite; a late or skipped run still sends, because a row is due from `dueAt` until `expiresAt`.
- **The sender** is the one endpoint SmakMal already has the shape of: every run, read the due rows, drop the expired, apply the settings, send, delete the row. Duplicate runs collapse on the phone because every push carries `tag` and `Topic`.
- **The Monday 09:00 digest is not a row.** At each run the sender looks at the wall clock in the user's time zone: Monday, 09:00 or later, and not yet sent this ISO week, then it sends the next 7 days and records the week. A wall-clock test makes daylight saving harmless. On a 15-minute trigger it arrives between 09:00 and about 09:30.
- **Reminder times.** "1 day" means 24 hours as an instant. To soften the lateness of the free plan, the hour reminder can be due at 75 minutes before and the text can state the real start time and minutes left when it is sent ("starts 14:00, in 52 min"). The desktop service, while a PC is on, can call the same endpoint every minute or five, which makes the reminders exact whenever a PC is up; Vercel stays the backstop.
- **Results.** Only the desktop service can fetch a result, so a result push waits while no PC is on. Everything else (the digest, the reminders) is built from what is already in Firestore and keeps going. The phone shows "last synced at" from `meta/sync` so a gap is visible.
- **Quiet hours** (suggested, not asked for): move a due time inside quiet hours to the end of the quiet period if the session has not started, otherwise drop it.
- **Time-to-live** (my suggestion): digest 12 hours, day reminder 6 hours, hour reminder 30 minutes with urgency `high`, result 6 hours.
- **Cost in reads:** about 288 runs a day on a 5-minute trigger is about 576 reads (about 1.2 percent of the free 50,000); on a 15-minute trigger a third of that ([Firestore pricing](https://firebase.google.com/docs/firestore/pricing): "a minimum charge of one document read for each query").
- **Per-series and per-kind settings** in one owner-writable document `settings/notifications` (example below), the same shape as SmakMal's per-kind switches with an added series level:

```json
{
  "timeZone": "Europe/Budapest",
  "quietHours": { "enabled": true, "start": "22:00", "end": "07:00" },
  "week": { "weekday": 1, "time": "09:00" },
  "leadLongMinutes": 1440,
  "leadShortMinutes": 60,
  "sessionTypes": ["race", "sprint", "qualifying"],
  "series": {
    "f1":        { "week": true, "long": true,  "short": true,  "result": true },
    "f2":        { "week": true, "long": false, "short": true,  "result": false },
    "f3":        { "week": true, "long": false, "short": false, "result": false },
    "f1academy": { "week": true, "long": false, "short": true,  "result": true },
    "wec":       { "week": true, "long": true,  "short": true,  "result": true }
  }
}
```

`sessionTypes` is there because an F1 weekend has three practice sessions and a reminder for each would be noise. Source for the table and the 5-minute design: researcher c's findings, section 5.5 to 5.7 (my design, not a quoted source).

### 5.5 Recommendation

**Use SmakMal's pattern**: pwa-kit `push` in the page and `push/server` as sender, one idempotent dispatcher endpoint on Vercel with a `CRON_SECRET` bearer, a Vercel Schedule every 15 minutes, subscriptions in Firestore, the desktop service as an extra caller, the due table above. Reasons: no card, no new service, code that exists and is tested, the user already picked "Desktop + Vercel" for SmakMal on 2026-11-15. Costs to accept: the free plan's schedule is in beta and arrives up to 30 minutes late, so "1 hour before" means "about an hour before"; and the sender runs on Vercel, so it needs its own Firestore service-account key in Vercel's environment variables, a second place where a key sits (question 6).

**Main alternative:** one Firebase scheduled function every 5 minutes on the Blaze plan: exact within 5 minutes, no key for the sender (it runs as a service account attached to the project), no beta label, but a payment method on Google Cloud, no hard spending cap, and a second toolchain (`firebase deploy`) beside Vercel. Choose it if the 30-minute slack bothers you and you accept the card. **Not recommended:** the desktop service as the only sender (the Monday digest and the reminders are lost whenever both PCs are off) and the old Vercel cron (once a day).

Not verified: push on iPhone Home Screen apps in the EU in 2026; whether the app badge updates from a closed iPhone app; the Vercel plan the user is on besides SmakMal's README line ("free Hobby plan", `smakmal\README.md:141`); the commercial-use wording of the Hobby plan; whether Vercel's queue feature (needed for one-time dynamic schedules) is on Hobby (the design does not need it); GitHub's whole-minute rounding; Cloudflare I/O versus CPU time.

## 6. Firestore: data model, rules, offline cache, the desktop writer

**Short answer.** Yes, Firestore fits, and it stays far inside the free quota (about 800 reads and under 300 writes a day against 50,000 and 20,000). Store one document per series season (rounds and sessions embedded), one document per session result, one per standings table. The phone reads as the signed-in owner and can write only its own settings and push subscriptions; race data is writable by nobody from a client. The desktop service writes as a dedicated service account with one role, using a key file whose path comes from an environment variable you set. No DPAPI, no `safeStorage`, no Windows Credential Manager anywhere.

### 6.1 Limits and prices that matter (verified on 2026-11-26)

| Item | Exact words | Source | Status |
|---|---|---|---|
| Document size | "Maximum size for a document: 1 MiB (1,048,576 bytes)" | [Firestore quotas](https://firebase.google.com/docs/firestore/quotas) | VERIFIED |
| Free quota per day | stored data 1 GiB; document reads 50,000; writes 20,000; deletes 20,000; "reset around midnight Pacific time" | [Firestore pricing](https://firebase.google.com/docs/firestore/pricing), [Firebase pricing](https://firebase.google.com/pricing) | VERIFIED |
| One query costs at least one read | "There is a minimum charge of one document read for each query that you perform" | Firestore pricing page | VERIFIED |
| Listener re-open after 30 minutes | a listener "disconnected for more than 30 minutes" is charged "as if you issued a new query" | Firestore pricing page | VERIFIED |
| Spark needs no card | "No payment information needed to get started or to use only the no-cost Firebase products." | [Firebase plans](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans) | VERIFIED |
| Blaze per-unit prices | about 0.03 USD per 100,000 reads, 0.90 USD per million writes | a search snippet only, the price pages are JavaScript pages that returned no text | UNVERIFIED (not needed: the design stays in the free quota) |

### 6.2 Data model (recommended)

```text
series/{seriesId}                         f1, f2, f3, f1academy, wec: name, art key, current season
series/{seriesId}/seasons/{year}          ONE document: season info + rounds[] with sessions[] embedded
series/{seriesId}/seasons/{year}/results/{sessionId}    one document per session (classification rows, short text)
series/{seriesId}/seasons/{year}/standings/{kind}       drivers, teams (replaced after each round)
meta/sync                                 last sync time, per-series version, source notes
settings/notifications                    the phone writes (see question 5)
pushSubscriptions/{deviceId}              the phone writes
dueNotifications/{id}                     server only, no client access
```

Why embedded: my size estimate for Formula 1 is about 24 rounds x 6 sessions x 250 bytes, roughly 50 KB, about 5 percent of the 1 MiB limit (my arithmetic, not a source). One read per series then gives the whole calendar and list view, five documents make the whole calendar available offline, and no collection-group query is needed (so no `rules_version = '2'` rule and no index step). Cost: any change rewrites the season document and wakes listeners on it. The desktop should write a document only when its content hash changed.

Reads per phone open (arithmetic): cold open, or a listener resumed after 30 minutes, is 5 season documents + 1 `meta/sync` = 6 reads; with 3 result taps and 2 standings views it is 11. At 20 opens a day that is 220 reads; the phone alone would need about 4,500 opens a day to reach 50,000. The sender (question 5) adds about 576 reads a day on a 5-minute trigger, about 192 on a 15-minute one. The desktop writes at most about 288 documents a day if it syncs every 30 minutes (1.4 percent of 20,000). All-in: about 800 reads a day, 1.6 percent of the free quota. Storage about 12 MB a year against 1 GiB. The real round counts per series come from question 1.

### 6.3 Security rules (recommended)

Verified facts: "The server client libraries bypass all Cloud Firestore Security Rules" ([Firestore security get started](https://firebase.google.com/docs/firestore/security/get-started)), and over REST an OAuth 2.0 token makes Firestore "ignore your security rules" ([use the REST API](https://firebase.google.com/docs/firestore/use-rest-api)). That is why "nobody writes race data from a client" is `write: if false` and the desktop service, which uses IAM, still can. The same pattern is already in your apps: `C:\git_personal\_wt-chrome-lease\README.md:1042-1046` ("A service account signs in through Google Cloud's IAM, which Firestore's security rules do not apply to"), SmakMal's default deny at `firestore.rules:4`, and lego-tracker's at `firestore.rules:43-45`.

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isOwner() {
      return request.auth != null && request.auth.uid == 'OWNER_UID_PLACEHOLDER';
    }

    match /series/{seriesId}/{document=**} { allow read: if isOwner(); allow write: if false; }
    match /meta/{document=**}              { allow read: if isOwner(); allow write: if false; }

    match /settings/{document=**}          { allow read, write: if isOwner(); }
    match /pushSubscriptions/{document=**} { allow read, write: if isOwner(); }

    match /{document=**} { allow read, write: if false; }   // dueNotifications and the rest
  }
}
```

The uid is shown under Authentication, Users, after your first Google sign-in on the phone (a uid is an identifier, not a secret, but keep the file out of a public repository anyway). I prefer the uid over an e-mail check: it does not depend on an e-mail claim, and nobody can later own the same address. `request.auth.token.email_verified` is used in lego-tracker's and the wedding rules in your own files (verified there) but I did not find it on the Firebase page I opened, so the uid form is the verified one. The two narrow owner-write paths (`settings`, `pushSubscriptions`) are needed because your request says the phone changes notification settings; if you want strictly no client write, the alternative is a small authenticated endpoint, which is more code for no gain with one owner. Firebase Auth with the Google provider: turn on only that provider, add the PWA's domain to authorized domains, and `signInWithRedirect` is the preferred method on mobile ([Firebase Auth, Google](https://firebase.google.com/docs/auth/web/google-signin)). Whether redirect or popup sign-in works inside an installed iPhone Home Screen app is not on that page: UNVERIFIED, test it on a real phone before building more.

Public read instead? Race data is public in itself, so rules with `allow read: if true` would remove the sign-in step. I recommend against: your data comes from sources whose terms limit redistribution (Formula 1's guidelines say "substantial pieces of the data may not be reproduced or used commercially through scraping or any other means", and the official F2, F3 and F1 Academy sites allow "personal, non-commercial use only", see question 1), and a private store keeps this a personal tool.

### 6.4 Offline cache on the phone

Verified ([Firestore offline data](https://firebase.google.com/docs/firestore/manage-data/enable-offline)): "For the web, offline persistence is disabled by default."; use `persistentLocalCache` with `persistentMultipleTabManager()`; the default cache threshold is 100 MB; "If `fromCache` is `true`, the data came from the cache and might be stale or incomplete." This is the standard in `C:\git_personal\desktop-kit\src\sync\firestore.ts:11-27` (`persistentLocalCache({tabManager: persistentMultipleTabManager()})`). Five season documents of about 50 KB plus what you have opened is a few MB, so Firestore itself evicts nothing.

The real iPhone risk is the browser, not Firestore ([WebKit storage policy](https://webkit.org/blog/14403/updates-to-storage-policy/), [WebKit tracking prevention](https://webkit.org/tracking-prevention/)): in a Safari tab, script-writable storage (IndexedDB included) can be deleted after 7 days without use; "The first-party domain of home screen web applications is exempt from ITP's 7-day cap", and a request for persistent storage is granted "based on heuristics like whether the website is opened as a Home Screen Web App", not guaranteed. So installing to the Home Screen is also the offline answer. Recommended: install first, call `navigator.storage.persist()` after install, a service worker that precaches the app shell (the track silhouettes and flags too), fetch all five season documents on the first online open so every series is cached, and show "from cache, last synced at ..." (from `meta/sync`) whenever the data is cached. Results, standings, weather and the champion window say "online only" or "as of the last time you opened it".

### 6.5 How the desktop service writes without safeStorage (the ban)

**The ban**, in your words: `C:\Users\zoltan.gyorkei\.claude\CLAUDE.md:131-157`, "Secrets: no DPAPI, no OS key store from scripts", and the parity rule at line 193 (APPS.PARITY-RULE, 2026-11-23): "keys the service needs come from an environment variable the user sets, never a key store". So desktop-kit's `GoogleSession` as wired by the apps (refresh token in `google-session.bin` through Electron `safeStorage`, `session.ts:17-28,95,213`) is not an option for rawe_ceek's service, and neither is lego-tracker's `googleSession.ts` or BrickBudget's `aiGemini.cjs`. What is allowed: `google-signin`'s PKCE loopback flow with a stand-in that reports encryption unavailable (the token then stays "kept until the app quits", in memory only), desktop-kit's `sync` part (client model), and the plain-Node local service (on branches, see question 9).

| Option | Where the secret sits | If it leaks | Unattended after login | Fit |
|---|---|---|---|---|
| **A. Service account key file, path from an environment variable** | a JSON key file outside every repository, user-only permissions; the variable holds only the path | that one service account only: Firestore of this project (with `roles/datastore.user`, includes delete) | yes | **recommended** |
| B. `gcloud auth application-default login` | `%APPDATA%\gcloud\application_default_credentials.json`, a user credential for your Google account | everything your Google account can reach, until revoked | yes after one login | wider secret |
| C. Sign in at each start, keep nothing | nothing on disk | none on disk | **no**: a prompt at every start | a manual window, not a tray service |
| D. REST with a signed token and no SDK | the same key file as A | same as A | yes | more code, no gain over A |

Facts for A (verified): Application Default Credentials look first at the `GOOGLE_APPLICATION_CREDENTIALS` environment variable, then at the `gcloud` file, then at an attached service account ([Google ADC](https://docs.cloud.google.com/docs/authentication/application-default-credentials)); Google also warns "Service account keys create a security risk and are not recommended." The role `roles/datastore.user` is "Read/write access to data in a Firestore database. Intended for application developers and service accounts." ([Firestore IAM](https://docs.cloud.google.com/firestore/docs/security/iam)). `C:\git_personal\_wt-chrome-lease\README.md:1021-1069` already designs this: "No SDK and no new dependency: the token is signed with `node:crypto` and Firestore is reached over its REST API", at about 3,000 reads and 1,500 writes a day for the lease alone. SmakMal's sender does the same from an environment variable (`smakmal\lib\reminders\firestore.ts:5,23,31-32`).

Hardening I recommend: a dedicated service account for the desktop writer with only `roles/datastore.user` (not the default `firebase-adminsdk` account); the key created once and saved under your profile, outside every repository; the variable set by you as a user environment variable; the service refuses to start when the variable is missing, never logs the key; code that writes only `series/**`, `meta/**` and `dueNotifications/**`; rotate the key about once a year; a Google Cloud budget alert. If the sender runs on Vercel it needs its own key, in Vercel's environment variables (a second place where a key sits; that is the price of the no-card choice in question 5). A Firebase scheduled function needs no key (attached service account).

**Two things you may trip over.**
1. The organisation policy `iam.disableServiceAccountKeyCreation` blocks creating keys, and "If your organization was created on or after May 3, 2024, this constraint is enforced by default." ([restricting service accounts](https://docs.cloud.google.com/resource-manager/docs/organization-policy/restricting-service-accounts)). My reading, not on the page (UNVERIFIED): a project under a personal Google account has no organisation above it, so create the Firebase project with your personal account, not an Accenture account.
2. Your own desktop-kit README says the key copy goes to `%LOCALAPPDATA%\desktop-kit\service\lease\keys\<app>.json` (`lease app add`, branch only), while the parity rule says "environment variable". Both are plain files. I recommend one environment variable per app that holds the key file path (a name such as `RAWE_CEEK_FIREBASE_KEY_FILE` is my proposal), so the rule and the lease can both be met.

### 6.6 Recommendation

Data model as in 6.2, rules as in 6.3 (uid pinned, owner read on data, `write: if false` for clients on race data, owner write only on `settings` and `pushSubscriptions`), offline as in 6.4 (install to the Home Screen, `persistentLocalCache` with multi-tab, `persist()`, warm cache of all five series), desktop writer option A with a dedicated `roles/datastore.user` account and a key file whose path is in an environment variable, project under your personal Google account. **Main alternative:** option B (`gcloud` ADC) if you do not want a key file, accepting the wider secret; or to let the phone read public data without sign-in, accepting that the scraped data is published.

Not verified: iPhone Home Screen sign-in redirect behaviour; the "1 write per second per document" figure (not on the current quotas page, irrelevant at a few writes per half hour); the breadth of the default `firebase-adminsdk` account; whether a refresh token sits in the ADC user file; Blaze prices; whether `iam.disableServiceAccountKeyCreation` reaches a personal project with no organisation; the `email_verified` claim on Firebase's own rules page; whether `roles/datastore.user` can be limited to chosen collections (IAM Conditions not researched).

**Other apps, for reference.** SmakMal uses a named database (`firebase.json`), lego-tracker has Firestore rules and an optional `access/allowlist` document, BrickBudget has no Firestore on main (Drive and Sheets only; CHROME.DATA is open), and `wedding@BABY.FIREBASE` (branch `item/BABY.FIREBASE`, HEAD `4c2ae6e`) uses an allowlist plus admin model, not owner-only write, so do not copy it for race data. No app uses `firebase-admin`; all use REST plus a signed token (Melvin, parts B6 and B7).

## 7. The champion window: how Charles Leclerc can still become World Drivers' Champion

**Short answer, on today's real standings (2026-11-26).** He cannot. Charles Leclerc has been mathematically out of the 2026 title since round 18, the United States GP (25 October 2026): the leader was 132 points ahead and only 125 were left. Kimi Antonelli (Mercedes) clinched the title one race later, at the Mexico City GP (round 19, 1 November). Today Antonelli has 402 points, Leclerc 250 (6th), and two races are left (Qatar on 29 November, Abu Dhabi on 6 December) with no sprint, so at most 50 points remain. The best Charles can still do is **third place**, and it does not need two wins: it is possible whenever he out-scores Hamilton by 18 points and Russell and Norris by 15 over the two races (details in 7.6). The window therefore needs three states (alive, alive only on countback, eliminated) and a next-season view; today it must show the "eliminated" state with the real prize still open, third place. Your request describes "how he can still become champion": the window should say so honestly, not invent a route.

I recomputed the arithmetic below from the Jolpica round files (21 race files, 6 sprint files, 21 standings files) on 2026-11-26. Richard's two-race third-place sentence ("only if he wins both") was too narrow, and the corrected rule is in 7.6.

### 7.1 Real standings after round 21, Las Vegas (race 2026-11-22 04:00Z, which is Saturday evening 21 November in Las Vegas, UTC-8 by my conversion; fetched 2026-11-26)

Sources: [Jolpica driver standings](https://api.jolpi.ca/ergast/f1/2026/driverstandings/) (VERIFIED), cross-checked with [OpenF1 championship_drivers](https://api.openf1.org/v1/championship_drivers?session_key=latest) (VERIFIED: the same first rows, 12 = 402, 3 = 304, 44 = 267, 63 = 264). I recomputed every driver's total from the 21 race results plus the 6 sprint results: the top 12 match exactly, so there is no fastest-lap point in the standings.

| Pos | Driver | Pts | GP wins | 2nd | 3rd | Gap from Leclerc |
|---|---|---|---|---|---|---|
| 1 | Antonelli (ANT, champion) | 402 | 9 | 3 | 4 | 152 ahead |
| 2 | Verstappen (VER) | 304 | 4 | 5 | 4 | 54 ahead |
| 3 | Hamilton (HAM) | 267 | 1 | 3 | 3 | 17 ahead |
| 4 | Russell (RUS) | 264 | 3 | 4 | 1 | 14 ahead |
| 5 | Norris (NOR) | 264 | 3 | 2 | 2 | 14 ahead |
| 6 | **Leclerc (LEC)** | **250** | 1 | 3 | 2 | 0 |
| 7 | Piastri (PIA) | 167 | 0 | 1 | 2 | 83 behind |
| 8 | Hadjar | 122 | | | | 128 behind |

Wins, seconds and thirds count Grands Prix only. Russell is ahead of Norris on equal points because of more second places (4 against 2) with equal wins: the countback at work. Source for the "eliminated since round 18" wording: [Wikipedia, 2026 season](https://en.wikipedia.org/wiki/2026_Formula_One_World_Championship) (VERIFIED: Leclerc was "eliminated from championship contention for the first time since 2020" at the US GP); the official F1 and AP pages were only seen as search snippets (UNVERIFIED).

### 7.2 Scoring and tie-break (FIA 2026 Formula 1 Regulations, Section A, Article A2)

Document: [Section A, Issue 03, 2026-06-25](https://www.fia.com/system/files/documents/fia_2026_f1_regulations_-_section_a_general_provisions_-_iss_03_-_2026-06-25.pdf) (VERIFIED, read from the PDF; listing at [fia.com regulations](https://www.fia.com/regulation/category/110); UNVERIFIED that Issue 03 is the very latest). The points are in Section A, not in the sporting section B.

| Item | Rule | Status |
|---|---|---|
| Title | A2.1: "The Drivers' Championship title will be awarded to the F1 Driver who has scored the highest number of points, calculated in accordance with Article A2.2" | VERIFIED |
| Race points | A2.2.1: 25-18-15-12-10-8-6-4-2-1 for places 1 to 10 when the winner completed 75 percent or more of the distance; shorter races use reduced columns (for example 50 to under 75 percent: 13-10-8-6-5-4-3-2-1; the full table is in the PDF) | VERIFIED |
| Sprint points | A2.2.2: 8-7-6-5-4-3-2-1 for places 1 to 8, only if the sprint leader completed at least 50 percent of the sprint distance | VERIFIED |
| Fastest lap | no point (no clause; the recomputed totals match without one) | VERIFIED |
| Countback | A2.1 sub-para c: if points are equal, the higher place goes to "The holder of the greatest number of first places in a race", then second places, then third places "and so on until a winner emerges"; if that fails, the same criteria apply to the qualifying results | VERIFIED |

Open points: the paragraph number of the title and tie-break clauses cannot be cited more exactly than "A2.1, sub-para c" (the PDF text is garbled around the numbering, UNVERIFIED that it is A2.1.5). Whether a sprint win counts as a "first place in a race" is not settled by the clause; Richard and I counted Grand Prix places only, and that reproduces the Jolpica order exactly. Say so in the window's footnote.

### 7.3 Rounds and sprints left (Jolpica schedule and OpenF1, fetched 2026-11-26, VERIFIED)

The 2026 calendar ended up with 23 rounds: the April Bahrain and Saudi Arabian rounds are flagged `is_cancelled: true` in OpenF1 and the "Bahrain GP" was run at Sepang as round 16 (Wikipedia attributes the change to the Iran war; see question 1). Sprints were at rounds 2, 4, 5, 9, 12 and 17, all done.

| Round | Event | Race (UTC) | Circuit local | Sprint |
|---|---|---|---|---|
| 22 | Qatar GP, Lusail | 2026-11-29 16:00Z | 19:00 (UTC+3) | no |
| 23 | Abu Dhabi GP, Yas Marina (finale) | 2026-12-06 13:00Z | 17:00 (UTC+4) | no |

Sources: [Jolpica 2026 schedule](https://api.jolpi.ca/ergast/f1/2026.json), [OpenF1 meetings 2026](https://api.openf1.org/v1/meetings?year=2026) (Qatar gmt_offset 03:00:00, Abu Dhabi 04:00:00). The local 17:00 for Abu Dhabi is my +4 conversion. **Remaining: 2 races, 0 sprints. The most points left for anyone: 2 x 25 + 0 x 8 = 50.**

### 7.4 The rule: is the title still possible?

MaxLeft = (races left x 25) + (sprints left x 8). A driver is alive for the title if the leader's points minus his own are **less than** MaxLeft. If the gap **equals** MaxLeft he can only tie, and the countback decides (he needs more wins than the leader after winning everything). If the gap is **larger** he is out. This is the usual convention (the leader scores nothing, the challenger wins everything): the pairwise test is necessary, and in rare cases not sufficient, because a third driver can block; with two races left an exact check is cheap (see 7.6). The same rule says when a champion is crowned: the leader's lead over second place is larger than MaxLeft.

| After round | Leader | LEC | Gap | Left (races + sprints) | MaxLeft | LEC |
|---|---|---|---|---|---|---|
| 15 Azerbaijan | ANT 302 | 179 | 123 | 8 + 1 | 208 | alive |
| 16 Bahrain GP (Sepang) | ANT 320 | 191 | 129 | 7 + 1 | 183 | alive |
| 17 Singapore | ANT 340 | 215 | 125 | 6 + 0 | 150 | alive |
| **18 United States (2026-10-25)** | ANT 365 | 233 | **132** | 5 + 0 | **125** | **out** |
| 19 Mexico City | ANT 380 | 245 | 135 | 4 + 0 | 100 | out |
| 20 Brazil | ANT 390 | 249 | 141 | 3 + 0 | 75 | out |
| 21 Las Vegas | ANT 402 | 250 | 152 | 2 + 0 | 50 | out |

Recomputed from the per-round Jolpica standings (VERIFIED, local files, 2026-11-26). Antonelli's clinch: after round 18 the lead over Russell was 123 against 125 left (not yet); after round 19, 380 - 261 (Verstappen) = 119 against 100 left: champion at the Mexico City GP (round 19, 2026-11-01). Today the lead over Verstappen is 98 against 50.

### 7.5 Where Charles can still finish

- **Title:** 152 behind with 50 left. Not possible (since round 18).
- **Second place:** Leclerc's maximum is 250 + 50 = 300, Verstappen has 304 and cannot lose points. Not possible.
- **Behind him:** Piastri's maximum is 167 + 50 = 217, below Leclerc's 250. Charles is certain to finish at least 6th.
- **Third place** (the best still possible) needs him to finish ahead of Hamilton (267), Russell (264) and Norris (264).

### 7.6 Plain-words scenarios (two races, no sprints, 25 points for a win)

Rule in one line: over Qatar and Abu Dhabi, Charles must score at least **18 more** points than Hamilton (17 more is enough only if the countback favours him), and at least **15 more** than Russell and than Norris (14 only on a better countback).

I checked this exactly by enumeration (a scratch script on the local Jolpica files, not part of any deliverable): for Leclerc, Hamilton, Russell and Norris in each of the two races, every combination of finishing place from 1st to 10th or "no points", one driver per place, the other 16 drivers filling the rest, with the countback applied from the real position counts (positions 11 and lower lumped together). Of 72,267,001 outcomes, 3,744,591 leave Charles third. The Leclerc point gains that can still work are 17 to 31, 33, 35 to 37, 40, 43 and 50 (these are counts of outcomes, not probabilities).

Worked examples on today's numbers (the examples below are my arithmetic from the table in 7.1):

| What Charles does | His total | What the others must not do |
|---|---|---|
| Wins both races | 250 + 50 = 300 | Hamilton must not finish 2nd twice (303 beats 300; 2nd and 3rd gives 300 and Charles wins that tie on wins, 3 against 1); Russell and Norris must not finish 2nd twice (300 each is a tie that they win on second places: Russell 6 against 3, Norris 4 against 3) |
| Wins one, 2nd in the other | 250 + 43 = 293 | Hamilton may add at most 26 points over the two races (a tie at 293 goes to Charles on countback), Russell and Norris at most 28 (a tie at 293 goes to them) |
| 2nd and 2nd | 250 + 36 = 286 | Hamilton at most 19, Russell and Norris at most 21, so all three must have a poor weekend |

The thresholds in the last two rows come from a second scratch check (every pair of finishes for one rival at a time, countback applied); they hold for each rival taken alone, and only one driver can take each place in each race.

The sentence the window can show today: "Charles cannot win the title any more, it is Antonelli's since Mexico City. He is 6th with 250 points; third is still possible if he beats Hamilton by 18 points and Russell and Norris by 15 over the last two races." The sum goes on one line, for example `250 + 50 = 300 < 304 (Verstappen)`: second place is out of reach.

### 7.7 What the window shows, in every state

Three states from the rule in 7.4 (the state is computed after each race from the standings, never typed in):

| State | When | Headline | Shows |
|---|---|---|---|
| Alive | gap < MaxLeft | "Charles can still be champion" | the gap to each rival, MaxLeft, the points he needs in the races left, two to four scenarios in plain words, the countback rule in one line |
| Alive on countback only | gap = MaxLeft | "Only if he wins every race left and the leader scores nothing" | the same plus the countback comparison |
| Eliminated (today) | gap > MaxLeft | "Not this season. Mathematically out since the United States GP (round 18, 25 Oct 2026)" | the champion and the round he clinched; Charles's place and points (6th, 250); the best finish still possible (3rd) with the sentence above; the round-by-round table from 7.4 ("when it was decided") |

**After the finale (6 December 2026):** "2026 final: Antonelli champion; Charles Nth with N points", then a switch to the 2027 view. **Between seasons:** the 2027 calendar has 24 rounds, opening at the Bahrain GP on 14 March 2027 and ending at the Abu Dhabi GP on 12 December 2027, with 10 sprint events ([Wikipedia, 2027 season](https://en.wikipedia.org/wiki/2027_Formula_One_World_Championship), VERIFIED; the official F1 announcement was only a search snippet, UNVERIFIED; Jolpica's 2027 schedule is still empty, so this calendar comes from Wikipedia until Jolpica or OpenF1 publish it). Before round 1 the window reads: "Season starts 14 March in Bahrain. 680 points to win (24 x 25 + 10 x 8). Everyone, Charles included, is on 0." The standings are per season, so everyone restarts at 0 (VERIFIED: Jolpica `/2027/driverstandings` is empty).

Data to store (question 6): the standings after each round (a small series per season), the count of finishing positions 1 to 10 per driver, per-round MaxLeft, and the sprint flags per round. The scenario text is generated by code from these numbers; an AI call is not needed for it, and must not be used on Formula 1 results (question 1).

### 7.8 Recommendation

Build the window as a pure function of the standings (points, position counts, rounds and sprints left): the three-state rule of 7.4, the exact enumeration for the last few races (cheap with 2 or 3 races left, so the third-place sentence is exact, not a rule of thumb), a one-line sum, the countback footnote, and the next-season view. Ship it with the honest "eliminated" copy: today it should not promise a title route. **Main alternative:** the simple pairwise rule only (no enumeration), with "third place is still possible" and the two margins (18 and 15), which is correct to within the ties but cannot answer precise "what if" cases.

Not verified: the exact paragraph number of the title and tie-break clauses, whether Section A Issue 03 is the latest, whether a sprint win counts in the countback, the official F1 and AP wording of Antonelli's clinch, and the 2027 sprint count beyond Wikipedia.

## 8. Art sources: liveries, F2 and F3 colours, the helmet, and what you may use

**Short answer.** Draw everything yourself from colours, shapes and numbers; use no logo, no wordmark, no sponsor patch and no photograph of a real helmet or car. The three car liveries and the helmet are well described in text, the F2 and F3 colours are a choice for you, and the rights picture is: colours, simple shapes, race numbers and national flags are low risk; the LEGO logo, the Prancing Horse, series logos and a photo-real face are not. This is research, not legal advice; for anything beyond a private app on your own devices (a store listing, a sale, ads), ask a qualified IP lawyer.

### 8.1 The three liveries (fetched 2026-11-26)

| Car | What the sources say | Sources | Status |
|---|---|---|---|
| **Ferrari SF-26** (F1) | Leclerc #16, Hamilton #44. Glossy red ("a return to glossy paint after seven years of the previously in-vogue matte look"), more white than before on the engine cover and airbox area, "Both the front and rear wings are left black, as well as the lower portion of the bodywork", jagged shark fin, inspired by the 312T. No yellow mentioned in any source read | [Planet F1](https://www.planetf1.com/news/ferrari-unveils-sf-26-livery-as-hamilton-and-leclerc-prepare-for-fiorano-shakedown), [Sky Sports](https://skysports.com/f1/news/12433/13497629/ferrari-sf-26-reveal-lewis-hamilton-charles-leclercs-2026-car-launched-as-italian-team-look-for-improved-season), [Sports Illustrated](https://www.si.com/onsi/f1/news/ferrari-reveals-new-look-livery-as-sf-26-launched), [Motor Sport](https://www.motorsportmagazine.com/articles/single-seaters/f1/2026-ferrari-f1-car-launch/), [The Race](https://www.the-race.com/formula-1/ferrari-2026-f1-car-serrated-shark-fin-engine-cover/), [F1 numbers](https://www.formula1.com/en/latest/article/all-the-2026-f1-driver-numbers-confirmed-in-full.5rh7o9mPntG7NerzVk9onc) | VERIFIED; outlets differ on which parts are white (check one official photo); no official colour values |
| **Ferrari 499P #50 and #51** (WEC) | Presented 25 February 2026: "a predominant Rosso Scuderia finish - presented in a new gloss version rather than matte"; the same red as the SF-26; a Giallo Modena (yellow) arrow "now pointing toward the rear wing"; laurels on the front wheel arches; the nose number circle "left free"; a double stripe round the cabin. #50 Fuoco, Molina, Nielsen; #51 Giovinazzi, Pier Guidi, Calado, with champion crowns above their names as the only visible difference | [FIA WEC](https://www.fiawec.com/en/news/ferrari-launches-title-defence-with-maximum-focus-and-a-lot-of-energy/8641), [Autodesign](https://autodesignmagazine.com/en/2026/02/ferrari-499p-a-new-livery-to-celebrate-wec-victories/), [Motorsport.com Spain](https://es.motorsport.com/wec/news/ferrari-presenta-499p-2026-laureles-bandera-mundial/10800313/), [24h-lemans.com](https://www.24h-lemans.com/en/news/ferrari-reveals-499p-livery-for-2026-60347), [Wikipedia](https://en.wikipedia.org/wiki/Ferrari_499P) | VERIFIED; number colours not found |
| **F1 Academy, the LEGO team's car** | One car, LEGO's own: LEGO Racing #32, Esmee Kosterman, run by MP Motorsport (announced at the Las Vegas GP, 19 November 2025). LEGO's design article: "the team gravitated towards yellow, a signature LEGO shade, together with black"; "Pink and light blue stripes were added to incorporate the F1 ACADEMY's own colour scheme."; a chequered flag design "that appears to be peeling away at the edges" because of speed. Chassis Tatuus T-421 (an F4-class car). A LEGO Speed Champions set 77258 exists | [LEGO, announcement](https://www.lego.com/en-ae/aboutus/news/2025/november/lego-f1-academy-partnership-announcement---las-vegas), [LEGO, design article](https://www.lego.com/en-ae/aboutus/news/2025/december/fast-work-designing-the-lego-group-s-new-f1-academy-racing-car-and-a-lego-set-to-match) (re-fetched 2026-11-26: it gives the colours but no racing number, the number is on the announcement page), [F1.com](https://www.formula1.com/en/latest/article/lego-racing-to-join-f1-academy-grid-in-2026-in-new-multi-year-partnership.1SubSn34RGiyVgfjnnBSII), [F1 Academy teams](https://www.f1academy.com/Latest/1wRtcd5TgEEhWZuAbdje1U/who-are-the-2026-f1-academy-teams) | VERIFIED; the exact stripe layout was not found (the LEGO set page returned 403) |

Your request says "F1 Academy in the lego team's colours": LEGO is not an F1 team, so the match is LEGO Racing #32. If you meant a different team's colours, tell me in the form below.

Colour values: the sources give names, not hex codes. The values I propose (my eyeballed proposals, not sourced) are Rosso Scuderia gloss about #D40000 to #E00000, white #F2F2F2, black #111111, Giallo Modena about #FFD500 to #FFF200, LEGO yellow #FFD500, pink #F0589B, light blue #8CCBEF.

Recommended models: **F1** red body, white engine cover with a jagged shark fin, white band round airbox and halo, black wings and lower body, #16 (the nose number is my design choice). **WEC** the same red, a closed-cockpit hypercar shape (the only way to tell it from the F1 car at brick scale, since the reds are identical), the yellow arrow to the rear wing, double yellow cabin stripe, numbers 50 and 51 on the doors (white on red reads best, UNVERIFIED as the real colour), a small crown on #51 or skip it. **F1 Academy** yellow body, black bands and wings, thin pink and light blue stripes, a plain generic chequer band (do not copy LEGO's peeling-flag artwork), a small open-wheel single-seater, #32. Leave out the HP, Shell and sponsor panels, the Scudetto and the Prancing Horse.

### 8.2 F2 and F3 colours (your request names none)

| Fact | Source | Status |
|---|---|---|
| Both series' logos were refreshed on 1 June 2026: "Both logos have been simplified into a single-colour design"; F2 "keeps its blue scheme"; F3 "adopts a bold new orange colour, replacing the previous grey and red palette" | [FIA](https://api.fia.com/news/fia-formula-2-and-fia-formula-3-unveil-new-championship-logos) | VERIFIED |
| The 2027 F2 car (shown at Monza on 5 September 2026) keeps the 2026 Dallara chassis; the pages give no colours | [FIA](https://api.fia.com/news/fia-formula-2-unveils-its-new-car-2027-2029-seasons), [Crash.net](https://www.crash.net/f2/news/1103606/1/first-look-f2-launch-next-generation-car-monza) | VERIFIED; colours not found |
| Leclerc's teams: Prema (F2 title 2017, red) and ART Grand Prix (GP3 title 2016, black and red) | [Wikipedia Prema](https://en.wikipedia.org/wiki/Prema_Racing), [team colours, Prema](https://teamcolorcodes.com/prema-racing-color-codes/), [ART](https://teamcolorcodes.com/art-grand-prix-color-codes/) | VERIFIED (third-party colour site, not official) |

Recommended: **F2 blue** and **F3 orange**, the series' own colours, current as of 2026-11-26, distinct from the Ferrari reds and the yellow of F1 Academy, and they need no team permission. Proposals: blue about #1C5FD8, orange about #FF7A00 (my eyeballed values). Second choices, if you want Leclerc's history instead: Prema red (it clashes with the Ferrari reds in the menu) for F2 and ART black with red accents for F3. The shapes: F2 a wide, heavier single-seater with halo and F1-style wings, F3 slightly smaller with simpler wings. You listed Formula 3 twice, so this answer covers one F3 (see the questions at the end).

### 8.3 Leclerc's helmet and the app icon

| Fact | Source | Status |
|---|---|---|
| 2026 helmet: "So I've kept a similar base to last year, obviously red and white." and "I added my favourite colour, which is baby blue"; the red and white are the Monaco flag's; designer Adrien Paviot, made by Bell | [Motorsport.com](https://au.motorsport.com/f1/news/charles-leclerc-unveils-2026-f1-helmet-ahead-of-ferrari-season-launch-event/10791302/), [GPblog](https://www.gpblog.com/en/news/charles-leclerc-reveals-baby-blue-twist-on-ferrari-helmet-for-2026-season), [NSS Sports](https://www.nss-sports.com/en/interviews/44572/charles-leclerc-ferrari-helmet-design) | VERIFIED |
| The 2022 Monaco design was "red at the top and white at the bottom to resemble the Monaco flag"; whether the 2026 dome is red over white was not confirmed in text | NSS Sports | VERIFIED / UNVERIFIED for 2026 |
| Monaco 2026 one-off: "predominantly white with bold red accents" | [Formula1.com](https://www.formula1.com/en/latest/article/all-the-liveries-special-helmet-designs-and-eye-catching-looks-for-monaco.B2w22A5AjE8qtqhuIvqnL) | VERIFIED |
| Open pictures on Wikimedia Commons: two museum photos of the 2014 and 2018 helmets, CC BY-SA 4.0 (author 5225C), and Jen Ross 2020 test photos, CC BY 2.0. None shows the current design; a Creative Commons licence covers the photographer's rights only, not the helmet artwork or the sponsor marks in the picture; CC BY-SA means a derivative must carry the same licence | [Commons category](https://commons.wikimedia.org/wiki/Category:Helmets_of_Charles_Leclerc) | VERIFIED for three files; the other three files not read |

Recommended icon: an original side-on full-face helmet drawn by you, **red dome over a white lower half** (the Monaco-flag layout), a thin **baby-blue** line along the visor edge, a dark visor, with a bold "16" only at the larger sizes (192 and 512 px; at 48 px no text is readable). Leave out the sponsor patches, the "Papa" and "Jules" tributes, the Bell mark and anything Ferrari. Use photos only as a reference, trace nothing from the two CC BY-SA files. Proposed values: red #CE1126 (Monaco red, UNVERIFIED), white #F5F5F5, baby blue #89CFF0 (the standard shade, UNVERIFIED as Leclerc's own), visor #14161A. **Main alternative:** the white-with-red Monaco 2026 helmet, a one-off that loses the red-over-white read at small size.

### 8.4 What you may and may not use (private PWA on your own devices, no sale, no ads)

| Owner | What the rule says (quoted) | Source | Status |
|---|---|---|---|
| LEGO | "We must, therefore, insist that the LEGO logo NEVER be used on an unofficial web site."; the word mark may be used non-commercially to refer to LEGO products, "The LEGO trademark should not be incorporated into an Internet address."; named trademarks include the Minifigure | [LEGO Fair Play](https://www.lego.com/en-us/legal/notices-and-policies/fair-play/), [LEGO legal notice](https://www.lego.com/en-us/legal/notices-and-policies/legal-notice/) | VERIFIED; the pages say nothing about fan renders |
| Formula 1 | "be clear that what you are doing is not official, approved or endorsed by us"; "not use our Logos"; word marks "to inform, not to brand", never "to brand any game"; event titles in BLOCK CAPITALS; unofficial sites should say "This website is unofficial and is not associated in any way with the Formula 1 companies." | [F1 guidelines](https://www.formula1.com/en/toolbar/guidelines.html), [F1 legal notices](https://formula1.com/en/information/legal-notices.7egvZU48hzrypubGBNcQKt) | VERIFIED |
| FIA | Clause 2.3: "All names and logos of FIA championships ... are the exclusive property of the FIA", usable only with its consent or under its guidelines | [FIA website terms](https://www.fia.com/sites/default/files/basicpage/file/Terms%20and%20Conditions%20FIA%20Website.pdf) | VERIFIED (decoded by us, one page readable) |
| Ferrari, WEC, F2, F3, F1 Academy | no first-party legal text could be read (ferrari.com and fiawec.com legal pages returned empty, 403 or 404) | tried | UNVERIFIED |
| Drivers' likeness | no Leclerc or F1 text about fan likeness found; US law summaries only: a literal depiction is less likely to count as "transformative" than a stylised one; Monaco, French and EU law not covered | secondary sources | UNVERIFIED |

**Leave out** (art, UI, app name, URL): every logo and wordmark (LEGO, Ferrari Prancing Horse and Scudetto, F1, FIA, F2, F3, F1 Academy, WEC, Le Mans, team and sponsor logos); "LEGO", "F1", "Formula 1" or "Ferrari" in the app name or URL; an embossed "LEGO" on the studs, copies of LEGO instructions or the layout of set 77258, an exact minifigure copy; photo-real faces and press photos; wording that sounds like endorsement. **Safe** (my judgment): colours, drawn shapes, race numbers (16, 44, 50, 51, 32), plain national flags, the generic chequered flag, a plain laurel, plain series names as tab labels, F1 event titles in capitals, and an About line: "This app is unofficial and is not associated in any way with the Formula 1 companies, the FIA, Ferrari, the LEGO Group, or any team, driver or series." Say "brick-style" in the UI copy rather than "LEGO"; if the word LEGO appears, use LEGO's own disclaimer sentence ("LEGO® is a trademark of the LEGO Group of companies which does not sponsor, authorize or endorse this site"), though LEGO itself notes that "a disclaimer will not serve to undo an improper trademark use". The Leclerc head should be a generic blocky figure that is stylised, not a minifigure copy and not a photo-real face.

### 8.5 How to produce it (your standing graphics rule)

Icons and the series cars are drawn as vector (SVG) wherever vector renders the brick look properly; the floating Leclerc head, where you asked for a Blender render (real plastic material and lighting), is the case your rule reserves for the local portable Blender, run headless with its script kept in the work's own folder. When the art is built, offer four genuinely different HTML proposals before you pick, as your rule says. Flag sources for the calendar are in question 4.

### 8.6 Recommendation

Colours, shapes and numbers only; LEGO Racing #32 for F1 Academy; blue F2 and orange F3 (series colours); the red-over-white helmet with a baby-blue accent and a "16"; no logos anywhere; an About line with the unofficial notice; a neutral app name and URL. **Main alternative:** abstract the cars further (no recognisable body details) if you ever want to share the app publicly or list it in a store, and take real advice before that.

Conflicts between sources, carried honestly: SF-26 white versus red areas (outlets differ), minimum mass 768 versus 770 kg, F1 Academy engine 165 versus 174 hp, LEGO "Tatuus T-421-F1A" versus Wikipedia "F4-T421", 499P battery 800 versus 900 V, Leclerc's 2025 helmet number 15 versus 16 (F1.com confirms #16). None changes the art. Not verified: official colour values for any livery, Ferrari, WEC, F2, F3 and F1 Academy legal text, the colours of the F2 and F3 show cars and ART's 2016 livery, the exact LEGO Racing stripe layout, 2026 helmet dome layout in detail, publicity law for Monaco, France and the EU, and the exact scope of the LEGO Minifigure trademark.

## 9. The desktop app and the Chrome app (the parity standard)

**Short answer.** Build rawe_ceek in the shape your apps are moving to, not the Electron shape they have today: a PWA on pwa-kit (Vite and React, `api/` on Vercel), Firestore as the store of record, and a small plain-Node local service on your PCs that does the scraping, the timed jobs and the AI calls. "The desktop app" then means the installed Chrome app on a PC-sized window plus that service. Two prerequisites exist only on unmerged branches or open items today (the local service with its lease, and the app template), so RW.SCAFFOLD needs a decision on ordering (see 9.4). The scraping and AI functions must also respect one hard limit found in this research: Formula 1's own guidelines forbid text and data mining and AI use of its data (see question 1).

### 9.1 What exists today (local files, read on 2026-11-26)

| Piece | State | Where | Status |
|---|---|---|---|
| App layout to mirror | Vite and React page at the root (`src/`, `public/`, `pwa.config.ts`), `api/` for Vercel with shared code in `lib/`, `vercel.json`, `firestore.rules` | `C:\git_personal\smakmal` (SmakMal), `lego-tracker`, `budget-tracker` | VERIFIED |
| PWA on pwa-kit | v0.3.0 on master: worker, manifest, install and update flow, `push` and `push/server`, `browser` (`appBrowser`, `openApp`) | `C:\git_personal\pwa-kit\README.md:10-30,225-306` | VERIFIED |
| Firestore client model | desktop-kit `sync`: persistent cache, config at run time, jobs, backup writer | `C:\git_personal\desktop-kit\src\sync\*.ts`, README:358-553 | VERIFIED (on main, HEAD `18f748a`) |
| Scraper | `desktop-kit/scraper`: one Playwright module, installed Chrome or Edge, started over a pipe only; "A debugging port or an inspector flag among `args` is refused"; one job at a time, 4-minute limit, 1.5 to 3.5 s person-paced gap | desktop-kit README:555-619 | VERIFIED (on main) |
| Local service | plain `node`, binds `127.0.0.1` only (port 47380), per-machine switch, `GET /health?app=<app>`, Startup shortcut at login, "leased" services (timed jobs and scrapers, one holder at a time through a Firestore lease document) and "local" services | `C:\git_personal\_wt-chrome-lease` README:710-1070; branches `item/CHROME.SERVICE`, `item/CHROME.LEASE` | VERIFIED, **not on main** |
| Service tray with a count per app, click opens the Chrome app through `openApp --app-id` | open items CHROME.TRAY, CHROME.TRAY.APPS, CHROME.BADGE | items store | VERIFIED (open) |
| App template | `desktop-kit/template` does not exist; APPS.TEMPLATE (open) was re-scoped on 2026-11-21 from Electron to "a PWA on pwa-kit plus an optional service" | `items.json` key APPS.TEMPLATE; `ls C:\git_personal\desktop-kit\template`: not found | VERIFIED |
| AI calls in your apps | Gemini with the key from the environment only: `gemini-2.5-flash` first, other models in turn on 429 or 503 (SmakMal `lib\server-api.ts:26,65`, Brick Tracker `lib\server-api.ts:66-69,306-312`); BrickBudget's Chrome replacement (open CHROME.BT.GEMINI) uses `BRICKBUDGET_GEMINI_API_KEY`, "read at each call"; the Claude route uses Claude Code's own sign-in and no key | as listed | VERIFIED |
| The parity standard | APPS.PARITY-RULE, 2026-11-23: "On a PC, each of the user's own Chrome apps acts exactly like its desktop app, in looks and in function. The desktop layout shows in a PC-sized window; the phone keeps its own layout." Every gap becomes a work item after the item it extends | `C:\Users\zoltan.gyorkei\.claude\CLAUDE.md:193`; desktop-kit branch `item/APPS.PARITY-RULE` README:397-403 | VERIFIED |

### 9.2 What rawe_ceek needs (the checklist, condensed)

1. **The page**: Vite and React PWA on pwa-kit, offline shell, install flow, `vercel.json` rewriting `/api/(.*)` to one function (`smakmal/vercel.json:48-51`, `smakmal/src/sw/sw.ts:6-12`).
2. **Data**: Firestore with the model, rules and offline cache of question 6; the web config read at run time, never baked into the build (`desktop-kit/src/sync/config.ts:1-23`).
3. **The service** (plain Node, loopback only, a per-machine switch, a log, a health route, leased services for the timed jobs): `rc-sync` (calendar, session times, circuit data, every 30 minutes), `rc-results` (after a session ends: classification and standings, poll until the series' source publishes), `rc-standings` for the champion window (question 7). One lease holder at a time, so two PCs never both write.
4. **Writer credentials**: service account over REST, key file path from an environment variable you set, never a key store (question 6).
5. **Scraper**: only where no structured source exists, through `desktop-kit/scraper` (installed Chrome or Edge over a pipe, never a debugging port: your own standing rule).
6. **AI functions**: Gemini, the key from a per-app environment variable (`RAWE_CEEK_GEMINI_API_KEY` is my proposed name; the precedent is `BRICKBUDGET_GEMINI_API_KEY`), read at call time. Suggested uses: turn a messy WEC page or a Wikipedia table into the Firestore model. **Not** over Formula 1 content, and to be safe not over F2, F3 or F1 Academy pages either, because they belong to the same group (question 1). A result summary for a push is built from a fixed template over the numbers, with no AI (question 1 recommends this; it is a form question).
7. **Push**: the question 5 design; the service as an extra caller of the dispatcher.
8. **Tray and count**: the service's tray (open CHROME.TRAY) shows the number of sessions today; left click opens the Chrome app. Badging API on the installed icon (open CHROME.BADGE) could show the same number.
9. **Parity page**: for each desktop feature without a Chrome counterpart, a parity page like `CHROME-BT-PARITY-2026-11-23.html` and a work item. RW.CHROME-PARITY (open) is that check for rawe_ceek.
10. **Secrets**: nothing committed (`.env`, key files, `app-config.json` in `.gitignore`).
11. **Pinning**: desktop-kit and pwa-kit by release tag if DK.RELEASE has made them, otherwise a `file:` link marked temporary (APPS.TEMPLATE prompt). DK.RELEASE status: not checked.
12. **Port and registry**: a fixed loopback port per app and a line in the port list (Brick Tracker 47321, SmakMal 47331, the local service 47380). The Chrome app calls `http://127.0.0.1:47380` from an https page (Private Network Access: the service sets CORS for the app's own origins only).

### 9.3 What the Chrome app can and cannot do for rawe_ceek

| Function | On the phone | In the Chrome app on a PC | In the local service |
|---|---|---|---|
| Calendar, list, popup, weather, champion window | yes (reads Firestore, live weather from the browser) | yes, desktop layout in a PC-sized window | not needed |
| Notifications | yes, Web Push | yes (the same subscriptions) | extra caller of the dispatcher |
| Scrape, timed sync, results fetch | no | no (a browser cannot scrape other sites) | **yes**: the scraper and the leased jobs |
| AI summary or page reading | no | asks the service (`ask`), one short line "needs the service on the PC" when it is off | **yes**, with the key from the environment |
| Open an F1 or WEC site | opens in the browser | opens in a Chrome tab (APPS.TEMPLATE note) | not needed |

Desktop layout (my suggestion for the parity standard): on a PC-sized window the app shows the series menu as a permanent left rail, the calendar and the list side by side, and the day popup as a right-hand panel instead of an overlay; the phone keeps the single-column layout with the hamburger menu you described.

### 9.4 Flags and recommendation

- **Ordering.** RW.SCAFFOLD says "desktop/ on desktop-kit", which is the old Electron shape; it also depends on APPS.TEMPLATE, which is open and re-scoped, and the template folder does not exist. Either wait for APPS.TEMPLATE, or copy SmakMal's layout by hand and add the service from the CHROME.SERVICE branch. The order of the item chain is your call.
- **Local service.** The code exists only on branches `item/CHROME.SERVICE` and `item/CHROME.LEASE` (README read, `.ts` bodies not read). If the mini PC and your PC both run the service, the lease keeps one writer; with a single PC it still works.
- **Key custody.** Your lease README stores the service account key in `%LOCALAPPDATA%\desktop-kit\service\lease\keys\<app>.json` after `lease app add`; your standard says "environment variable". Decide once; my suggestion is one variable per app holding the key file path (question 6).
- **Vercel Schedules is a beta** (question 5), and the reminders on the free plan can be up to about 30 minutes late (a 15-minute trigger plus a 15-minute jitter window). Write that in the popup copy, or accept a finer trigger.
- **Formula 1 data and AI.** Do not feed Formula 1 pages, results or timing data to an AI model or a text-mining step; treat F2, F3 and F1 Academy the same way to be safe. Use structured sources, and a fixed template for result text (question 1). Nothing mandatory in this app needs AI, so the AI part of the service is optional and WEC-only at most.

**Recommendation.** PWA plus local service from the start, no Electron build; the service does the sync, results, standings and the AI summary under the lease; the key file path in an environment variable; Gemini, if at all, for WEC and Wikipedia content only; parity page for each gap. **Main alternative:** the old shape (an Electron desktop app on desktop-kit, as RW.SCAFFOLD's text says): it works today and has a tray, but you are retiring that shape (CHROME.RETIRE), its sign-in and key code leans on Electron `safeStorage`, which your ban forbids agents to run or copy, and the app would have to be rebuilt soon.

Not read: `docs/sync-plan.md`, `docs/research/RQ.715d16-local.md`, the service `.ts` bodies, desktop-kit `scraper/*` code (only its README), the tray design proposals and the chosen pick (`m-ledger.md`), the BrickBudget parity page.
