plugins {
    id("com.android.application")
}

val commandCenterUrl = providers.gradleProperty("COMMAND_CENTER_URL")
    .orElse("https://crm.ideasol.pl/command-center/tv")

android {
    namespace = "pl.ideasol.commandcenter.tv"
    compileSdk = 35

    defaultConfig {
        applicationId = "pl.ideasol.commandcenter.tv"
        minSdk = 24
        targetSdk = 35
        versionCode = 3
        versionName = "2.0.1"

        buildConfigField("String", "COMMAND_CENTER_URL", "\"${commandCenterUrl.get()}\"")
    }

    buildFeatures {
        buildConfig = true
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
