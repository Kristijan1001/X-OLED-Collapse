// ==UserScript==
// @name         X OLED Collapse
// @namespace    x-oled-collapse
// @version      1.9.2
// @description  Collapse X/Twitter's chrome for OLED: left nav, right column, tab bar, composer and the floating corner buttons all fold away to pure black. Centred, widenable timeline, hover any edge to peek a panel back.
// @author       Kristijan1001
// @icon         https://www.google.com/s2/favicons?sz=64&domain=x.com
// @homepageURL  https://github.com/Kristijan1001/X-OLED-Collapse
// @supportURL   https://github.com/Kristijan1001/X-OLED-Collapse/issues
// @downloadURL  https://raw.githubusercontent.com/Kristijan1001/X-OLED-Collapse/main/X-OLED-Collapse.user.js
// @updateURL    https://raw.githubusercontent.com/Kristijan1001/X-OLED-Collapse/main/X-OLED-Collapse.user.js
// @match        https://x.com/*
// @match        https://twitter.com/*
// @run-at       document-start
// @noframes
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @license      ISC
// ==/UserScript==

(function () {
    'use strict';

    /* ------------------------------------------------------------------ *
     * State  (toggles live in the Tampermonkey tray menu)
     * ------------------------------------------------------------------ */

    const DEFAULTS = {
        left:   true,   // left navigation rail (Home / Explore / ... / Post)
        right:  true,   // right column (search, What's happening, Who to follow)
        top:    true,   // sticky "For you / Following" bar + inline composer
        float:  true,   // floating corner buttons (Grok, chat dock, X Reels)
        black:  true,   // force pure #000 backgrounds
        edges:  true,   // paint X's grey hairline borders black too
        center: true,   // keep the timeline centred once the columns collapse
        peek:   true,   // reveal a collapsed area by hovering the screen edge
    };

    const LABELS = {
        left:   'left nav',
        right:  'right column',
        top:    'tab bar + composer',
        float:  'floating buttons',
        black:  'true black',
        edges:  'black outlines',
        center: 'centred timeline',
        peek:   'hover peek',
    };

    const NAV_W = 275;   // px, width the left rail is restored to while peeking
    const SIDE_W = 350;  // px, ditto for the right column

    // Timeline width. 600 is X's own value; 900 is the default here. The menu
    // cycles through the list.
    const WIDTHS = [900, 1050, 1200, 600, 750];
    let width = 900;
    if (typeof GM_getValue === 'function') {
        const stored = parseInt(GM_getValue('width', 900), 10);
        if (WIDTHS.includes(stored)) width = stored;
    }

    const state = Object.assign({}, DEFAULTS);
    for (const k of Object.keys(DEFAULTS)) {
        const v = typeof GM_getValue === 'function' ? GM_getValue(k, DEFAULTS[k]) : DEFAULTS[k];
        state[k] = !!v;
    }

    const root = document.documentElement;

    // Declared up here on purpose: apply() runs before the rest of the file has
    // evaluated, and it calls refresh(). A `let` further down would be in the
    // temporal dead zone and throw before any CSS is injected.
    let scheduled = false;

    function apply() {
        for (const k of Object.keys(state)) {
            root.setAttribute('data-xoc-' + k, state[k] ? '1' : '0');
        }
        refresh();
    }

    function toggle(key) {
        state[key] = !state[key];
        if (typeof GM_setValue === 'function') GM_setValue(key, state[key]);
        apply();
        flash(LABELS[key] + ': ' + (state[key] ? 'hidden' : 'shown'));
    }

    apply();

    /* ------------------------------------------------------------------ *
     * Styles
     * ------------------------------------------------------------------ */

    const CSS = [
        /* ---- left rail / right column -----------------------------------
           Both are parked as fixed off-screen panels the whole time they are
           hidden, and slide in on peek. Flipping to position:fixed *at* peek
           time (pre-1.5.0) meant layout mode, width and opacity all changed in
           the same frame: nothing could animate, and the two sides visibly
           moved in opposite directions. Being fixed also takes them out of
           flow, so the timeline gets the full window. */
        'html[data-xoc-left="1"] header[role="banner"],',
        'html[data-xoc-right="1"] [data-testid="sidebarColumn"] {',
        '    position: fixed !important; top: 0 !important;',
        '    height: 100vh !important;',
        '    z-index: 9000 !important;',
        '    background-color: var(--xoc-bg, #000) !important;',
        '    overflow-y: auto !important; overflow-x: hidden !important;',
        '    opacity: 0 !important;',
        '    pointer-events: none !important;',
        '    will-change: transform;',
        '    transition: transform .2s ease, opacity .2s ease !important;',
        '}',

        'html[data-xoc-left="1"] header[role="banner"] {',
        '    left: 0 !important; right: auto !important;',
        '    width: ' + NAV_W + 'px !important;',
        '    min-width: ' + NAV_W + 'px !important;',
        '    max-width: ' + NAV_W + 'px !important;',
        '    transform: translateX(-100%) !important;',
        '}',
        'html[data-xoc-left="1"] header[role="banner"] > * {',
        '    width: ' + NAV_W + 'px !important;',
        '    min-width: ' + NAV_W + 'px !important;',
        '    max-width: ' + NAV_W + 'px !important;',
        '}',
        'html[data-xoc-left="1"][data-xoc-peekleft="1"] header[role="banner"] {',
        '    transform: translateX(0) !important;',
        '    opacity: 1 !important;',
        '    pointer-events: auto !important;',
        '    box-shadow: 0 0 32px rgba(0,0,0,.95) !important;',
        '}',

        'html[data-xoc-right="1"] [data-testid="sidebarColumn"] {',
        '    right: 0 !important; left: auto !important;',
        '    width: ' + SIDE_W + 'px !important;',
        '    min-width: ' + SIDE_W + 'px !important;',
        '    max-width: ' + SIDE_W + 'px !important;',
        '    transform: translateX(100%) !important;',
        '}',
        'html[data-xoc-right="1"] [data-testid="sidebarColumn"] > * {',
        '    width: ' + SIDE_W + 'px !important;',
        '    min-width: ' + SIDE_W + 'px !important;',
        '    max-width: ' + SIDE_W + 'px !important;',
        '}',
        'html[data-xoc-right="1"][data-xoc-peekright="1"] [data-testid="sidebarColumn"] {',
        '    transform: translateX(0) !important;',
        '    opacity: 1 !important;',
        '    pointer-events: auto !important;',
        '    box-shadow: 0 0 32px rgba(0,0,0,.95) !important;',
        '}',

        /* ---- sticky tab bar + inline composer ---- */
        'html[data-xoc-top="1"] .xoc-topbar,',
        'html[data-xoc-top="1"] .xoc-composer {',
        '    height: 0 !important; min-height: 0 !important; padding: 0 !important;',
        '    margin: 0 !important; border: 0 !important;',
        '    overflow: hidden !important;',
        '    opacity: 0 !important; pointer-events: none !important;',
        '    transition: opacity .12s ease;',
        '}',
        'html[data-xoc-top="1"][data-xoc-peektop="1"] .xoc-topbar,',
        'html[data-xoc-top="1"][data-xoc-peektop="1"] .xoc-composer {',
        '    height: auto !important; min-height: revert !important;',
        '    padding: revert !important; margin: revert !important;',
        '    border: revert !important; overflow: visible !important;',
        '    opacity: 1 !important; pointer-events: auto !important;',
        '}',

        /* ---- floating corner buttons ------------------------------------
           Each corner peeks from its own zone: revealing the top-right pill by
           hovering the bottom-right corner is useless, because it hides again
           on the way over to click it. */
        'html[data-xoc-float="1"] .xoc-float {',
        '    opacity: 0 !important; pointer-events: none !important;',
        '    transition: opacity .12s ease;',
        '}',
        'html[data-xoc-float="1"][data-xoc-peekfloatbottom="1"] .xoc-float-bottom,',
        'html[data-xoc-float="1"][data-xoc-peekfloattop="1"] .xoc-float-top {',
        '    opacity: 1 !important; pointer-events: auto !important;',
        '}',

        /* ---- true black ---- */
        'html[data-xoc-black="1"], html[data-xoc-black="1"] body,',
        'html[data-xoc-black="1"] #react-root, html[data-xoc-black="1"] main,',
        'html[data-xoc-black="1"] [data-testid="primaryColumn"],',
        'html[data-xoc-black="1"] [data-testid="sidebarColumn"],',
        'html[data-xoc-black="1"] header[role="banner"] {',
        '    background-color: #000 !important;',
        '}',
        'html[data-xoc-black="1"] { --xoc-bg: #000; }',

        /* ---- black outlines ---------------------------------------------
           X draws its post separators, column edges, media frames and card
           outlines as 1px rgb(47,51,54) borders. Recolouring rather than
           removing them keeps every layout height identical. */
        'html[data-xoc-edges="1"] main *,',
        'html[data-xoc-edges="1"] [data-testid="primaryColumn"],',
        'html[data-xoc-edges="1"] [data-testid="primaryColumn"] *,',
        'html[data-xoc-edges="1"] [data-testid="sidebarColumn"] *,',
        'html[data-xoc-edges="1"] header[role="banner"] * {',
        '    border-color: #000 !important;',
        '    outline-color: #000 !important;',
        '}',

        /* ---- toast ---- */
        '#xoc-toast {',
        '    position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%);',
        '    z-index: 99999; padding: 8px 14px; border-radius: 9999px;',
        '    font: 500 13px/1.2 system-ui, -apple-system, "Segoe UI", sans-serif;',
        '    color: #fff; background: #1d1d1d; border: 1px solid #333;',
        '    opacity: 0; pointer-events: none; transition: opacity .18s ease;',
        '}',
        '#xoc-toast.xoc-show { opacity: 1; }',
    ].join('\n');

    if (typeof GM_addStyle === 'function') {
        GM_addStyle(CSS);
    } else {
        const s = document.createElement('style');
        s.textContent = CSS;
        (document.head || document.documentElement).appendChild(s);
    }

    /* ------------------------------------------------------------------ *
     * Timeline width
     *
     * The 600px cap lives on the column AND on its ancestors, so widening
     * means lifting every max-width between the column and <main>. Media
     * inside posts is sized in percentages, so it scales along with it.
     * ------------------------------------------------------------------ */

    let widthStyle = null;

    function applyWidth() {
        if (!document.head) return;
        if (!widthStyle) {
            widthStyle = document.createElement('style');
            widthStyle.id = 'xoc-width';
            document.head.appendChild(widthStyle);
        }
        widthStyle.textContent = [
            // Lift the cap on every ancestor of the column. Done with :has()
            // rather than inline styles on purpose -- React re-renders the home
            // timeline and wipes inline styles, which is why widening used to
            // hold on post pages but not on /home.
            'body div:has([data-testid="primaryColumn"]) { max-width: none !important; }',
            '[data-testid="primaryColumn"] {',
            '    width: ' + width + 'px !important;',
            '    max-width: ' + width + 'px !important;',
            '    min-width: 0 !important;',
            '    flex-grow: 0 !important;',
            '    flex-basis: auto !important;',
            '}',
            '[data-testid="primaryColumn"] > div { max-width: 100% !important; }',
            // ...and on the containers *inside* the column that wrap the post
            // list. On /home those re-impose the 600px cap even after the column
            // itself is widened, which is why posts went wide but the feed did
            // not. Matching via the cells means post content is never touched.
            '[data-testid="primaryColumn"] div:has([data-testid="cellInnerDiv"]) {',
            '    max-width: none !important; width: 100% !important;',
            '}',
            '[data-testid="primaryColumn"] [data-testid="cellInnerDiv"] {',
            '    max-width: none !important; width: 100% !important;',
            '}',
        ].join('\n');

        refresh();
    }

    function cycleWidth() {
        const i = WIDTHS.indexOf(width);
        width = WIDTHS[(i + 1) % WIDTHS.length];
        if (typeof GM_setValue === 'function') GM_setValue('width', width);
        applyWidth();
        flash('timeline width: ' + width + 'px' + (width === 600 ? ' (X default)' : ''));
    }

    /* ------------------------------------------------------------------ *
     * Tagging the elements X gives no stable selector for
     * ------------------------------------------------------------------ */

    // Passing el === null just clears the tag from the scope.
    function retag(scope, cls, el) {
        if (el && el.classList.contains(cls)) return;
        scope.querySelectorAll('.' + cls).forEach(n => n.classList.remove(cls));
        if (el) el.classList.add(cls);
    }

    // Sticky header above the timeline ("For you / Following", page titles).
    //
    // A real header is short and contains no posts. Without those two guards the
    // fallback below happily tags the whole conversation on a permalink page --
    // where there is no tablist, [role="heading"] matches a heading *inside* the
    // post, and no sticky ancestor is ever found. That blanks the post.
    const HEADER_MAX_H = 160;   // px

    function isHeaderish(el) {
        if (!el) return false;
        if (el.querySelector('article')) return false;
        if (el.querySelector('[data-testid="cellInnerDiv"]')) return false;
        const h = el.getBoundingClientRect().height;
        return h <= HEADER_MAX_H;
    }

    function tagTopBar() {
        const col = document.querySelector('[data-testid="primaryColumn"]');
        if (!col) return;

        const anchor = col.querySelector('[role="tablist"]') ||
                       col.querySelector('h1, h2, [role="heading"]');
        if (!anchor) { retag(col, 'xoc-topbar', null); return; }

        let el = anchor;
        for (let i = 0; i < 10 && el && el !== col; i++) {
            const pos = getComputedStyle(el).position;
            if (pos === 'sticky' || pos === 'fixed') {
                retag(col, 'xoc-topbar', isHeaderish(el) ? el : null);
                return;
            }
            el = el.parentElement;
        }

        const wrap = col.firstElementChild;
        if (!wrap) { retag(col, 'xoc-topbar', null); return; }
        for (const child of wrap.children) {
            if (child.contains(anchor)) {
                retag(col, 'xoc-topbar', isHeaderish(child) ? child : null);
                return;
            }
        }
        retag(col, 'xoc-topbar', null);
    }

    // Inline "What's happening?" composer at the top of the timeline.
    //
    // Home only. A post page has a *reply* box using the same test id, and the
    // sibling walk below climbs until it wraps the whole conversation -- hiding
    // that blanks the post itself. The article guard is a second backstop.
    const HOME = /^\/(home)?$/;

    function tagComposer() {
        const col = document.querySelector('[data-testid="primaryColumn"]');
        if (!col) return;

        const clear = () => col.querySelectorAll('.xoc-composer')
                               .forEach(n => n.classList.remove('xoc-composer'));

        if (!HOME.test(location.pathname)) { clear(); return; }

        const ta = col.querySelector('[data-testid="tweetTextarea_0"]') ||
                   col.querySelector('[data-testid="tweetButtonInline"]');
        if (!ta) { clear(); return; }
        if (ta.closest('[role="dialog"]')) return;   // never touch the compose modal

        const safe = (el) => el && !el.querySelector('article');

        const cell = ta.closest('[data-testid="cellInnerDiv"]');
        if (cell) { if (safe(cell)) retag(col, 'xoc-composer', cell); return; }

        let el = ta;
        for (let i = 0; i < 12 && el && el !== col; i++) {
            const next = el.nextElementSibling;
            if (next && next.querySelector('[data-testid="cellInnerDiv"]')) {
                if (safe(el)) retag(col, 'xoc-composer', el);
                return;
            }
            el = el.parentElement;
        }
    }

    /* ---- floating corner buttons -------------------------------------
       Scan interactive elements only, keep the ones drawn small and pinned
       to a right-hand corner, then climb to the smallest wrapper that still
       fits the size cap. Two hard stops make blanking the page impossible:
       an element that contains <main> is never a candidate and never a climb
       target, and the climb aborts the moment a box exceeds the cap. */

    const MAX_W = 340;   // px -- the X Reels pill is ~220 wide
    const MAX_H = 420;   // px

    function isChrome(el, main) {
        if (!el || el === document.body || el === root || el === main) return false;
        if (el.id === 'xoc-toast') return false;
        if (el.contains(main)) return false;
        if (el.closest('[data-testid="primaryColumn"]')) return false;
        if (el.closest('[data-testid="sidebarColumn"]')) return false;
        if (el.closest('header[role="banner"]')) return false;
        if (el.closest('[role="dialog"]')) return false;
        if (el.closest('[role="alert"]')) return false;
        if (el.closest('[aria-live]')) return false;
        return true;
    }

    function inCorner(r) {
        if (!r.width || !r.height) return false;
        if (r.width > MAX_W || r.height > MAX_H) return false;
        if (r.right < innerWidth - 160) return false;              // right edge only
        return r.bottom > innerHeight - 400 || r.top < 160;        // bottom- or top-right
    }

    function hasFixedAncestor(el) {
        let cur = el;
        for (let i = 0; i < 12 && cur; i++) {
            if (getComputedStyle(cur).position === 'fixed') return true;
            cur = cur.parentElement;
        }
        return false;
    }

    // Shallow breadth-first sweep for position:fixed boxes. Floating chrome
    // lives near the top of the tree, so a depth cap plus pruning the two
    // columns skips essentially the whole timeline -- which is what keeps this
    // cheap enough to run on every mutation frame.
    const SKIP_SUBTREE = '[data-testid="primaryColumn"], [data-testid="sidebarColumn"],' +
                         'header[role="banner"], [role="dialog"], [role="alert"], [aria-live]';
    const MAX_DEPTH = 14;
    const MAX_NODES = 4000;

    function fixedBoxes(main) {
        const found = [];
        let level = [document.body];
        let seen = 0;

        for (let d = 0; d < MAX_DEPTH && level.length && seen < MAX_NODES; d++) {
            const next = [];
            for (const parent of level) {
                for (const child of parent.children) {
                    if (++seen > MAX_NODES) break;
                    if (child.id === 'xoc-toast') continue;
                    if (child.matches(SKIP_SUBTREE)) continue;
                    if (getComputedStyle(child).position === 'fixed' && !child.contains(main)) {
                        found.push(child);
                    }
                    next.push(child);
                }
            }
            level = next;
        }
        return found;
    }

    function tagFloaters() {
        const main = document.querySelector('main');
        if (!main) return;

        const candidates = [
            ...document.querySelectorAll(
                'button, a, [role="button"], [data-testid="DMDrawer"], [data-testid="GrokDrawer"]'
            ),
            ...fixedBoxes(main),
        ];

        for (const el of candidates) {
            if (el.closest('.xoc-float')) continue;
            if (!isChrome(el, main)) continue;
            if (!inCorner(el.getBoundingClientRect())) continue;
            if (!hasFixedAncestor(el)) continue;   // fixedBoxes() entries pass trivially

            // Climb to the outermost wrapper that is still small and still chrome,
            // so the button's pill background goes with it.
            let target = el;
            let cur = el.parentElement;
            for (let i = 0; i < 8 && cur; i++) {
                if (!isChrome(cur, main)) break;
                const r = cur.getBoundingClientRect();
                if (r.width > MAX_W || r.height > MAX_H) break;
                target = cur;
                cur = cur.parentElement;
            }
            const top = el.getBoundingClientRect().top < 160;
            target.classList.add('xoc-float', top ? 'xoc-float-top' : 'xoc-float-bottom');
        }
    }

    /* ---- centre the timeline ------------------------------------------
       Doing this in CSS never took: X's flex row keeps the column pinned
       left. Measure the natural offset and correct it with margin-left
       (not transform -- a transform would become the containing block for
       the sticky/fixed elements inside the column). */

    function centerColumn() {
        const col = document.querySelector('[data-testid="primaryColumn"]');
        if (!col) return;

        if (!state.center) {
            if (col.dataset.xocShift) {
                col.style.removeProperty('margin-left');
                delete col.dataset.xocShift;
            }
            return;
        }

        const applied = parseFloat(col.dataset.xocShift || '0') || 0;
        const r = col.getBoundingClientRect();
        const naturalLeft = r.left - applied;
        const wanted = Math.max(0, (innerWidth - r.width) / 2);
        const shift = Math.round(wanted - naturalLeft);

        if (Math.abs(shift - applied) < 2) return;   // avoid churn / feedback loops
        col.dataset.xocShift = String(shift);
        col.style.setProperty('margin-left', shift + 'px', 'important');
    }

    function refresh() {
        if (!document.body) return;
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => {
            scheduled = false;
            try { tagTopBar(); } catch (e) {}
            try { tagComposer(); } catch (e) {}
            try { tagFloaters(); } catch (e) {}
            try { centerColumn(); } catch (e) {}
        });
    }

    /* ------------------------------------------------------------------ *
     * Toast
     * ------------------------------------------------------------------ */

    let toastEl = null, toastTimer = 0;
    function flash(text) {
        if (!document.body) return;
        if (!toastEl) {
            toastEl = document.createElement('div');
            toastEl.id = 'xoc-toast';
            document.body.appendChild(toastEl);
        }
        toastEl.textContent = text;
        toastEl.classList.add('xoc-show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toastEl.classList.remove('xoc-show'), 1400);
    }

    /* ------------------------------------------------------------------ *
     * Hover peek
     *
     * Driven straight off the pointer position rather than hit-testing
     * invisible hotspot divs -- X paints plenty of its own layers over the
     * edges, which is what stopped the left rail from ever peeking.
     * ------------------------------------------------------------------ */

    const ZONES = [
        {
            attr: 'data-xoc-peekleft', on: 'left',
            enter: (x, y) => x <= 14,
            stay:  (x, y) => x < NAV_W + 80,
        },
        {
            attr: 'data-xoc-peekright', on: 'right',
            enter: (x, y) => x >= innerWidth - 14,
            stay:  (x, y) => x > innerWidth - (SIDE_W + 80),
        },
        {
            // Stops short of the right edge so it does not fight the
            // top-right float zone.
            attr: 'data-xoc-peektop', on: 'top',
            enter: (x, y) => y <= 12 && x < innerWidth - 280,
            stay:  (x, y) => y < 260,
        },
        {
            attr: 'data-xoc-peekfloattop', on: 'float',
            enter: (x, y) => x > innerWidth - 120 && y < 120,
            stay:  (x, y) => x > innerWidth - 300 && y < 220,
        },
        {
            attr: 'data-xoc-peekfloatbottom', on: 'float',
            enter: (x, y) => x > innerWidth - 120 && y > innerHeight - 280,
            stay:  (x, y) => x > innerWidth - 240 && y > innerHeight - 380,
        },
    ];

    function onMove(e) {
        const x = e.clientX, y = e.clientY;
        for (const z of ZONES) {
            const open = root.getAttribute(z.attr) === '1';
            if (!state.peek || !state[z.on]) {
                if (open) root.setAttribute(z.attr, '0');
                continue;
            }
            if (!open && z.enter(x, y)) root.setAttribute(z.attr, '1');
            else if (open && !z.stay(x, y)) root.setAttribute(z.attr, '0');
        }
    }

    function closeAllPeeks() {
        for (const z of ZONES) root.setAttribute(z.attr, '0');
    }

    function initDom() {
        addEventListener('mousemove', onMove, { passive: true, capture: true });
        document.addEventListener('mouseleave', closeAllPeeks);
        addEventListener('blur', closeAllPeeks);

        applyWidth();
        refresh();
        new MutationObserver(refresh).observe(document.body, { childList: true, subtree: true });
        addEventListener('resize', refresh, { passive: true });
    }

    if (document.body) initDom();
    else document.addEventListener('DOMContentLoaded', initDom, { once: true });

    /* ------------------------------------------------------------------ *
     * Tampermonkey tray menu
     * ------------------------------------------------------------------ */

    const PANELS = ['left', 'right', 'top', 'float'];

    function setPanels(hidden) {
        for (const k of PANELS) {
            state[k] = hidden;
            if (typeof GM_setValue === 'function') GM_setValue(k, hidden);
        }
        apply();
        flash(hidden ? 'everything hidden' : 'everything shown');
    }

    // Alt + HOTKEY flips the lot. Change HOTKEY to any KeyboardEvent.code
    // ('KeyQ', 'KeyZ', 'Backquote', ...) if this one is taken too.
    // Not KeyX -- X Reels already binds that.
    const HOTKEY = 'KeyQ';

    addEventListener('keydown', (e) => {
        if (!e.altKey || e.ctrlKey || e.metaKey) return;
        if (e.code !== HOTKEY) return;
        const t = e.target;
        if (t && (t.isContentEditable || /^(INPUT|TEXTAREA)$/.test(t.tagName))) return;
        e.preventDefault();
        e.stopPropagation();
        setPanels(!PANELS.every(k => state[k]));
    }, true);

    if (typeof GM_registerMenuCommand === 'function') {
        for (const k of Object.keys(LABELS)) {
            GM_registerMenuCommand('Toggle ' + LABELS[k], () => toggle(k));
        }
        GM_registerMenuCommand('Timeline width: cycle ' + WIDTHS.join(' / '), cycleWidth);
        GM_registerMenuCommand('Show everything again  (Alt+Q)', () => setPanels(false));
        GM_registerMenuCommand('Hide everything  (Alt+Q)', () => setPanels(true));
    }
})();
