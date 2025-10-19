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
import android.util.Log
import com.facebook.react.bridge.Promise

@ReactModule(name = WiraSdkModule.NAME)
class WiraSdkModule(private val reactContext: ReactApplicationContext) :
  NativeWiraSdkSpec(reactContext) {

  // ContentResolver can query any content provider (internal or external apps)
  // as long as the correct URI is provided and permissions are granted
  private val contentResolver = reactContext.contentResolver

  override fun getName(): String {
    return NAME
  }

  override fun deleteUser(
    uri: String,
  ): Double {
    return try {
      Log.d(NAME, "Deleting user from URI: $uri")
      contentResolver.delete(uri.toUri(), null, null).toDouble()
    } catch (e: Exception) {
      Log.e(NAME, "Error deleting user from URI: $uri", e)
      0.0
    }
  }

  override fun insertUser(
    uri: String,
    values: ReadableMap
  ): String {
    return try {
      Log.d(NAME, "Inserting user to URI: $uri")
      val contentValues = readableMapToContentValues(values)
      val insertedUri = contentResolver.insert(uri.toUri(), contentValues)
      insertedUri?.toString() ?: ""
    } catch (e: Exception) {
      Log.e(NAME, "Error inserting user to URI: $uri", e)
      ""
    }
  }

  override fun queryUser(
    uri: String,
  ): WritableMap {
    val map: WritableMap = Arguments.createMap()
    
    return try {
      Log.d(NAME, "Querying user from URI: $uri")
      val cursor = contentResolver.query(uri.toUri(), null, null, null, null)
      
      cursor?.use {
        if (cursor.count == 0) {
          Log.d(NAME, "No data found for URI: $uri")
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
      }
      map
    } catch (e: Exception) {
      Log.e(NAME, "Error querying user from URI: $uri", e)
      map
    }
  }

  override fun updateUser(
    uri: String,
    values: ReadableMap
  ): Double {
    return try {
      Log.d(NAME, "Updating user at URI: $uri")
      val contentValues = readableMapToContentValues(values)
      contentResolver.update(uri.toUri(), contentValues, null, null).toDouble()
    } catch (e: Exception) {
      Log.e(NAME, "Error updating user at URI: $uri", e)
      0.0
    }
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

  companion object {
    const val NAME = "WiraSdk"
  }
}
