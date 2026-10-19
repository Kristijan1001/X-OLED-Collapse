<a href="https://buymeacoffee.com/kristijan1001" target="_blank"> <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" width="160" alt="Buy Me a Coffee"> </a>

# X OLED Collapse

<img src="icon.svg" width="72" align="right" alt="">

A single-file userscript that folds away everything around X/Twitter's timeline.

The left nav rail, the right-hand trends column, the sticky *For you / Following* bar, the
"What's happening?" composer and the floating corner buttons all collapse to pure `#000`,
leaving the posts centred on a black screen. On an OLED panel those pixels are genuinely off —
nothing glowing in the same place for hours, nothing static to burn in.

Nothing is deleted. Every collapsed panel is parked just off-screen and slides back the moment
you push the pointer into its edge.

---

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/).
2. Open [`X-OLED-Collapse.user.js`](X-OLED-Collapse.user.js) and click **Raw** — your manager will offer to install it.
3. Open x.com. Everything folds away on load.

## Using it

Toggles live in the Tampermonkey tray menu (the extension icon while on x.com). Every choice
persists via `GM_setValue`.

| | |
|---|---|
| **Alt + Q** | Hide everything / show everything |
| **Alt + W** | Step the timeline width (wraps around) |
| **Left or right screen edge** | Nav rail / trends column slides in |
| **Top edge** | Tab bar and composer come back |
| **Top-right corner** | X Reels pill |
| **Bottom-right corner** | Grok and chat buttons |
| **Tray menu** | A switch per piece, the width cycle, and *Show everything again* |

To rebind either shortcut, change `HOTKEY_ALL` / `HOTKEY_WIDTH` near the bottom of the script
to any `KeyboardEvent.code` — `'KeyZ'`, `'Backquote'`, and so on. Not `KeyX`: X Reels already
binds `Alt+X`.

### What can be toggled

| Item | Default |
| --- | --- |
| Left nav rail (Home … Post) | hidden |
| Right column (search, trends, who to follow) | hidden |
| Sticky tab bar (For you / Following) + inline composer | hidden |
| Floating corner buttons (Grok, chat dock, X Reels) | hidden |
| True black (`#000` backgrounds) | on |
| Black outlines (grey 1px borders to `#000`) | on |
| Centred timeline | on |
| Hover peek | on |
| Timeline width — cycles 810 / 900 / 1050 / 1200 / 600 / 750 | 810 (X's own is 600) |

## How it works

X ships almost no stable hooks for the parts this script targets, so most of them are found by
shape and re-checked on every DOM mutation — which is what makes them survive re-renders and
SPA navigation.

- **The panels** are collapsed, never `display: none`, so X's React tree stays intact and
  navigation, keyboard shortcuts and the composer keep working. While hidden they are fixed
  off-screen overlays at their real widths, so peeking is a compositor-only
  `transform` + `opacity` slide and the timeline never reflows.
- **The sticky tab bar** is found by walking up from `[role="tablist"]` to the nearest
  `position: sticky` ancestor, falling back to the column-wrapper child holding the tab list.
  Both paths are gated on the candidate looking like a header — no `<article>`, no
  `cellInnerDiv`, at most 160px tall. Without that gate a permalink page (no tablist,
  `[role="heading"]` matching a heading *inside* the post, no sticky ancestor anywhere) makes
  the fallback tag the whole conversation and blank the post.
- **The composer** comes from `[data-testid="tweetTextarea_0"]`, on `/home` only — a post page
  reuses that test id for its reply box. An `<article>` guard backs that up, and the
  full-screen compose dialog is excluded outright.
- **Floating buttons** are matched conservatively: small (max 340x420px) boxes with a
  `position: fixed` ancestor, sitting in a right-hand corner. Anything containing `<main>` is
  never a candidate nor a climb target, and the upward climb aborts as soon as a box exceeds
  the size cap — so a stray match can never fade the whole page out.
- **Width and centring** are the fiddly ones. The 600px cap is re-imposed both on the column's
  ancestors and on the wrappers inside it, so both are lifted with `:has()` rather than inline
  styles — React rewrites inline styles on the home timeline, which made widening hold on post
  pages but not on `/home`. Centring is measured in JS and applied as `margin-left`,
  deliberately not a transform, which would become the containing block for the sticky
  elements inside the column.

## Licence

ISC. See [LICENSE](LICENSE).
