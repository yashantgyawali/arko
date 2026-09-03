import type { Metadata, Viewport } from "next";
import { Manrope, Patrick_Hand, Atkinson_Hyperlegible } from "next/font/google";
import "./globals.css";
import { HydrationProbe } from "@/components/HydrationProbe";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const patrickHand = Patrick_Hand({
  variable: "--font-patrick",
  subsets: ["latin"],
  weight: ["400"],
});

const atkinson = Atkinson_Hyperlegible({
  variable: "--font-atkinson",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "arko — everyone votes",
  description: "Everyone votes. The room decides what plays next.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // exposes env(safe-area-inset-*) so pinned controls clear the home indicator
  viewportFit: "cover",
  themeColor: "#FAF1E4",
};

/**
 * TEMPORARY on-device diagnostic. Runs as a plain inline script, so it works
 * even if React never hydrates — which is the one failure mode that makes a
 * button look clickable while nothing is wired to it, and that cannot report
 * itself through the app's own error handling. Remove once mobile is sorted.
 */
const ERROR_OVERLAY = `
(function () {
  var seen = 0;
  function show(msg) {
    try {
      var el = document.getElementById('__arko_diag');
      if (!el) {
        el = document.createElement('div');
        el.id = '__arko_diag';
        el.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#130D01;color:#F3B952;font:11px/1.45 ui-monospace,monospace;padding:10px 12px;max-height:45vh;overflow:auto;white-space:pre-wrap;border-top:3px solid #F16147';
        document.body.appendChild(el);
      }
      if (seen++ > 20) return;
      el.textContent += msg + '\\n';
    } catch (e) {}
  }
  // capture:true is required to see FAILED RESOURCE LOADS (script/css). Those
  // fire on the element, not window, so a bubbling listener misses them — and a
  // chunk that never loads is precisely why React would fail to mount.
  window.addEventListener('error', function (e) {
    var t = e.target;
    if (t && (t.tagName === 'SCRIPT' || t.tagName === 'LINK' || t.tagName === 'IMG')) {
      if (t.tagName === 'SCRIPT' && window.__arkoFailed) window.__arkoFailed.push(t.src);
      show('FAILED TO LOAD ' + t.tagName + ': ' + (t.src || t.href || '?'));
      return;
    }
    show('JS ERROR: ' + (e.message || e.error) + '  @' + (e.filename || '?') + ':' + (e.lineno || '?'));
  }, true);
  window.addEventListener('unhandledrejection', function (e) {
    var r = e.reason;
    show('UNHANDLED PROMISE: ' + ((r && (r.message || r.toString())) || 'unknown'));
  });
  window.__arkoDiag = show;

  // Track which scripts actually executed vs failed vs never resolved, so a
  // non-mounting React can be attributed to a chunk problem or ruled out.
  var loaded = [], failed = [];
  document.addEventListener('load', function (e) {
    if (e.target && e.target.tagName === 'SCRIPT') loaded.push(e.target.src);
  }, true);
  window.__arkoFailed = failed;

  setTimeout(function () {
    if (window.__arkoHydrated) return;
    show('HYDRATION: React did not mount after 6s — buttons will do nothing.');
    show('UA: ' + navigator.userAgent);
    var all = [].slice.call(document.querySelectorAll('script[src]')).map(function (s) { return s.src; });
    show('scripts: total=' + all.length + ' executed=' + loaded.length + ' failed=' + failed.length);
    var pending = all.filter(function (s) { return loaded.indexOf(s) < 0 && failed.indexOf(s) < 0; });
    if (pending.length) show('NEVER FINISHED (' + pending.length + '):\\n' + pending.map(shortName).join('\\n'));
    if (failed.length) show('FAILED (' + failed.length + '):\\n' + failed.map(shortName).join('\\n'));
  }, 6000);

  function shortName(u) { try { return String(u).split('/').pop(); } catch (e) { return String(u); } }
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${patrickHand.variable} ${atkinson.variable}`}
    >
      <body>
        <script dangerouslySetInnerHTML={{ __html: ERROR_OVERLAY }} />
        <HydrationProbe />
        {children}
      </body>
    </html>
  );
}
