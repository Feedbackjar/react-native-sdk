package com.feedbackjar.rnsdk

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule

class FeedbackJarAppInfoModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "FeedbackJarAppInfo"

    override fun getConstants(): MutableMap<String, Any> {
        val context = reactApplicationContext
        val packageInfo = try {
            context.packageManager.getPackageInfo(context.packageName, 0)
        } catch (_: Exception) {
            null
        }

        @Suppress("DEPRECATION")
        val versionCode = packageInfo?.versionCode?.toString() ?: "unknown"

        return hashMapOf(
            "packageName" to context.packageName,
            "bundleId" to context.packageName,
            "version" to (packageInfo?.versionName ?: "unknown"),
            "build" to versionCode,
        )
    }
}
