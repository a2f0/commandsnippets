# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Keep line numbers for debugging production issues
-keepattributes SourceFile,LineNumberTable

# Capacitor core rules
-keep class com.getcapacitor.** { *; }
-keep class com.tearleads.app.** { *; }

# WebView with JavaScript interface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep custom application class if any
-keep public class * extends android.app.Application

# Preserve annotations
-keepattributes *Annotation*

# Keep Capacitor plugins
-keep public class * extends com.getcapacitor.Plugin

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile
