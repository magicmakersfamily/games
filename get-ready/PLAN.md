# Ready To Go! — where things stand

A departure countdown for families: a big timer that reads your own steps aloud
("brush your teeth", "shoes on") at the times you set, with optional destination and weather.
Folder stays `get-ready/` so shared links keep working (the game was called "Get Ready To Go!"
until 1.3).

## Current release: 1.3 (2026-10-02)

- Timer is large and centred. Steps panel is off by default; the "+ Steps" button opens it and
  the timer shrinks to about 2/3 width.
- Steps: type the words, pick "say it at N min left", then edit the text or re-time each block in
  place. Each step is a dot on the ring. Steps that share a minute play one after another, in the
  order they were added.
- Speech goes through a queue (never `cancel()` right before `speak()`; Chrome drops it), with a
  watchdog. The countdown follows the wall clock, so throttled ticks can't skip a step.
- Weather is off until the user enters a ZIP ("See the Weather"). ZIP → zippopotam.us; current
  conditions from the nearest National Weather Service station; high/low/rain from Open-Meteo.
- Destination: search box (Photon / OpenStreetMap), drive time from OSRM (no traffic), editable
  Leave / Arrive times that set the timer, and an "Open in Google Maps" link.

## Known problem

The OpenStreetMap search suggests intersections and misses many US house numbers, and OSRM
drive times ignore traffic. The family found this confusing. It is the next thing to replace.

## Decided

- **Not Google Maps.** Places/Routes need a billed Cloud key; the free monthly caps (10,000
  autocomplete requests, 5,000 traffic routes) are shared by every visitor, so growth on a public
  site means either a bill or the feature switching off.
- **Apple Maps instead.** The family has joined the Apple Developer Program. MapKit JS gives
  250,000 map views and 25,000 service calls (search, directions/ETA) free per day per membership,
  and the planned App Store app can use native MapKit (MKLocalSearchCompleter, MKDirections with
  traffic) at no per-use cost.
- TomTom (free key, no card, about 2,500 requests/day, real addresses and traffic) is the fallback
  if MapKit JS doesn't work out.

## Next steps

1. Family creates in the Apple Developer account: a Maps ID (`maps.com.magicmakers.games`) and a
   key with MapKit JS enabled for it. They keep the `.p8` file outside this repo and provide the
   Key ID, Team ID and the file's path. Never commit the `.p8` or paste it in chat.
2. Add `tools/mapkit-token` (a script that signs a long-lived JWT with `iss` = Team ID, `kid` =
   Key ID, `origin` = `https://magicmakersfamily.github.io`, about one year `exp`) and put only the
   signed token in the page. Apple's token docs page didn't load when checked; confirm the allowed
   expiry when signing, and shorten it if a one-year token is rejected.
3. Replace Photon/OSRM with MapKit JS: address autocomplete for "Where to?" and "Leaving from"
   (remember home on the device), drive time with traffic via Directions/ETA using the leave or
   arrive time. Keep "Open in Google Maps" and manual minutes as the fallback. Load MapKit only
   when Destination is opened; update the privacy line on the page and the CLAUDE.md exception.
4. Test on a local server (`http://localhost:8765`) and the live site. It cannot work inside the
   claude.ai artifact draft (CSP blocks outside scripts and requests).
5. Later: an iPhone app (native MapKit, reminders that still sound with the phone locked, the
   countdown on the lock screen). List it under Productivity or Lifestyle, not Kids. Check Apple's
   current rules on tip links before adding Ko-fi there.
