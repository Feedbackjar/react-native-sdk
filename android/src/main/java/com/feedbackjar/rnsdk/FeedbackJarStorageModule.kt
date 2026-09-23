package com.feedbackjar.rnsdk

import android.content.Context
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

private const val PREFS_NAME = "com.feedbackjar.sdk.prefs"

class FeedbackJarStorageModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "FeedbackJarStorage"

    private val prefs
        get() = reactApplicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    @ReactMethod
    fun getItem(key: String, promise: Promise) {
        promise.resolve(prefs.getString(key, null))
    }

    @ReactMethod
    fun setItem(key: String, value: String, promise: Promise) {
        prefs.edit().putString(key, value).apply()
        promise.resolve(null)
    }

    @ReactMethod
    fun removeItem(key: String, promise: Promise) {
        prefs.edit().remove(key).apply()
        promise.resolve(null)
    }
}
