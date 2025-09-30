package com.wirasdk

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule
import android.content.ContentValues
import android.database.Cursor
import androidx.core.net.toUri
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import android.content.Context
import com.facebook.react.bridge.Promise
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import android.content.pm.PackageManager
import android.util.Log

//import com.wirasdk.*

@ReactModule(name = WiraSdkModule.NAME)
class WiraSdkModule(private val reactContext: ReactApplicationContext) :
  NativeWiraSdkSpec(reactContext) {

  private val contentProvider = reactContext.contentResolver
  private var pendingPermissionPromise: Promise? = null

  override fun getName(): String {
    return NAME
  }

  override fun deleteUser(
    uri: String,
  ): Double {
    return contentProvider.delete(uri.toUri(), null, null).toDouble()
  }

  override fun insertUser(
    uri: String,
    values: ReadableMap
  ): String {
    val contentValues = readableMapToContentValues(values)
    val insertedUri = contentProvider.insert(uri.toUri(), contentValues)
    return insertedUri?.toString() ?: ""
  }

  override fun queryUser(
    uri: String,
  ): WritableMap {
    val cursor = contentProvider.query(uri.toUri(), null, null, null, null)
    try {
      val map: WritableMap = Arguments.createMap()

      if (cursor == null || cursor.count == 0) {
        return map
      }

      if (cursor.moveToFirst()) {
        val columnNames = cursor.columnNames
        for (columnName in columnNames) {
          val columnIndex = cursor.getColumnIndex(columnName)
          when (cursor.getType(columnIndex)) {
            Cursor.FIELD_TYPE_NULL -> map.putNull(columnName)
            Cursor.FIELD_TYPE_INTEGER -> map.putInt(columnName, cursor.getInt(columnIndex))
            Cursor.FIELD_TYPE_FLOAT -> map.putDouble(columnName, cursor.getDouble(columnIndex))
            Cursor.FIELD_TYPE_STRING -> map.putString(columnName, cursor.getString(columnIndex))
          }
        }
      }
      return map
    } finally {
      cursor?.close()
    }
  }

  override fun updateUser(
    uri: String,
    values: ReadableMap
  ): Double {
    val contentValues = readableMapToContentValues(values)
    return contentProvider.update(uri.toUri(), contentValues, null, null).toDouble()
  }

  fun readableMapToContentValues(map: ReadableMap): ContentValues {
    val contentValues = ContentValues()
    val hasValues = map.toHashMap()
    for ((key, value) in hasValues) {
      when (value) {
        is String -> contentValues.put(key, value)
        is Int -> contentValues.put(key, value)
        is Long -> contentValues.put(key, value)
        is Double -> contentValues.put(key, value)
        is Float -> contentValues.put(key, value)
        is Boolean -> contentValues.put(key, value)
        is ByteArray -> contentValues.put(key, value)
        null -> contentValues.putNull(key)
        else -> {} // Ignore unsupported types
      }
    }
    return contentValues
  }

  override fun requestAccessDataPermission(promise: Promise) {
    val permission = "wira.permission.ACCESS_DATA"
    val activity = reactContext.currentActivity ?: run {
      promise.reject("ERROR", "No current activity")
      return
    }

    if (ContextCompat.checkSelfPermission(reactContext, permission) == PackageManager.PERMISSION_GRANTED) {
      promise.resolve(true)  // Already granted
    } else {
      //pendingPermissionPromise = promise
      ActivityCompat.requestPermissions(activity, arrayOf(permission), 1001)  // Request code 1001
      promise.resolve(false)
      // The result will be handled asynchronously in onRequestPermissionsResult
    }
  }

  // Add this to handle the permission result asynchronously
  fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
    if (requestCode == 1001 && permissions.contains("wira.permission.ACCESS_DATA")) {
      val granted = grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED
      pendingPermissionPromise?.resolve(granted)
      pendingPermissionPromise = null
      Log.d("NativeWiraProvider", "Permission granted: $granted")
    } else {
      pendingPermissionPromise?.resolve(false)
    }
  }

  companion object {
    const val NAME = "WiraSdk"
  }
}
