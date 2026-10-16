package com.noshtech.demo;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;
import android.content.Intent;
import android.net.Uri;

/** Lightweight Android wrapper for the hosted NoshTech restaurant demo.
 *  Requires internet connection and the GitHub Pages deployment.
 */
public class MainActivity extends Activity {
  private WebView webView;
  private static final String APP_URL = "https://nosh.ahwad.com/";

  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    webView = new WebView(this);
    webView.setBackgroundColor(0xFFF8FAF5);
    WebSettings settings = webView.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    webView.setWebViewClient(new WebViewClient() {
      @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        Uri uri = request.getUrl();
        if ("https".equals(uri.getScheme()) && "nosh.ahwad.com".equals(uri.getHost())) return false;
        startActivity(new Intent(Intent.ACTION_VIEW, uri));
        return true;
      }
    });
    setContentView(webView);
    webView.loadUrl(APP_URL);
  }

  @Override public void onBackPressed() {
    if (webView != null && webView.canGoBack()) webView.goBack();
    else super.onBackPressed();
  }
  @Override protected void onDestroy() {
    if (webView != null) webView.destroy();
    super.onDestroy();
  }
}
