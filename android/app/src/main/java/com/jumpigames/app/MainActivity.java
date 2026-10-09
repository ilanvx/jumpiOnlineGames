package com.jumpigames.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

/**
 * Jumpi Games: the whole game is the website (https://jumpigames.com/play) in a full-screen WebView.
 * - always sideways (AndroidManifest: sensorLandscape), no status / navigation bars, the screen stays on
 * - the game page knows it's in the app: "JumpiApp/<version>" at the end of the user agent (body.app in the page)
 * - only /play (and the files it loads) stays inside the app; other pages and other sites open in the browser
 * - no connection: a Jumpi "no internet" page with a TRY AGAIN button (assets/offline.html)
 * - back button: closes the open window in the game (Escape); pressed twice quickly on the game itself = leave
 */
public class MainActivity extends Activity {
    static final String HOST = "jumpigames.com";
    static final String START = "https://jumpigames.com/play";
    static final String OFFLINE = "file:///android_asset/offline.html";

    private WebView web;
    private long lastBack = 0;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        Window w = getWindow();
        w.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            w.getAttributes().layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#1f8fff"));
        // the keyboard: the game shrinks above it (so the chat box stays visible), even with the bars hidden
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#1f8fff"));
        root.addView(web, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(root);
        root.setOnApplyWindowInsetsListener((v, in) -> {
            int b;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) b = in.getInsets(WindowInsets.Type.ime()).bottom;
            else { @SuppressWarnings("deprecation") int sb = in.getSystemWindowInsetBottom(); b = sb; }
            v.setPadding(0, 0, 0, b);
            return in;
        });
        hideBars();

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setTextZoom(100);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setSupportMultipleWindows(false);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setAllowFileAccess(false);
        s.setUserAgentString(s.getUserAgentString() + " JumpiApp/" + BuildConfigVersion.NAME);

        CookieManager cm = CookieManager.getInstance();
        cm.setAcceptCookie(true);
        cm.setAcceptThirdPartyCookies(web, false);

        web.addJavascriptInterface(new Bridge(), "JumpiAppBridge");
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                return route(req.getUrl());
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError err) {
                // only when the game page itself can't load (not a picture or a sound)
                if (req.isForMainFrame()) view.loadUrl(OFFLINE);
            }

            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest req, WebResourceResponse res) {
                // the server is restarting (a new version going up): same friendly page instead of a raw error
                if (req.isForMainFrame() && res.getStatusCode() >= 500) view.loadUrl(OFFLINE);
            }
        });

        // always open the game fresh (an old saved page could be stale or come back empty)
        web.loadUrl(START);
    }

    /** true = handled here (opened outside the app); false = load it in the game. */
    private boolean route(Uri u) {
        String scheme = u.getScheme() == null ? "" : u.getScheme();
        String host = u.getHost() == null ? "" : u.getHost().toLowerCase();
        String path = u.getPath() == null ? "/" : u.getPath();
        boolean ours = host.equals(HOST) || host.equals("www." + HOST);
        if (scheme.equals("https") && ours && (path.equals("/play") || path.equals("/play/"))) return false;
        if (scheme.equals("file")) return false;
        openOutside(u);
        return true;
    }

    private void openOutside(Uri u) {
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, u);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, u.toString(), Toast.LENGTH_LONG).show();
        }
    }

    /** window.JumpiAppBridge in the page */
    class Bridge {
        @JavascriptInterface
        public void retry() {
            runOnUiThread(() -> web.loadUrl(START));
        }

        @JavascriptInterface
        public String version() {
            return BuildConfigVersion.NAME;
        }

        @JavascriptInterface
        public void openOutside(String url) {
            runOnUiThread(() -> {
                // only from our own game page, and only normal web links (no market:, tel:, sms: ...)
                String cur = web.getUrl();
                Uri u = Uri.parse(url == null ? "" : url);
                String sc = u.getScheme() == null ? "" : u.getScheme();
                if (cur != null && cur.startsWith("https://" + HOST + "/") && (sc.equals("https") || sc.equals("http")))
                    MainActivity.this.openOutside(u);
            });
        }
    }

    @SuppressWarnings("deprecation")
    private void hideBars() {
        Window w = getWindow();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            w.setDecorFitsSystemWindows(false);
            WindowInsetsController c = w.getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            w.getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideBars();
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        String url = web.getUrl();
        if (url != null && url.startsWith(OFFLINE)) { finish(); return; }
        // the page answers true when the back button closed something (a window, the chat, the phone…)
        web.evaluateJavascript("(function(){try{return window.jumpiAppBack?window.jumpiAppBack():false}catch(e){return false}})()", res -> {
            if ("true".equals(res)) return;
            long now = System.currentTimeMillis();
            if (now - lastBack < 1800) finish();
            else {
                lastBack = now;
                Toast.makeText(this, R.string.back_again, Toast.LENGTH_SHORT).show();
            }
        });
    }

    @Override
    protected void onPause() {
        super.onPause();
        web.onPause();
        CookieManager.getInstance().flush();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        hideBars();
    }

    @Override
    protected void onDestroy() {
        if (web != null) web.destroy();
        super.onDestroy();
    }
}
