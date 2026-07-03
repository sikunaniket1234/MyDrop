package dev.mydrop.alpha

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import com.facebook.react.bridge.*
import java.io.BufferedReader
import java.io.InputStreamReader

class FilePickerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "MyDropFilePicker"
        const val PICK_FILE_REQUEST = 9001
        private var pendingPromise: Promise? = null
    }

    override fun getName(): String = NAME

    @ReactMethod
    fun pickFile(promise: Promise) {
        val activity = currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "No current activity")
            return
        }

        pendingPromise = promise

        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "*/*"
        }

        activity.startActivityForResult(intent, PICK_FILE_REQUEST)
    }

    fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode != PICK_FILE_REQUEST) return

        val promise = pendingPromise ?: return
        pendingPromise = null

        if (resultCode != Activity.RESULT_OK || data?.data == null) {
            promise.resolve(null)
            return
        }

        try {
            val uri: Uri = data.data!!
            val contentResolver = reactApplicationContext.contentResolver

            var fileName = "unknown"
            var mimeType = contentResolver.getType(uri) ?: "application/octet-stream"
            var fileSize = 0L

            contentResolver.query(uri, null, null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) {
                    val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                    val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
                    if (nameIndex >= 0) fileName = cursor.getString(nameIndex) ?: "unknown"
                    if (sizeIndex >= 0) fileSize = cursor.getLong(sizeIndex)
                }
            }

            val inputStream = contentResolver.openInputStream(uri)
            val bytes = inputStream?.readBytes() ?: ByteArray(0)
            inputStream?.close()

            val base64 = android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP)

            val result = Arguments.createMap().apply {
                putString("uri", uri.toString())
                putString("fileName", fileName)
                putString("mimeType", mimeType)
                putDouble("fileSize", fileSize.toDouble())
                putString("base64", base64)
            }

            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("READ_ERROR", e.message, e)
        }
    }
}
