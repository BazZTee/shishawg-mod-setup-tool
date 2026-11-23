package de.shishawg.modsetuptool;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * In-app update for the Android build: downloads the release APK into the app cache with
 * progress events and hands it to the system package installer.
 */
@CapacitorPlugin(name = "ApkUpdater")
public class ApkUpdaterPlugin extends Plugin {
    private static final String UPDATE_DIR = "updates";
    private static final String UPDATE_FILE = "update.apk";
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    private File updateFile() {
        return new File(new File(getContext().getCacheDir(), UPDATE_DIR), UPDATE_FILE);
    }

    @PluginMethod
    public void download(PluginCall call) {
        String url = call.getString("url");
        if (url == null || !url.startsWith("https://")) {
            call.reject("Ungültige Download-Adresse.");
            return;
        }
        executor.execute(() -> {
            HttpURLConnection connection = null;
            File target = updateFile();
            try {
                File dir = target.getParentFile();
                if (dir != null && !dir.exists() && !dir.mkdirs()) throw new IOException("Update-Ordner nicht anlegbar");
                if (target.exists() && !target.delete()) throw new IOException("Alte Update-Datei nicht löschbar");

                // GitHub answers with a redirect to its download host; both are https, so it is followed.
                connection = (HttpURLConnection) new URL(url).openConnection();
                connection.setInstanceFollowRedirects(true);
                connection.setConnectTimeout(20000);
                connection.setReadTimeout(30000);
                int status = connection.getResponseCode();
                if (status != HttpURLConnection.HTTP_OK) throw new IOException("Server antwortet mit " + status);

                long total = connection.getContentLengthLong();
                long transferred = 0;
                int lastPercent = -1;
                long startedAt = System.currentTimeMillis();
                byte[] buffer = new byte[64 * 1024];
                try (InputStream in = connection.getInputStream(); FileOutputStream out = new FileOutputStream(target)) {
                    int read;
                    while ((read = in.read(buffer)) != -1) {
                        out.write(buffer, 0, read);
                        transferred += read;
                        int percent = total > 0 ? (int) (transferred * 100 / total) : 0;
                        if (percent != lastPercent) {
                            lastPercent = percent;
                            long elapsed = Math.max(1, System.currentTimeMillis() - startedAt);
                            JSObject progress = new JSObject();
                            progress.put("percent", percent);
                            progress.put("transferred", transferred);
                            progress.put("total", total);
                            progress.put("bytesPerSecond", transferred * 1000 / elapsed);
                            notifyListeners("progress", progress);
                        }
                    }
                }
                if (total > 0 && transferred != total) throw new IOException("Download unvollständig");
                JSObject result = new JSObject();
                result.put("size", transferred);
                call.resolve(result);
            } catch (Exception error) {
                //noinspection ResultOfMethodCallIgnored
                target.delete();
                call.reject("Download fehlgeschlagen: " + error.getMessage(), error);
            } finally {
                if (connection != null) connection.disconnect();
            }
        });
    }

    @PluginMethod
    public void install(PluginCall call) {
        File apk = updateFile();
        if (!apk.exists()) {
            call.reject("Die Update-Datei fehlt. Bitte erneut herunterladen.");
            return;
        }
        JSObject result = new JSObject();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !getContext().getPackageManager().canRequestPackageInstalls()) {
            // Android asks once per app whether it may install updates ("Unbekannte Apps installieren").
            Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + getContext().getPackageName()));
            settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(settings);
            result.put("needsPermission", true);
            call.resolve(result);
            return;
        }
        Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk);
        Intent install = new Intent(Intent.ACTION_VIEW);
        install.setDataAndType(uri, "application/vnd.android.package-archive");
        install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(install);
        result.put("needsPermission", false);
        call.resolve(result);
    }
}
