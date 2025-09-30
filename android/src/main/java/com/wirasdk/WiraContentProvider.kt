package com.nativewiraprovider

import android.content.ContentProvider
import android.content.ContentValues
import android.content.UriMatcher
import android.database.Cursor
import android.database.MatrixCursor
import android.net.Uri
import android.util.Log
import androidx.room.ColumnInfo
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Delete
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.Update

@Entity
data class User(
    @PrimaryKey val uid: Int,
    @ColumnInfo(name = "credential") var credential: String?,
)

@Dao
interface UserDao {
    @Query("SELECT * FROM user LIMIT 1")
    fun get(): User

    @Insert
    fun insert(user: User)

    @Update
    fun update(user: User)

    @Delete
    fun delete(user: User)
}

@Database(entities = [User::class], version = 1, exportSchema = false)
abstract class AppDatabase : RoomDatabase() {
    abstract fun userDao(): UserDao
}

//Database name
const val DBNAME = "wira-db"
// Define authority for ContentProvider (match with AndroidManifest.xml)
const val AUTHORITY = "com.wira.sdk.provider"
const val PATH_USER = "user"

// URI matcher codes, db only have one user, so the ID always be 1
const val USER_ONE = 1

class WiraContentProvider : ContentProvider() {
    private lateinit var appDatabase: AppDatabase
    private var userDao: UserDao? = null

    companion object {
        private val uriMatcher = UriMatcher(UriMatcher.NO_MATCH).apply {
            // URI for accessing the single user (e.g., content://com.wira.sdk.provider/user/1)
            // Only one user, always operate on the user with uid = 1
            // or the first user found.
            addURI(AUTHORITY, PATH_USER, USER_ONE)
        }
    }

    override fun delete(
        uri: Uri,
        selection: String?,
        selectionArgs: Array<out String?>?
    ): Int {
        val userToDelete = userDao?.get()

        if (userToDelete == null) {
            Log.w("NativeWiraProvider", "No user found to delete.")
            return 0 // No user to delete
        }

        return try {
            // You might want to delete by ID if your DAO supports it and it's more direct
            // val rowsAffected = userDao?.deleteById(1) ?: 0
            userDao?.delete(userToDelete)
            context?.contentResolver?.notifyChange(uri, null)
            return 1 // Unique row deleted
        } catch (e: Exception) {
            Log.e("NativeWiraProvider", "Error deleting user: ${e.message}")
            0
        }
    }

    override fun getType(uri: Uri): String? {
        // For a single user, you can define a custom MIME type.
        // Example: "vnd.android.cursor.item/vnd.com.wira.sdk.provider.user"
        // Or return null if you don't need to specify types.
        return when (uriMatcher.match(uri)) {
            USER_ONE -> "vnd.android.cursor.item/vnd.$AUTHORITY.$PATH_USER"
            else -> null
        }
    }

    override fun insert(uri: Uri, values: ContentValues?): Uri? {
        Log.w("NativeWiraProvider", "Inserting user")
        if (values == null) {
            throw IllegalArgumentException("ContentValues cannot be null")
        }

        val credential = values.getAsString("credential")

        if (credential.isNullOrEmpty()) {
            throw IllegalArgumentException("Invalid values for credential")
        }

        val user = User(uid = USER_ONE , credential = credential)

        try {
            userDao?.insert(user)
            context?.contentResolver?.notifyChange(uri, null)
            return uri
        } catch (e: Exception) {
            Log.e("NativeWiraProvider", "Error inserting user: ${e.message}")
            return null
        }
    }

    override fun onCreate(): Boolean {
        if(context == null) return false
        appDatabase = Room.databaseBuilder(context!!, AppDatabase::class.java, DBNAME).build()
        userDao = appDatabase.userDao()

        return true
    }

    override fun query(
        uri: Uri,
        projection: Array<out String?>?,
        selection: String?,
        selectionArgs: Array<out String?>?,
        sortOrder: String?
    ): Cursor? {
        val user = userDao?.get()

        if (user == null) {
            return null
        }

        val columns = projection ?: arrayOf("credential")
        val matrixCursor = MatrixCursor(columns)

        // Create a row for the MatrixCursor
        val row = mutableListOf<Any?>()
        for (columnName in columns) {
            when (columnName) {
                "credential" -> row.add(user.credential)
                else -> throw IllegalArgumentException("Invalid column name: $columnName")
            }
        }
        matrixCursor.addRow(row)

        // Notify the resolver of changes if this cursor is for observation
        matrixCursor.setNotificationUri(context?.contentResolver, uri)
        return matrixCursor
    }

    override fun update(
        uri: Uri,
        values: ContentValues?,
        selection: String?,
        selectionArgs: Array<out String?>?
    ): Int {
        if (values == null) {
            return 0
        }

        // single-user scenario, update the existing user.
        val existingUser = userDao?.get()

        if (existingUser == null) {
            Log.w("NativeWiraProvider", "No user found to update.")
            return 0 // No user to update
        }

        // Apply updates from ContentValues
        values.getAsString("credential")?.let { existingUser.credential = it }

        return try {
            userDao?.update(existingUser)
            context?.contentResolver?.notifyChange(uri, null)
            return 1 //Unique row affected
        } catch (e: Exception) {
            Log.e("NativeWiraProvider", "Error updating user: ${e.message}")
            0
        }
    }
}