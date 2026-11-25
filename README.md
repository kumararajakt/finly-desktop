# Finly Desktop (KDE Kirigami)

A native Linux desktop personal finance manager built with **C++20**, **Qt 6**, **KDE Kirigami**, and **SQLite**.

## Tech Stack
- **UI**: QML + KDE Kirigami (`org.kde.kirigami`)
- **Backend**: C++20, Qt6 (`Core`, `Quick`, `Qml`, `QuickControls2`, `Sql`, `Network`, `Widgets`)
- **KDE Frameworks**: `KF6Kirigami`, `KF6I18n`, `KF6CoreAddons`, `KF6Config`, `KF6Notifications`
- **Database**: Local SQLite (`QSQLITE`)
- **Build System**: CMake + Extra CMake Modules (ECM)

## Building & Running

### Arch Linux Dependencies
```bash
sudo pacman -S --needed cmake ninja extra-cmake-modules qt6-base qt6-declarative kirigami ki18n kcoreaddons kconfig knotifications qqc2-desktop-style
```

### Build & Run
```bash
cmake -S . -B build -G Ninja
cmake --build build
./build/bin/finly
```

### Run Tests
```bash
ctest --test-dir build --output-on-failure
```

### Flatpak Build
```bash
flatpak-builder --repo=flatpak-repo --force-clean build-flatpak com.kumar.finly.json
flatpak build-bundle flatpak-repo finly-kde.flatpak com.kumar.finly
```

### Android APK Build (KDE Craft / Android SDK)
Following [KDE Android Packaging](https://develop.kde.org/docs/packaging/android/), configure with your Android/Craft toolchain and build `create-apk-finly`:
```bash
cmake -B build-android -S . -G Ninja \
  -DCMAKE_TOOLCHAIN_FILE=/path/to/craft/share/cmake/CraftToolchain.cmake \
  -DBUILD_TESTING=OFF
cmake --build build-android --target create-apk-finly
```

## License
MIT
