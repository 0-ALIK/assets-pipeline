fn main() {
    // The Windows resource, the macOS bundle and the Linux packages embed these
    // icons, so the build script must re-run when they change. Without this,
    // Cargo reuses a stale resource and the executable keeps the old icon.
    println!("cargo:rerun-if-changed=icons/icon.ico");
    println!("cargo:rerun-if-changed=icons/icon.icns");
    println!("cargo:rerun-if-changed=icons/icon.png");
    tauri_build::build()
}
