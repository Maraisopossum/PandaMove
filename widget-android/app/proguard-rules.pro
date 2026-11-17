# kotlinx.serialization : conserver les sérialiseurs générés des classes du contrat
-keepattributes *Annotation*, InnerClasses
-keepclassmembers class fr.pandamove.widget.** {
    *** Companion;
    kotlinx.serialization.KSerializer serializer(...);
}
-keep,includedescriptorclasses class fr.pandamove.widget.**$$serializer { *; }

# Tink (via security-crypto) référence des annotations errorprone absentes à l'exécution
-dontwarn com.google.errorprone.annotations.**
-dontwarn javax.annotation.**
