package com.moktari.app;

import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.animation.AnimatorSet;
import android.animation.ObjectAnimator;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.view.animation.AccelerateDecelerateInterpolator;
import android.view.animation.DecelerateInterpolator;
import android.widget.ImageView;

import androidx.appcompat.app.AppCompatActivity;

/**
 * Animated launch screen shown immediately after the app's native splash screen
 * (Android 12+ uses the platform SplashScreen API themed window; older versions
 * display this activity directly). It runs a short, premium entrance animation
 * for the official Moktari logo and then forwards the original launch intent
 * (deep links / push notification extras) to MainActivity unchanged.
 */
public class SplashActivity extends AppCompatActivity {

    private static final long LOGO_FADE_IN_MS = 500L;
    private static final long LOGO_SCALE_MS = 700L;
    private static final long HOLD_MS = 200L;
    private static final long FADE_OUT_MS = 300L;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setTheme(R.style.AppTheme_NoActionBar);
        setContentView(R.layout.activity_splash);

        final ImageView logo = findViewById(R.id.splash_logo);
        logo.setAlpha(0.35f);

        ObjectAnimator fadeIn = ObjectAnimator.ofFloat(logo, View.ALPHA, 0.35f, 1f);
        fadeIn.setDuration(LOGO_FADE_IN_MS);
        fadeIn.setInterpolator(new AccelerateDecelerateInterpolator());

        ObjectAnimator scaleX = ObjectAnimator.ofFloat(logo, View.SCALE_X, 0.85f, 1.0f);
        scaleX.setDuration(LOGO_SCALE_MS);
        scaleX.setInterpolator(new AccelerateDecelerateInterpolator());

        ObjectAnimator scaleY = ObjectAnimator.ofFloat(logo, View.SCALE_Y, 0.85f, 1.0f);
        scaleY.setDuration(LOGO_SCALE_MS);
        scaleY.setInterpolator(new AccelerateDecelerateInterpolator());

        AnimatorSet entrance = new AnimatorSet();
        entrance.playTogether(fadeIn, scaleX, scaleY);

        entrance.addListener(new AnimatorListenerAdapter() {
            @Override
            public void onAnimationEnd(Animator animation) {
                logo.postDelayed(SplashActivity.this::fadeOutAndLaunch, HOLD_MS);
            }
        });

        entrance.start();
    }

    private void fadeOutAndLaunch() {
        final ImageView logo = findViewById(R.id.splash_logo);
        ObjectAnimator fadeOut = ObjectAnimator.ofFloat(logo, View.ALPHA, 1f, 0f);
        fadeOut.setDuration(FADE_OUT_MS);
        fadeOut.setInterpolator(new DecelerateInterpolator(1.5f));
        fadeOut.addListener(new AnimatorListenerAdapter() {
            @Override
            public void onAnimationEnd(Animator animation) {
                launchMainActivity();
            }
        });
        fadeOut.start();
    }

    /**
     * Forward the original launch intent (deep link data, push extras, etc.)
     * to MainActivity without losing anything. We reuse the exact original
     * Intent object and only change its target component, so action, URI,
     * MIME type, categories, flags and extras are preserved verbatim.
     * CLEAR_TOP + SINGLE_TOP make sure an already-running MainActivity receives
     * it via onNewIntent, exactly as if it had been launched directly.
     */
    private void launchMainActivity() {
        Intent target = (Intent) getIntent().clone();
        target.setClass(this, MainActivity.class);

        // If a deep-link/notification data URI is present, make sure the
        // browser-style flags that would break internal navigation are removed
        // while keeping every meaningful extra intact.
        target.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);

        startActivity(target);
        overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out);
        finish();
    }
}