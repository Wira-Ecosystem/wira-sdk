package com.wirasdk

import android.content.Context
import android.net.wifi.WifiManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.embedding.engine.dart.DartExecutor
import io.flutter.embedding.engine.FlutterEngineGroup
import io.flutter.embedding.engine.loader.FlutterLoader
import io.flutter.FlutterInjector
import io.flutter.plugin.common.MethodChannel
import com.facebook.react.module.annotations.ReactModule
import org.json.JSONObject
import java.util.concurrent.CountDownLatch

@ReactModule(name = WiraSdkModule.NAME)
class WiraSdkModule(val reactContext: ReactApplicationContext) :
  NativeWiraSdkSpec(reactContext) {

  private fun convertReadableValue(array: ReadableArray, index: Int): Any? {
    return when (array.getType(index)) {
      ReadableType.Null -> null
      ReadableType.Boolean -> array.getBoolean(index)
      ReadableType.Number -> array.getDouble(index)
      ReadableType.String -> array.getString(index)
      ReadableType.Map -> array.getMap(index)?.let { readableMapToMap(it) }
      ReadableType.Array -> array.getArray(index)?.let { readableArrayToList(it) }
    }
  }

  private fun convertReadableValue(map: ReadableMap, key: String): Any? {
    return when (map.getType(key)) {
      ReadableType.Null -> null
      ReadableType.Boolean -> map.getBoolean(key)
      ReadableType.Number -> map.getDouble(key)
      ReadableType.String -> map.getString(key)
      ReadableType.Map -> map.getMap(key)?.let { readableMapToMap(it) }
      ReadableType.Array -> map.getArray(key)?.let { readableArrayToList(it) }
    }
  }

  private fun readableArrayToList(array: ReadableArray): List<Any?> {
    val result = mutableListOf<Any?>()
    for (i in 0 until array.size()) {
      result.add(convertReadableValue(array, i))
    }
    return result
  }

  private fun readableMapToMap(map: ReadableMap): Map<String, Any?> {
    val result = mutableMapOf<String, Any?>()
    val iterator = map.keySetIterator()
    while (iterator.hasNextKey()) {
      val key = iterator.nextKey()
      result[key] = convertReadableValue(map, key)
    }
    return result
  }

  override fun getName(): String = NAME

  fun callFunction(functionName: String, args: Map<String, Any>, promise: Promise) {
    Handler(Looper.getMainLooper()).post {
      ensureEngine(reactContext)

      methodChannel?.invokeMethod(functionName, args, object : MethodChannel.Result {
        override fun success(result: Any?) {
          promise.resolve(result)
        }

        override fun error(errorCode: String, errorMessage: String?, errorDetails: Any?) {
          promise.reject(errorCode, errorMessage, null)
        }

        override fun notImplemented() {
          promise.reject("NOT_IMPLEMENTED", "$functionName not implemented in Flutter logic")
        }
      })
    }
  }

  override fun initialize(env: String, promise: Promise) {
    val args = mapOf("env" to env)
    callFunction("initialize", args, promise)
  }

  override fun downloadCircuits(circuitsToDownload: String, promise: Promise) {
    acquireDownloadLocks(reactContext)
    val args = mapOf("circuitsToDownload" to circuitsToDownload)
    callFunction("downloadCircuits", args, promise)
  }

  override fun addIdentity(promise: Promise) {
    callFunction("addIdentity", emptyMap(), promise)
  }

  override fun authenticate(message: String, userDid: String, userPk: String, requestedCredentialIds: ReadableArray, promise: Promise) {
    val args = mapOf(
      "message" to message,
      "userDid" to userDid,
      "userPk" to userPk,
      "requestedCredentialIds" to readableArrayToList(requestedCredentialIds)
    )
    callFunction("authenticate", args, promise)
  }

  override fun getProof(message: String, userDid: String, userPk: String, challenge: String, byField: String, byValue: String, promise: Promise) {
    val args = mapOf(
      "message" to message,
      "userDid" to userDid,
      "userPk" to userPk,
      "challenge" to challenge,
      "byField" to byField,
      "byValue" to byValue
    )
    callFunction("getProof", args, promise)
  }

  override fun claimCredential(offerMessage: String, userDid: String, userPk: String, promise: Promise) {
    val args = mapOf(
      "offerMessage" to offerMessage,
      "userDid" to userDid,
      "userPk" to userPk
    )
    callFunction("claimCredential", args, promise)
  }

  override fun backupIdentity(userDid: String, userPk: String, promise: Promise) {
    val args = mapOf(
      "userDid" to userDid,
      "userPk" to userPk
    )
    callFunction("backupIdentity", args, promise)
  }

  override fun restoreIdentity(backup: String, userDid: String, userPk: String, promise: Promise) {
    val args = mapOf(
      "backup" to backup,
      "userDid" to userDid,
      "userPk" to userPk
    )
    callFunction("restoreIdentity", args, promise)
  }

  override fun getCredentials(userDid: String, userPk: String, promise: Promise) {
    val args = mapOf(
      "userDid" to userDid,
      "userPk" to userPk
    )
    callFunction("getCredentials", args, promise)
  }

  companion object {
    const val NAME = "WiraSdk"
    private const val CHANNEL_NAME = "wira_logic"
    private var flutterEngine: FlutterEngine? = null
    private var methodChannel: MethodChannel? = null
    private var wifiLock: WifiManager.WifiLock? = null
    private var wakeLock: PowerManager.WakeLock? = null

    private fun acquireDownloadLocks(context: ReactApplicationContext) {
      try {
        if (wifiLock?.isHeld != true) {
          val wifiManager = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
          val lockType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            WifiManager.WIFI_MODE_FULL_LOW_LATENCY
          } else {
            @Suppress("DEPRECATION")
            WifiManager.WIFI_MODE_FULL_HIGH_PERF
          }
          wifiLock = wifiManager?.createWifiLock(lockType, "wira:circuit_download")
          wifiLock?.setReferenceCounted(false)
          wifiLock?.acquire()
        }
      } catch (_: Exception) {}
      try {
        if (wakeLock?.isHeld != true) {
          val powerManager = context.applicationContext.getSystemService(Context.POWER_SERVICE) as? PowerManager
          wakeLock = powerManager?.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "wira:circuit_download")
          wakeLock?.setReferenceCounted(false)
          wakeLock?.acquire(5 * 60 * 1000L) // 5-minute safety timeout
        }
      } catch (_: Exception) {}
    }

    private fun releaseDownloadLocks() {
      try { if (wifiLock?.isHeld == true) wifiLock?.release() } catch (_: Exception) {}
      try { if (wakeLock?.isHeld == true) wakeLock?.release() } catch (_: Exception) {}
    }

    private fun ensureEngine(context: ReactApplicationContext) {
      if (flutterEngine != null) return

      if (Looper.myLooper() == Looper.getMainLooper()) {
        initFlutterEngine(context)
      } else {
        val latch = CountDownLatch(1)
        Handler(Looper.getMainLooper()).post {
          initFlutterEngine(context)
          latch.countDown()
        }
        try {
          latch.await()
        } catch (_: InterruptedException) {
        }
      }
    }

    private fun initFlutterEngine(context: ReactApplicationContext) {
      val loader: FlutterLoader = FlutterInjector.instance().flutterLoader()
      loader.startInitialization(context)
      loader.ensureInitializationComplete(context, emptyArray())

      val engineGroup = FlutterEngineGroup(context)
      flutterEngine = engineGroup.createAndRunEngine(
        context,
        DartExecutor.DartEntrypoint(
          loader.findAppBundlePath(),
          "main" // entrypoint name in main.dart
        )
      )

      methodChannel = MethodChannel(
        flutterEngine!!.dartExecutor.binaryMessenger,
        CHANNEL_NAME
      )

      methodChannel?.setMethodCallHandler { call, result ->
        when (call.method) {
          "downloadInfo" -> {
            val args = call.arguments as? String ?: ""
            val eventEmitter = context.getJSModule(RCTDeviceEventEmitter::class.java)
            eventEmitter.emit("downloadInfo", args)
            try {
              val status = JSONObject(args).optString("status")
              if (status == "done" || status == "error") {
                releaseDownloadLocks()
              }
            } catch (_: Exception) {}
            result.success(null)
          }
          else -> result.notImplemented()
        }
      }
    }
  }
}
