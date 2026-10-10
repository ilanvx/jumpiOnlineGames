import UIKit
import WebKit

/// Jumpi Games for iPhone / iPad: the whole game is the website (https://jumpigames.com/play) in a full-screen web view.
/// - always sideways, no status bar, the screen stays on
/// - the page knows it's in the app: "JumpiApp/<version>" in the user agent (body.app: no paid store, no Discord)
/// - only /play stays inside the app; every other page or site opens in Safari
/// - no connection: the Jumpi "no internet" page (offline.html) with TRY AGAIN
/// - window.JumpiAppBridge.retry() / .version() / .openOutside(url), like the Android app
final class GameViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    static let host = "jumpigames.com"
    static let start = URL(string: "https://jumpigames.com/play")!
    private var web: WKWebView!
    private let blue = UIColor(red: 0x1f / 255, green: 0x8f / 255, blue: 1, alpha: 1)
    private var version: String { Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0" }

    override var prefersStatusBarHidden: Bool { true }
    override var prefersHomeIndicatorAutoHidden: Bool { true }
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .landscape }
    override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge { .all }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = blue

        let ctl = WKUserContentController()
        // the same little bridge the Android app has (the page and offline.html call it)
        let shim = """
        window.JumpiAppBridge = {
          retry: function(){ window.webkit.messageHandlers.jumpi.postMessage({a:'retry'}); },
          version: function(){ return '\(version)'; },
          openOutside: function(u){ window.webkit.messageHandlers.jumpi.postMessage({a:'open', url:String(u||'')}); }
        };
        """
        ctl.addUserScript(WKUserScript(source: shim, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        ctl.add(self, name: "jumpi")

        let cfg = WKWebViewConfiguration()
        cfg.userContentController = ctl
        cfg.allowsInlineMediaPlayback = true
        cfg.mediaTypesRequiringUserActionForPlayback = []
        cfg.applicationNameForUserAgent = "Mobile/15E148 JumpiApp/\(version)"
        cfg.websiteDataStore = .default()

        web = WKWebView(frame: view.bounds, configuration: cfg)
        web.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        web.isOpaque = false
        web.backgroundColor = blue
        web.scrollView.backgroundColor = blue
        web.scrollView.bounces = false
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.allowsLinkPreview = false
        web.navigationDelegate = self
        web.uiDelegate = self
        view.addSubview(web)
        web.load(URLRequest(url: Self.start, cachePolicy: .reloadIgnoringLocalCacheData))
    }

    // MARK: where links go
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let u = action.request.url else { return decisionHandler(.cancel) }
        if u.isFileURL || u.scheme == "about" { return decisionHandler(.allow) }
        // pictures, sounds and scripts of the game page load normally; only page changes are checked
        if action.targetFrame?.isMainFrame == false { return decisionHandler(.allow) }
        let h = (u.host ?? "").lowercased()
        let ours = h == Self.host || h == "www." + Self.host
        if u.scheme == "https" && ours && (u.path == "/play" || u.path == "/play/") { return decisionHandler(.allow) }
        openOutside(u)
        decisionHandler(.cancel)
    }

    // window.open / target=_blank: never inside the app
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let u = action.request.url { openOutside(u) }
        return nil
    }

    // the server is restarting (a new version going up): the friendly page instead of a raw error
    func webView(_ webView: WKWebView, decidePolicyFor response: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        if response.isForMainFrame, let r = response.response as? HTTPURLResponse, r.statusCode >= 500 {
            decisionHandler(.cancel); showOffline(); return
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { if !isCancel(error) { showOffline() } }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { if !isCancel(error) { showOffline() } }
    // iOS may close the web page's process in the background: just load the game again
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { webView.load(URLRequest(url: Self.start)) }

    private func isCancel(_ e: Error) -> Bool { (e as NSError).code == NSURLErrorCancelled || (e as NSError).code == 102 }

    private func showOffline() {
        guard let f = Bundle.main.url(forResource: "offline", withExtension: "html") else { return }
        web.loadFileURL(f, allowingReadAccessTo: f.deletingLastPathComponent())
    }

    private func openOutside(_ u: URL) {
        guard u.scheme == "https" || u.scheme == "http" else { return }   // only normal web links (no tel:, sms:, itms:…)
        UIApplication.shared.open(u)
    }

    // alert() / confirm() from the page
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
        present(a, animated: true)
    }
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(false) })
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) })
        present(a, animated: true)
    }

    // MARK: messages from window.JumpiAppBridge
    func userContentController(_ c: WKUserContentController, didReceive m: WKScriptMessage) {
        guard let d = m.body as? [String: Any], let a = d["a"] as? String else { return }
        if a == "retry" { web.load(URLRequest(url: Self.start, cachePolicy: .reloadIgnoringLocalCacheData)); return }
        // only from our own game page
        if a == "open", let s = d["url"] as? String, let u = URL(string: s), let cur = web.url,
           cur.scheme == "https", (cur.host ?? "").hasSuffix(Self.host) { openOutside(u) }
    }
}
